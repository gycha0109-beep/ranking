BEGIN;

CREATE OR REPLACE FUNCTION public.get_ranking_unique_view_count(p_ranking_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  IF NOT private.is_public_ranking(p_ranking_id) THEN
    RAISE EXCEPTION '공개된 랭킹을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(t.unique_view_count, 0)
  INTO v_count
  FROM public.content_view_totals t
  WHERE t.ranking_id = p_ranking_id;

  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_item_unique_view_count(p_item_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  IF NOT private.is_public_item(p_item_id) THEN
    RAISE EXCEPTION '공개된 아이템을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(t.unique_view_count, 0)
  INTO v_count
  FROM public.content_view_totals t
  WHERE t.item_id = p_item_id;

  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_expired_content_daily_views(
  p_batch_size INTEGER DEFAULT 10000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER;
  v_batch_size INTEGER := LEAST(GREATEST(COALESCE(p_batch_size, 10000), 1), 10000);
  v_cutoff DATE := (((NOW() AT TIME ZONE 'UTC')::DATE - INTERVAL '13 months')::DATE);
BEGIN
  WITH expired AS (
    SELECT id
    FROM public.content_daily_views
    WHERE viewed_on < v_cutoff
    ORDER BY viewed_on, id
    LIMIT v_batch_size
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.content_daily_views d
  USING expired e
  WHERE d.id = e.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_content_daily_views(INTEGER)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_content_daily_views(INTEGER)
TO service_role;

REVOKE ALL ON FUNCTION public.get_ranking_unique_view_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_item_unique_view_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ranking_unique_view_count(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_item_unique_view_count(UUID) TO anon, authenticated;

COMMIT;
