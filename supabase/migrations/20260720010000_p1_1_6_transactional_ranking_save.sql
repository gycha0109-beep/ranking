BEGIN;

CREATE OR REPLACE FUNCTION public.save_ranking_e2e(
  p_ranking_id UUID,
  p_ranking_data JSONB,
  p_criteria JSONB,
  p_sources JSONB,
  p_entries JSONB,
  p_facet_ids UUID[],
  p_expected_updated_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_current_status TEXT;
  v_current_updated_at TIMESTAMPTZ;
  v_new_updated_at TIMESTAMPTZ;
  v_was_published BOOLEAN;
  v_category_id UUID;
  v_subcategory_id UUID;
  v_entry_count INTEGER;
  v_distinct_positions INTEGER;
  v_distinct_items INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_ranking_data) <> 'object'
     OR jsonb_typeof(p_criteria) <> 'array'
     OR jsonb_typeof(p_sources) <> 'array'
     OR jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION '잘못된 저장 payload 형식입니다.' USING ERRCODE = '22023';
  END IF;

  SELECT status, updated_at
  INTO v_current_status, v_current_updated_at
  FROM public.rankings
  WHERE id = p_ranking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '랭킹을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF p_expected_updated_at IS NULL OR v_current_updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION '랭킹이 다른 세션에서 변경되었습니다.' USING ERRCODE = '40001';
  END IF;

  v_was_published := v_current_status = 'published';
  v_category_id := NULLIF(p_ranking_data->>'category_id', '')::UUID;
  v_subcategory_id := NULLIF(p_ranking_data->>'subcategory_id', '')::UUID;

  IF v_category_id IS NULL
     OR BTRIM(COALESCE(p_ranking_data->>'title', '')) = ''
     OR BTRIM(COALESCE(p_ranking_data->>'slug', '')) = ''
     OR BTRIM(COALESCE(p_ranking_data->>'summary', '')) = ''
     OR BTRIM(COALESCE(p_ranking_data->>'ranking_type', '')) = '' THEN
    RAISE EXCEPTION '랭킹 필수 입력값이 누락되었습니다.' USING ERRCODE = '23502';
  END IF;

  IF BTRIM(COALESCE(p_ranking_data#>>'{scope_json,target}', '')) = ''
     OR BTRIM(COALESCE(p_ranking_data#>>'{scope_json,period}', '')) = ''
     OR BTRIM(COALESCE(p_ranking_data#>>'{scope_json,method}', '')) = '' THEN
    RAISE EXCEPTION '후보군 범위 정보가 누락되었습니다.' USING ERRCODE = '23514';
  END IF;

  IF v_subcategory_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.subcategories
    WHERE id = v_subcategory_id
      AND category_id = v_category_id
  ) THEN
    RAISE EXCEPTION '카테고리와 서브카테고리 관계가 올바르지 않습니다.' USING ERRCODE = '23514';
  END IF;

  IF jsonb_array_length(p_criteria) < 1 THEN
    RAISE EXCEPTION '평가 기준이 최소 1개 필요합니다.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_criteria) AS c(name TEXT, sort_order INTEGER)
    WHERE BTRIM(COALESCE(c.name, '')) = ''
       OR c.sort_order IS NULL
       OR c.sort_order < 0
  ) THEN
    RAISE EXCEPTION '평가 기준 값이 올바르지 않습니다.' USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT e.position), COUNT(DISTINCT e.item_id)
  INTO v_entry_count, v_distinct_positions, v_distinct_items
  FROM jsonb_to_recordset(p_entries) AS e(item_id UUID, position INTEGER, reason TEXT);

  IF v_entry_count < 1 THEN
    RAISE EXCEPTION '순위 항목이 최소 1개 필요합니다.' USING ERRCODE = '23514';
  END IF;

  IF v_entry_count <> v_distinct_positions OR v_entry_count <> v_distinct_items THEN
    RAISE EXCEPTION '중복된 순위 또는 아이템이 있습니다.' USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_entries) AS e(item_id UUID, position INTEGER, reason TEXT)
    WHERE e.item_id IS NULL
       OR e.position IS NULL
       OR e.position < 1
       OR BTRIM(COALESCE(e.reason, '')) = ''
  ) THEN
    RAISE EXCEPTION '순위 항목 값이 올바르지 않습니다.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_entries) AS e(item_id UUID)
    LEFT JOIN public.items i ON i.id = e.item_id
    WHERE i.id IS NULL
  ) THEN
    RAISE EXCEPTION '존재하지 않는 아이템이 포함되어 있습니다.' USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM UNNEST(COALESCE(p_facet_ids, ARRAY[]::UUID[])) AS requested_facet_id
    LEFT JOIN public.facets f ON f.id = requested_facet_id
    WHERE f.id IS NULL
  ) THEN
    RAISE EXCEPTION '존재하지 않는 페이셋이 포함되어 있습니다.' USING ERRCODE = '23503';
  END IF;

  IF CARDINALITY(COALESCE(p_facet_ids, ARRAY[]::UUID[])) <>
     (SELECT COUNT(DISTINCT facet_id) FROM UNNEST(COALESCE(p_facet_ids, ARRAY[]::UUID[])) AS facet_id) THEN
    RAISE EXCEPTION '중복된 페이셋이 포함되어 있습니다.' USING ERRCODE = '23505';
  END IF;

  UPDATE public.rankings
  SET category_id = v_category_id,
      subcategory_id = v_subcategory_id,
      title = BTRIM(p_ranking_data->>'title'),
      slug = LOWER(BTRIM(p_ranking_data->>'slug')),
      summary = BTRIM(p_ranking_data->>'summary'),
      body = NULLIF(p_ranking_data->>'body', ''),
      ranking_type = p_ranking_data->>'ranking_type',
      scope_json = COALESCE(p_ranking_data->'scope_json', '{}'::JSONB),
      featured = COALESCE((p_ranking_data->>'featured')::BOOLEAN, FALSE),
      cover_image_url = NULLIF(p_ranking_data->>'cover_image_url', ''),
      seo_title = NULLIF(p_ranking_data->>'seo_title', ''),
      seo_description = NULLIF(p_ranking_data->>'seo_description', ''),
      moderation_status = COALESCE(NULLIF(p_ranking_data->>'moderation_status', ''), 'needs_review'),
      moderation_reason = COALESCE(NULLIF(p_ranking_data->>'moderation_reason', ''), 'system_error'),
      moderation_reviewed_by = NULL,
      moderation_reviewed_at = NULL,
      moderation_review_note = NULL,
      status = 'draft',
      published_at = NULL,
      updated_by = auth.uid()
  WHERE id = p_ranking_id
  RETURNING updated_at INTO v_new_updated_at;

  DELETE FROM public.ranking_criteria WHERE ranking_id = p_ranking_id;
  INSERT INTO public.ranking_criteria (ranking_id, name, description, weight, sort_order)
  SELECT p_ranking_id, BTRIM(c.name), NULLIF(c.description, ''), c.weight, c.sort_order
  FROM jsonb_to_recordset(p_criteria) AS c(name TEXT, description TEXT, weight NUMERIC, sort_order INTEGER);

  DELETE FROM public.ranking_sources WHERE ranking_id = p_ranking_id;
  INSERT INTO public.ranking_sources (ranking_id, label, url, source_type, note, is_public)
  SELECT p_ranking_id, BTRIM(s.label), NULLIF(s.url, ''), NULLIF(s.source_type, ''), NULLIF(s.note, ''), COALESCE(s.is_public, TRUE)
  FROM jsonb_to_recordset(p_sources) AS s(label TEXT, url TEXT, source_type TEXT, note TEXT, is_public BOOLEAN)
  WHERE BTRIM(COALESCE(s.label, '')) <> '';

  DELETE FROM public.ranking_entries WHERE ranking_id = p_ranking_id;
  INSERT INTO public.ranking_entries (
    ranking_id, item_id, position, reason, editor_score, score_json, internal_note,
    sponsor_flag, moderation_status, moderation_reason, moderation_reviewed_by,
    moderation_reviewed_at, moderation_review_note
  )
  SELECT
    p_ranking_id, e.item_id, e.position, BTRIM(e.reason), e.editor_score,
    COALESCE(e.score_json, '{}'::JSONB), NULLIF(e.internal_note, ''),
    COALESCE(e.sponsor_flag, FALSE),
    COALESCE(NULLIF(e.moderation_status, ''), 'needs_review'),
    COALESCE(NULLIF(e.moderation_reason, ''), 'system_error'),
    NULL, NULL, NULL
  FROM jsonb_to_recordset(p_entries) AS e(
    item_id UUID, position INTEGER, reason TEXT, editor_score NUMERIC,
    score_json JSONB, internal_note TEXT, sponsor_flag BOOLEAN,
    moderation_status TEXT, moderation_reason TEXT
  );

  DELETE FROM public.ranking_facets WHERE ranking_id = p_ranking_id;
  INSERT INTO public.ranking_facets (ranking_id, facet_id)
  SELECT p_ranking_id, facet_id
  FROM UNNEST(COALESCE(p_facet_ids, ARRAY[]::UUID[])) AS facet_id;

  RETURN JSONB_BUILD_OBJECT(
    'ranking_id', p_ranking_id,
    'status', 'draft',
    'was_published', v_was_published,
    'updated_at', v_new_updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_ranking_e2e(UUID, JSONB, JSONB, JSONB, JSONB, UUID[], TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_ranking_e2e(UUID, JSONB, JSONB, JSONB, JSONB, UUID[], TIMESTAMPTZ) TO authenticated;

COMMIT;
