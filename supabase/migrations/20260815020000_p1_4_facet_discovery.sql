BEGIN;

CREATE OR REPLACE FUNCTION private.p1_4_validate_facet_ids(
  p_facet_ids UUID[],
  p_kind TEXT
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_kind TEXT := pg_catalog.lower(COALESCE(p_kind, 'all'));
  v_ids UUID[];
  v_count INTEGER;
BEGIN
  IF v_kind NOT IN ('all', 'ranking', 'item') THEN
    RAISE EXCEPTION 'Facet 대상이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(pg_catalog.array_agg(x.id ORDER BY x.id), '{}'::UUID[])
  INTO v_ids
  FROM (
    SELECT DISTINCT u.id
    FROM pg_catalog.unnest(COALESCE(p_facet_ids, '{}'::UUID[])) AS u(id)
  ) x;

  v_count := pg_catalog.cardinality(v_ids);
  IF v_count > 12 THEN
    RAISE EXCEPTION 'Facet 필터는 최대 12개까지 선택할 수 있습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_count = 0 THEN
    RETURN v_ids;
  END IF;

  IF (
    SELECT pg_catalog.count(*)
    FROM public.facets f
    JOIN public.facet_groups fg ON fg.id = f.facet_group_id
    WHERE f.id = ANY(v_ids)
      AND (
        (v_kind = 'all' AND fg.applies_to = 'both')
        OR (v_kind = 'ranking' AND fg.applies_to IN ('ranking', 'both'))
        OR (v_kind = 'item' AND fg.applies_to IN ('item', 'both'))
      )
  ) <> v_count THEN
    RAISE EXCEPTION '존재하지 않거나 대상과 호환되지 않는 Facet 필터가 포함되어 있습니다.' USING ERRCODE = '22023';
  END IF;

  RETURN v_ids;
END;
$$;

REVOKE ALL ON FUNCTION private.p1_4_validate_facet_ids(UUID[], TEXT)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.p1_4_content_matches_facets(
  p_content_kind TEXT,
  p_content_id UUID,
  p_facet_ids UUID[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
  WITH selected_groups AS (
    SELECT
      f.facet_group_id,
      pg_catalog.array_agg(f.id ORDER BY f.id) AS facet_ids
    FROM public.facets f
    WHERE f.id = ANY(COALESCE(p_facet_ids, '{}'::UUID[]))
    GROUP BY f.facet_group_id
  )
  SELECT
    pg_catalog.cardinality(COALESCE(p_facet_ids, '{}'::UUID[])) = 0
    OR NOT EXISTS (
      SELECT 1
      FROM selected_groups sg
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.ranking_facets rf
        WHERE p_content_kind = 'ranking'
          AND rf.ranking_id = p_content_id
          AND rf.facet_id = ANY(sg.facet_ids)
        UNION ALL
        SELECT 1
        FROM public.item_facets itf
        WHERE p_content_kind = 'item'
          AND itf.item_id = p_content_id
          AND itf.facet_id = ANY(sg.facet_ids)
      )
    );
$$;

REVOKE ALL ON FUNCTION private.p1_4_content_matches_facets(TEXT, UUID, UUID[])
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_public_facet_options(
  p_kind TEXT DEFAULT 'all',
  p_category_slug TEXT DEFAULT NULL,
  p_subcategory_slug TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 200
)
RETURNS TABLE (
  group_id UUID,
  group_code TEXT,
  group_name TEXT,
  applies_to TEXT,
  facet_id UUID,
  facet_slug TEXT,
  facet_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_kind TEXT := pg_catalog.lower(COALESCE(p_kind, 'all'));
  v_limit INTEGER := COALESCE(p_limit, 200);
BEGIN
  IF v_kind NOT IN ('all', 'ranking', 'item') THEN
    RAISE EXCEPTION 'Facet 옵션 대상이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_limit < 1 OR v_limit > 500 THEN
    RAISE EXCEPTION 'Facet 옵션 limit은 1 이상 500 이하여야 합니다.' USING ERRCODE = '22023';
  END IF;

  IF (p_category_slug IS NOT NULL OR p_subcategory_slug IS NOT NULL) AND v_kind <> 'ranking' THEN
    RAISE EXCEPTION '카테고리 Facet 컨텍스트는 ranking 대상에서만 사용할 수 있습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_subcategory_slug IS NOT NULL AND p_category_slug IS NULL THEN
    RAISE EXCEPTION '세부 카테고리 컨텍스트에는 상위 카테고리가 필요합니다.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    fg.id,
    fg.code,
    fg.name,
    fg.applies_to,
    f.id,
    f.slug,
    f.name
  FROM public.facet_groups fg
  JOIN public.facets f ON f.facet_group_id = fg.id
  WHERE (
      (v_kind = 'all' AND fg.applies_to = 'both')
      OR (v_kind = 'ranking' AND fg.applies_to IN ('ranking', 'both'))
      OR (v_kind = 'item' AND fg.applies_to IN ('item', 'both'))
    )
    AND (
      (
        v_kind IN ('all', 'ranking')
        AND EXISTS (
          SELECT 1
          FROM public.ranking_facets rf
          JOIN public.rankings r ON r.id = rf.ranking_id
          LEFT JOIN public.categories c ON c.id = r.category_id
          LEFT JOIN public.subcategories s ON s.id = r.subcategory_id
          WHERE rf.facet_id = f.id
            AND r.status = 'published'
            AND r.moderation_status IN ('clean', 'suggestive')
            AND r.image_moderation_status IN ('clean', 'suggestive')
            AND (
              p_category_slug IS NULL
              OR (c.is_visible = TRUE AND c.slug = p_category_slug)
            )
            AND (
              p_subcategory_slug IS NULL
              OR (s.is_visible = TRUE AND s.slug = p_subcategory_slug)
            )
        )
      )
      OR (
        v_kind IN ('all', 'item')
        AND EXISTS (
          SELECT 1
          FROM public.item_facets itf
          JOIN public.items i ON i.id = itf.item_id
          WHERE itf.facet_id = f.id
            AND i.status = 'active'
            AND i.moderation_status IN ('clean', 'suggestive')
            AND i.image_moderation_status IN ('clean', 'suggestive')
        )
      )
    )
  ORDER BY fg.name ASC, fg.id ASC, f.name ASC, f.id ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.list_public_facet_options(TEXT, TEXT, TEXT, INTEGER)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_facet_options(TEXT, TEXT, TEXT, INTEGER)
TO anon, authenticated;

ALTER FUNCTION public.search_public_content(
  TEXT, TEXT, TEXT, INTEGER, INTEGER, BIGINT, BIGINT, TIMESTAMPTZ, TEXT, UUID
) SET SCHEMA private;
ALTER FUNCTION private.search_public_content(
  TEXT, TEXT, TEXT, INTEGER, INTEGER, BIGINT, BIGINT, TIMESTAMPTZ, TEXT, UUID
) RENAME TO p1_3_search_public_content_base;
REVOKE ALL ON FUNCTION private.p1_3_search_public_content_base(
  TEXT, TEXT, TEXT, INTEGER, INTEGER, BIGINT, BIGINT, TIMESTAMPTZ, TEXT, UUID
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_public_content(
  p_query TEXT,
  p_kind TEXT DEFAULT 'all',
  p_sort TEXT DEFAULT 'relevance',
  p_limit INTEGER DEFAULT 20,
  p_cursor_relevance INTEGER DEFAULT NULL,
  p_cursor_views BIGINT DEFAULT NULL,
  p_cursor_likes BIGINT DEFAULT NULL,
  p_cursor_time TIMESTAMPTZ DEFAULT NULL,
  p_cursor_kind TEXT DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_facet_ids UUID[] DEFAULT '{}'::UUID[]
)
RETURNS TABLE (
  content_kind TEXT,
  id UUID,
  slug TEXT,
  title TEXT,
  description TEXT,
  image_url TEXT,
  category_name TEXT,
  category_slug TEXT,
  subcategory_name TEXT,
  subcategory_slug TEXT,
  item_type TEXT,
  brand_or_creator TEXT,
  sort_time TIMESTAMPTZ,
  relevance_score INTEGER,
  unique_view_count BIGINT,
  like_count BIGINT,
  match_reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_kind TEXT := pg_catalog.lower(COALESCE(p_kind, 'all'));
  v_sort TEXT := pg_catalog.lower(COALESCE(p_sort, 'relevance'));
  v_limit INTEGER := COALESCE(p_limit, 20);
  v_facet_ids UUID[];
  v_returned INTEGER := 0;
  v_batch_count INTEGER;
  v_row RECORD;
  v_cursor_relevance INTEGER := p_cursor_relevance;
  v_cursor_views BIGINT := p_cursor_views;
  v_cursor_likes BIGINT := p_cursor_likes;
  v_cursor_time TIMESTAMPTZ := p_cursor_time;
  v_cursor_kind TEXT := p_cursor_kind;
  v_cursor_id UUID := p_cursor_id;
BEGIN
  IF v_limit < 1 OR v_limit > 50 THEN
    RAISE EXCEPTION '검색 limit은 1 이상 50 이하여야 합니다.' USING ERRCODE = '22023';
  END IF;

  v_facet_ids := private.p1_4_validate_facet_ids(p_facet_ids, v_kind);

  IF pg_catalog.cardinality(v_facet_ids) = 0 THEN
    RETURN QUERY
    SELECT *
    FROM private.p1_3_search_public_content_base(
      p_query, p_kind, p_sort, p_limit,
      p_cursor_relevance, p_cursor_views, p_cursor_likes,
      p_cursor_time, p_cursor_kind, p_cursor_id
    );
    RETURN;
  END IF;

  LOOP
    v_batch_count := 0;

    FOR v_row IN
      SELECT *
      FROM private.p1_3_search_public_content_base(
        p_query, p_kind, p_sort, 50,
        v_cursor_relevance, v_cursor_views, v_cursor_likes,
        v_cursor_time, v_cursor_kind, v_cursor_id
      )
    LOOP
      v_batch_count := v_batch_count + 1;
      v_cursor_relevance := v_row.relevance_score;
      v_cursor_views := v_row.unique_view_count;
      v_cursor_likes := v_row.like_count;
      v_cursor_time := v_row.sort_time;
      v_cursor_kind := v_row.content_kind;
      v_cursor_id := v_row.id;

      IF private.p1_4_content_matches_facets(v_row.content_kind, v_row.id, v_facet_ids) THEN
        content_kind := v_row.content_kind;
        id := v_row.id;
        slug := v_row.slug;
        title := v_row.title;
        description := v_row.description;
        image_url := v_row.image_url;
        category_name := v_row.category_name;
        category_slug := v_row.category_slug;
        subcategory_name := v_row.subcategory_name;
        subcategory_slug := v_row.subcategory_slug;
        item_type := v_row.item_type;
        brand_or_creator := v_row.brand_or_creator;
        sort_time := v_row.sort_time;
        relevance_score := v_row.relevance_score;
        unique_view_count := v_row.unique_view_count;
        like_count := v_row.like_count;
        match_reason := v_row.match_reason;
        RETURN NEXT;

        v_returned := v_returned + 1;
        IF v_returned >= v_limit THEN
          RETURN;
        END IF;
      END IF;
    END LOOP;

    IF v_batch_count < 50 THEN
      RETURN;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.search_public_content(
  TEXT, TEXT, TEXT, INTEGER, INTEGER, BIGINT, BIGINT, TIMESTAMPTZ, TEXT, UUID, UUID[]
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_content(
  TEXT, TEXT, TEXT, INTEGER, INTEGER, BIGINT, BIGINT, TIMESTAMPTZ, TEXT, UUID, UUID[]
) TO anon, authenticated;

ALTER FUNCTION public.list_public_rankings(
  TEXT, TEXT, TEXT, INTEGER, BIGINT, BIGINT, TIMESTAMPTZ, UUID
) SET SCHEMA private;
ALTER FUNCTION private.list_public_rankings(
  TEXT, TEXT, TEXT, INTEGER, BIGINT, BIGINT, TIMESTAMPTZ, UUID
) RENAME TO p1_3_list_public_rankings_base;
REVOKE ALL ON FUNCTION private.p1_3_list_public_rankings_base(
  TEXT, TEXT, TEXT, INTEGER, BIGINT, BIGINT, TIMESTAMPTZ, UUID
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_public_rankings(
  p_category_slug TEXT,
  p_subcategory_slug TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'latest',
  p_limit INTEGER DEFAULT 20,
  p_cursor_views BIGINT DEFAULT NULL,
  p_cursor_likes BIGINT DEFAULT NULL,
  p_cursor_time TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_facet_ids UUID[] DEFAULT '{}'::UUID[]
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  summary TEXT,
  ranking_type TEXT,
  cover_image_url TEXT,
  published_at TIMESTAMPTZ,
  sort_time TIMESTAMPTZ,
  category_name TEXT,
  category_slug TEXT,
  subcategory_name TEXT,
  subcategory_slug TEXT,
  unique_view_count BIGINT,
  like_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_sort TEXT := pg_catalog.lower(COALESCE(p_sort, 'latest'));
  v_limit INTEGER := COALESCE(p_limit, 20);
  v_facet_ids UUID[];
  v_returned INTEGER := 0;
  v_batch_count INTEGER;
  v_row RECORD;
  v_cursor_views BIGINT := p_cursor_views;
  v_cursor_likes BIGINT := p_cursor_likes;
  v_cursor_time TIMESTAMPTZ := p_cursor_time;
  v_cursor_id UUID := p_cursor_id;
BEGIN
  IF v_limit < 1 OR v_limit > 50 THEN
    RAISE EXCEPTION '탐색 limit은 1 이상 50 이하여야 합니다.' USING ERRCODE = '22023';
  END IF;

  v_facet_ids := private.p1_4_validate_facet_ids(p_facet_ids, 'ranking');

  IF pg_catalog.cardinality(v_facet_ids) = 0 THEN
    RETURN QUERY
    SELECT *
    FROM private.p1_3_list_public_rankings_base(
      p_category_slug, p_subcategory_slug, p_sort, p_limit,
      p_cursor_views, p_cursor_likes, p_cursor_time, p_cursor_id
    );
    RETURN;
  END IF;

  LOOP
    v_batch_count := 0;

    FOR v_row IN
      SELECT *
      FROM private.p1_3_list_public_rankings_base(
        p_category_slug, p_subcategory_slug, p_sort, 50,
        v_cursor_views, v_cursor_likes, v_cursor_time, v_cursor_id
      )
    LOOP
      v_batch_count := v_batch_count + 1;
      v_cursor_views := v_row.unique_view_count;
      v_cursor_likes := v_row.like_count;
      v_cursor_time := v_row.sort_time;
      v_cursor_id := v_row.id;

      IF private.p1_4_content_matches_facets('ranking', v_row.id, v_facet_ids) THEN
        id := v_row.id;
        slug := v_row.slug;
        title := v_row.title;
        summary := v_row.summary;
        ranking_type := v_row.ranking_type;
        cover_image_url := v_row.cover_image_url;
        published_at := v_row.published_at;
        sort_time := v_row.sort_time;
        category_name := v_row.category_name;
        category_slug := v_row.category_slug;
        subcategory_name := v_row.subcategory_name;
        subcategory_slug := v_row.subcategory_slug;
        unique_view_count := v_row.unique_view_count;
        like_count := v_row.like_count;
        RETURN NEXT;

        v_returned := v_returned + 1;
        IF v_returned >= v_limit THEN
          RETURN;
        END IF;
      END IF;
    END LOOP;

    IF v_batch_count < 50 THEN
      RETURN;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.list_public_rankings(
  TEXT, TEXT, TEXT, INTEGER, BIGINT, BIGINT, TIMESTAMPTZ, UUID, UUID[]
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_rankings(
  TEXT, TEXT, TEXT, INTEGER, BIGINT, BIGINT, TIMESTAMPTZ, UUID, UUID[]
) TO anon, authenticated;

COMMIT;
