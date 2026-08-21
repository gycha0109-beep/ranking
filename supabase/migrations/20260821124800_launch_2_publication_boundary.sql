-- LAUNCH-2: Public Publication Boundary & Index Hygiene
-- Draft/editor assets remain available to admins, but public discovery requires
-- an actual published, moderation-safe ranking relationship.

DROP POLICY IF EXISTS "Items viewable by everyone if active" ON public.items;
CREATE POLICY "Items viewable by everyone if active"
ON public.items
FOR SELECT
USING (
  is_admin()
  OR (
    auth.role() = 'anon'
    AND status = 'active'
    AND moderation_status IN ('clean', 'suggestive')
    AND image_moderation_status IN ('clean', 'suggestive')
    AND EXISTS (
      SELECT 1
      FROM public.ranking_entries re
      JOIN public.rankings r ON r.id = re.ranking_id
      WHERE re.item_id = items.id
        AND re.moderation_status IN ('clean', 'suggestive')
        AND r.status = 'published'
        AND r.moderation_status IN ('clean', 'suggestive')
        AND r.image_moderation_status IN ('clean', 'suggestive')
    )
  )
);

DROP POLICY IF EXISTS "Categories viewable by everyone if visible" ON public.categories;
CREATE POLICY "Categories viewable by everyone if visible"
ON public.categories
FOR SELECT
USING (
  is_admin()
  OR (
    is_visible = TRUE
    AND EXISTS (
      SELECT 1
      FROM public.rankings r
      WHERE r.category_id = categories.id
        AND r.status = 'published'
        AND r.moderation_status IN ('clean', 'suggestive')
        AND r.image_moderation_status IN ('clean', 'suggestive')
    )
  )
);

DROP POLICY IF EXISTS "Subcategories viewable by everyone if visible" ON public.subcategories;
CREATE POLICY "Subcategories viewable by everyone if visible"
ON public.subcategories
FOR SELECT
USING (
  is_admin()
  OR (
    is_visible = TRUE
    AND EXISTS (
      SELECT 1
      FROM public.categories c
      WHERE c.id = subcategories.category_id
        AND c.is_visible = TRUE
    )
    AND EXISTS (
      SELECT 1
      FROM public.rankings r
      WHERE r.subcategory_id = subcategories.id
        AND r.status = 'published'
        AND r.moderation_status IN ('clean', 'suggestive')
        AND r.image_moderation_status IN ('clean', 'suggestive')
    )
  )
);

-- search_public_content is SECURITY DEFINER, so RLS alone cannot protect draft-only
-- Item rows. Preserve the P1-3 base matcher/cursor semantics, but filter Item rows
-- through the same published-membership boundary before returning them.
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
RETURNS TABLE(
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
SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
DECLARE
  v_kind TEXT := pg_catalog.lower(COALESCE(p_kind, 'all'));
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

      IF (
        v_row.content_kind = 'ranking'
        OR EXISTS (
          SELECT 1
          FROM public.ranking_entries re
          JOIN public.rankings r ON r.id = re.ranking_id
          WHERE re.item_id = v_row.id
            AND re.moderation_status IN ('clean', 'suggestive')
            AND r.status = 'published'
            AND r.moderation_status IN ('clean', 'suggestive')
            AND r.image_moderation_status IN ('clean', 'suggestive')
        )
      )
      AND (
        pg_catalog.cardinality(v_facet_ids) = 0
        OR private.p1_4_content_matches_facets(v_row.content_kind, v_row.id, v_facet_ids)
      ) THEN
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

-- Item facet options are also produced by a SECURITY DEFINER function. Do not
-- advertise facet values that exist only on draft-only Item assets.
CREATE OR REPLACE FUNCTION public.list_public_facet_options(
  p_kind TEXT DEFAULT 'all',
  p_category_slug TEXT DEFAULT NULL,
  p_subcategory_slug TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 200
)
RETURNS TABLE(
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
SET search_path TO 'pg_catalog', 'pg_temp'
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
            AND EXISTS (
              SELECT 1
              FROM public.ranking_entries re
              JOIN public.rankings r ON r.id = re.ranking_id
              WHERE re.item_id = i.id
                AND re.moderation_status IN ('clean', 'suggestive')
                AND r.status = 'published'
                AND r.moderation_status IN ('clean', 'suggestive')
                AND r.image_moderation_status IN ('clean', 'suggestive')
            )
        )
      )
    )
  ORDER BY fg.name ASC, fg.id ASC, f.name ASC, f.id ASC
  LIMIT v_limit;
END;
$$;

COMMENT ON POLICY "Items viewable by everyone if active" ON public.items IS
  'LAUNCH-2: anon Item read requires active/moderation-safe state plus membership through a public-safe ranking entry.';
COMMENT ON POLICY "Categories viewable by everyone if visible" ON public.categories IS
  'LAUNCH-2: visible categories are public only when they contain at least one public-safe published ranking.';
COMMENT ON POLICY "Subcategories viewable by everyone if visible" ON public.subcategories IS
  'LAUNCH-2: visible subcategories are public only with a visible parent and at least one public-safe published ranking.';
