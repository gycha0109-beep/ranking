BEGIN;

CREATE OR REPLACE FUNCTION private.record_content_daily_view(
  p_ranking_id UUID,
  p_item_id UUID,
  p_viewer_key_hash TEXT,
  p_viewed_on DATE,
  p_key_version SMALLINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_event_id BIGINT;
  v_count BIGINT := 0;
  v_eligible_ranking_id UUID;
  v_today_utc DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
BEGIN
  IF num_nonnulls(p_ranking_id, p_item_id) <> 1 THEN
    RAISE EXCEPTION '조회 대상이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_viewer_key_hash IS NULL OR p_viewer_key_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION '조회자 키 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_viewed_on IS DISTINCT FROM v_today_utc THEN
    RAISE EXCEPTION '조회 날짜는 현재 UTC 날짜여야 합니다.' USING ERRCODE = '22023';
  END IF;

  IF p_key_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION '지원하지 않는 조회자 키 버전입니다.' USING ERRCODE = '22023';
  END IF;

  IF p_ranking_id IS NOT NULL THEN
    PERFORM 1
    FROM public.rankings r
    WHERE r.id = p_ranking_id
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '공개된 랭킹만 조회수에 반영할 수 있습니다.' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    PERFORM 1
    FROM public.items i
    WHERE i.id = p_item_id
      AND i.status = 'active'
      AND i.moderation_status IN ('clean', 'suggestive')
      AND i.image_moderation_status IN ('clean', 'suggestive')
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '공개 가능한 활성 아이템만 조회수에 반영할 수 있습니다.' USING ERRCODE = 'P0002';
    END IF;

    SELECT r.id
    INTO v_eligible_ranking_id
    FROM public.ranking_entries e
    JOIN public.rankings r ON r.id = e.ranking_id
    WHERE e.item_id = p_item_id
      AND e.moderation_status IN ('clean', 'suggestive')
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
    ORDER BY r.id
    LIMIT 1
    FOR SHARE OF e, r;

    IF v_eligible_ranking_id IS NULL THEN
      RAISE EXCEPTION '공개 랭킹에 연결된 아이템만 조회수에 반영할 수 있습니다.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.content_daily_views(
    ranking_id,
    item_id,
    viewer_key_hash,
    viewed_on,
    key_version
  ) VALUES (
    p_ranking_id,
    p_item_id,
    p_viewer_key_hash,
    p_viewed_on,
    p_key_version
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NOT NULL THEN
    IF p_ranking_id IS NOT NULL THEN
      INSERT INTO public.content_view_totals(ranking_id, unique_view_count)
      VALUES(p_ranking_id, 1)
      ON CONFLICT (ranking_id) WHERE ranking_id IS NOT NULL
      DO UPDATE SET
        unique_view_count = public.content_view_totals.unique_view_count + 1,
        updated_at = NOW();
    ELSE
      INSERT INTO public.content_view_totals(item_id, unique_view_count)
      VALUES(p_item_id, 1)
      ON CONFLICT (item_id) WHERE item_id IS NOT NULL
      DO UPDATE SET
        unique_view_count = public.content_view_totals.unique_view_count + 1,
        updated_at = NOW();
    END IF;
  END IF;

  SELECT COALESCE(t.unique_view_count, 0)
  INTO v_count
  FROM public.content_view_totals t
  WHERE t.ranking_id IS NOT DISTINCT FROM p_ranking_id
    AND t.item_id IS NOT DISTINCT FROM p_item_id;

  RETURN jsonb_build_object(
    'inserted', v_event_id IS NOT NULL,
    'unique_view_count', COALESCE(v_count, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION private.record_content_daily_view(UUID, UUID, TEXT, DATE, SMALLINT)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_ranking_daily_view(
  p_ranking_id UUID,
  p_viewer_key_hash TEXT,
  p_viewed_on DATE,
  p_key_version SMALLINT DEFAULT 1
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.record_content_daily_view(
    p_ranking_id,
    NULL,
    p_viewer_key_hash,
    p_viewed_on,
    p_key_version
  );
$$;

CREATE OR REPLACE FUNCTION public.record_item_daily_view(
  p_item_id UUID,
  p_viewer_key_hash TEXT,
  p_viewed_on DATE,
  p_key_version SMALLINT DEFAULT 1
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.record_content_daily_view(
    NULL,
    p_item_id,
    p_viewer_key_hash,
    p_viewed_on,
    p_key_version
  );
$$;

REVOKE ALL ON FUNCTION public.record_ranking_daily_view(UUID, TEXT, DATE, SMALLINT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_item_daily_view(UUID, TEXT, DATE, SMALLINT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_ranking_daily_view(UUID, TEXT, DATE, SMALLINT)
TO service_role;
GRANT EXECUTE ON FUNCTION public.record_item_daily_view(UUID, TEXT, DATE, SMALLINT)
TO service_role;

COMMIT;
