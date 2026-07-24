BEGIN;

CREATE OR REPLACE FUNCTION public.list_admin_audit_events_v2(
  p_event_kinds TEXT[] DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_subject_id UUID DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_sort_key TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  event_kind TEXT,
  event_id TEXT,
  sort_key TEXT,
  correlation_id TEXT,
  group_id TEXT,
  actor_id UUID,
  actor_label TEXT,
  subject_type TEXT,
  subject_id UUID,
  subject_label TEXT,
  action TEXT,
  reason_code TEXT,
  summary TEXT,
  source_href TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_event_kinds TEXT[] := CASE
    WHEN COALESCE(cardinality(p_event_kinds), 0) = 0 THEN NULL
    ELSE p_event_kinds
  END;
  v_correlation_id TEXT := NULLIF(LOWER(BTRIM(COALESCE(p_correlation_id, ''))), '');
BEGIN
  PERFORM private.assert_admin_capability('audit_view');

  IF COALESCE(cardinality(v_event_kinds), 0) > 6 THEN
    RAISE EXCEPTION '감사 이벤트 종류 필터가 너무 많습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_event_kinds IS NOT NULL AND EXISTS (
    SELECT 1
    FROM unnest(v_event_kinds) AS allowed_event_kind
    WHERE allowed_event_kind NOT IN (
      'role_change',
      'moderation_review',
      'comment_report_decision',
      'sanction_event',
      'appeal_decision',
      'maintenance_job'
    )
  ) THEN
    RAISE EXCEPTION '지원하지 않는 감사 이벤트 종류입니다.' USING ERRCODE = '22023';
  END IF;

  IF v_correlation_id IS NOT NULL
     AND v_correlation_id !~ '^[a-z0-9_:-]{1,200}$' THEN
    RAISE EXCEPTION '상관관계 ID 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from >= p_to THEN
    RAISE EXCEPTION '감사 조회 기간이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF (p_cursor_created_at IS NULL) <> (p_cursor_sort_key IS NULL) THEN
    RAISE EXCEPTION '감사 조회 cursor가 완전하지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_cursor_sort_key IS NOT NULL AND char_length(p_cursor_sort_key) > 300 THEN
    RAISE EXCEPTION '감사 조회 cursor가 너무 깁니다.' USING ERRCODE = '22023';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION '감사 조회 개수는 1개 이상 100개 이하이어야 합니다.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT *
  FROM private.list_admin_audit_event_stream(
    v_event_kinds,
    NULL,
    p_actor_id,
    p_subject_id,
    v_correlation_id,
    p_from,
    p_to,
    p_cursor_created_at,
    p_cursor_sort_key,
    p_limit
  );
END;
$$;

COMMIT;
