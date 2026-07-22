BEGIN;

CREATE OR REPLACE FUNCTION public.redact_expired_blocked_comment_bodies(
  p_batch_size INTEGER DEFAULT 1000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_batch_size INTEGER := LEAST(GREATEST(COALESCE(p_batch_size, 1000), 1), 1000);
BEGIN
  PERFORM set_config('statement_timeout', '10000', TRUE);

  WITH expired AS (
    SELECT c.id
    FROM public.comments c
    WHERE c.moderation_status = 'blocked'
      AND c.body_redacted_at IS NULL
      AND c.updated_at < NOW() - INTERVAL '30 days'
    ORDER BY c.updated_at, c.id
    LIMIT v_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.comments c
  SET body = '[REDACTED_BLOCKED_CONTENT]',
      body_redacted_at = NOW()
  FROM expired e
  WHERE c.id = e.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.redact_expired_blocked_comment_bodies(INTEGER)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redact_expired_blocked_comment_bodies(INTEGER)
TO service_role;

COMMIT;
