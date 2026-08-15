BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION private.p1_3_normalize_search_text(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT pg_catalog.lower(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.normalize(COALESCE(p_text, ''), 'NFKC'),
        '[[:space:]]+',
        ' ',
        'g'
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION private.p1_3_normalize_search_text(TEXT)
FROM PUBLIC, anon, authenticated;

ALTER TABLE public.rankings
ADD COLUMN search_text TEXT GENERATED ALWAYS AS (
  pg_catalog.lower(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.normalize(
          COALESCE(title, '') || ' ' || COALESCE(summary, '') || ' ' || COALESCE(body, ''),
          'NFKC'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    )
  )
) STORED;

ALTER TABLE public.items
ADD COLUMN search_text TEXT GENERATED ALWAYS AS (
  pg_catalog.lower(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.normalize(
          COALESCE(title, '') || ' ' || COALESCE(brand_or_creator, '') || ' ' || COALESCE(item_type, '') || ' ' || COALESCE(description, ''),
          'NFKC'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    )
  )
) STORED;

ALTER TABLE public.categories
ADD COLUMN search_name TEXT GENERATED ALWAYS AS (
  pg_catalog.lower(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.normalize(COALESCE(name, ''), 'NFKC'),
        '[[:space:]]+',
        ' ',
        'g'
      )
    )
  )
) STORED;

ALTER TABLE public.subcategories
ADD COLUMN search_name TEXT GENERATED ALWAYS AS (
  pg_catalog.lower(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.normalize(COALESCE(name, ''), 'NFKC'),
        '[[:space:]]+',
        ' ',
        'g'
      )
    )
  )
) STORED;

ALTER TABLE public.facets
ADD COLUMN search_name TEXT GENERATED ALWAYS AS (
  pg_catalog.lower(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.normalize(COALESCE(name, ''), 'NFKC'),
        '[[:space:]]+',
        ' ',
        'g'
      )
    )
  )
) STORED;

CREATE INDEX idx_rankings_p1_3_search_trgm
ON public.rankings
USING gin (search_text extensions.gin_trgm_ops)
WHERE status = 'published'
  AND moderation_status IN ('clean', 'suggestive')
  AND image_moderation_status IN ('clean', 'suggestive');

CREATE INDEX idx_items_p1_3_search_trgm
ON public.items
USING gin (search_text extensions.gin_trgm_ops)
WHERE status = 'active'
  AND moderation_status IN ('clean', 'suggestive')
  AND image_moderation_status IN ('clean', 'suggestive');

CREATE INDEX idx_categories_p1_3_name_trgm
ON public.categories
USING gin (search_name extensions.gin_trgm_ops)
WHERE is_visible = TRUE;

CREATE INDEX idx_subcategories_p1_3_name_trgm
ON public.subcategories
USING gin (search_name extensions.gin_trgm_ops)
WHERE is_visible = TRUE;

CREATE INDEX idx_facets_p1_3_name_trgm
ON public.facets
USING gin (search_name extensions.gin_trgm_ops);

CREATE INDEX idx_ranking_facets_p1_3_reverse
ON public.ranking_facets(facet_id, ranking_id);

CREATE INDEX idx_item_facets_p1_3_reverse
ON public.item_facets(facet_id, item_id);

CREATE INDEX idx_rankings_p1_3_category_latest
ON public.rankings(
  category_id,
  (COALESCE(published_at, updated_at, created_at)) DESC,
  id ASC
)
WHERE status = 'published'
  AND moderation_status IN ('clean', 'suggestive')
  AND image_moderation_status IN ('clean', 'suggestive');

CREATE INDEX idx_rankings_p1_3_subcategory_latest
ON public.rankings(
  subcategory_id,
  (COALESCE(published_at, updated_at, created_at)) DESC,
  id ASC
)
WHERE subcategory_id IS NOT NULL
  AND status = 'published'
  AND moderation_status IN ('clean', 'suggestive')
  AND image_moderation_status IN ('clean', 'suggestive');

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
  p_cursor_id UUID DEFAULT NULL
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
  v_query TEXT := private.p1_3_normalize_search_text(p_query);
  v_kind TEXT := pg_catalog.lower(COALESCE(p_kind, 'all'));
  v_sort TEXT := pg_catalog.lower(COALESCE(p_sort, 'relevance'));
  v_limit INTEGER := COALESCE(p_limit, 20);
  v_query_length INTEGER;
  v_escaped TEXT;
  v_prefix TEXT;
  v_contains TEXT;
BEGIN
  v_query_length := pg_catalog.char_length(v_query);

  IF v_query_length < 2 OR v_query_length > 120 THEN
    RAISE EXCEPTION '검색어는 2자 이상 120자 이하여야 합니다.' USING ERRCODE = '22023';
  END IF;

  IF v_kind NOT IN ('all', 'ranking', 'item') THEN
    RAISE EXCEPTION '검색 대상이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_sort NOT IN ('relevance', 'latest', 'popular') THEN
    RAISE EXCEPTION '검색 정렬이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_limit < 1 OR v_limit > 50 THEN
    RAISE EXCEPTION '검색 limit은 1 이상 50 이하여야 합니다.' USING ERRCODE = '22023';
  END IF;

  IF p_cursor_id IS NULL THEN
    IF p_cursor_relevance IS NOT NULL
      OR p_cursor_views IS NOT NULL
      OR p_cursor_likes IS NOT NULL
      OR p_cursor_time IS NOT NULL
      OR p_cursor_kind IS NOT NULL THEN
      RAISE EXCEPTION '검색 cursor가 완전하지 않습니다.' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_cursor_time IS NULL OR p_cursor_kind IS NULL THEN
      RAISE EXCEPTION '검색 cursor가 완전하지 않습니다.' USING ERRCODE = '22023';
    END IF;

    IF p_cursor_kind NOT IN ('ranking', 'item') THEN
      RAISE EXCEPTION '검색 cursor kind가 올바르지 않습니다.' USING ERRCODE = '22023';
    END IF;

    IF v_sort = 'relevance' AND p_cursor_relevance IS NULL THEN
      RAISE EXCEPTION 'relevance cursor가 완전하지 않습니다.' USING ERRCODE = '22023';
    END IF;

    IF v_sort = 'popular' AND (p_cursor_views IS NULL OR p_cursor_likes IS NULL) THEN
      RAISE EXCEPTION 'popular cursor가 완전하지 않습니다.' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_escaped := pg_catalog.replace(
    pg_catalog.replace(
      pg_catalog.replace(v_query, E'\\', E'\\\\'),
      '%',
      E'\\%'
    ),
    '_',
    E'\\_'
  );
  v_prefix := v_escaped || '%';
  v_contains := '%' || v_escaped || '%';

  RETURN QUERY
  WITH category_hits AS (
    SELECT
      c.id,
      c.search_name = v_query AS is_exact,
      c.search_name LIKE v_prefix ESCAPE E'\\' AS is_prefix,
      CASE
        WHEN v_query_length >= 3 THEN
          c.search_name LIKE v_contains ESCAPE E'\\'
          OR c.search_name OPERATOR(extensions.%>) v_query
        ELSE FALSE
      END AS is_long_match,
      CASE
        WHEN v_query_length >= 3 THEN extensions.word_similarity(v_query, c.search_name)
        ELSE 0::REAL
      END AS similarity
    FROM public.categories c
    WHERE c.is_visible = TRUE
      AND (
        (v_query_length = 2 AND c.search_name LIKE v_prefix ESCAPE E'\\')
        OR
        (v_query_length >= 3 AND (
          c.search_name LIKE v_contains ESCAPE E'\\'
          OR c.search_name OPERATOR(extensions.%>) v_query
        ))
      )
  ),
  subcategory_hits AS (
    SELECT
      s.id,
      s.search_name = v_query AS is_exact,
      s.search_name LIKE v_prefix ESCAPE E'\\' AS is_prefix,
      CASE
        WHEN v_query_length >= 3 THEN
          s.search_name LIKE v_contains ESCAPE E'\\'
          OR s.search_name OPERATOR(extensions.%>) v_query
        ELSE FALSE
      END AS is_long_match,
      CASE
        WHEN v_query_length >= 3 THEN extensions.word_similarity(v_query, s.search_name)
        ELSE 0::REAL
      END AS similarity
    FROM public.subcategories s
    WHERE s.is_visible = TRUE
      AND (
        (v_query_length = 2 AND s.search_name LIKE v_prefix ESCAPE E'\\')
        OR
        (v_query_length >= 3 AND (
          s.search_name LIKE v_contains ESCAPE E'\\'
          OR s.search_name OPERATOR(extensions.%>) v_query
        ))
      )
  ),
  facet_hits AS (
    SELECT
      f.id,
      f.search_name = v_query AS is_exact,
      f.search_name LIKE v_prefix ESCAPE E'\\' AS is_prefix,
      CASE
        WHEN v_query_length >= 3 THEN
          f.search_name LIKE v_contains ESCAPE E'\\'
          OR f.search_name OPERATOR(extensions.%>) v_query
        ELSE FALSE
      END AS is_long_match,
      CASE
        WHEN v_query_length >= 3 THEN extensions.word_similarity(v_query, f.search_name)
        ELSE 0::REAL
      END AS similarity
    FROM public.facets f
    WHERE (
      (v_query_length = 2 AND f.search_name LIKE v_prefix ESCAPE E'\\')
      OR
      (v_query_length >= 3 AND (
        f.search_name LIKE v_contains ESCAPE E'\\'
        OR f.search_name OPERATOR(extensions.%>) v_query
      ))
    )
  ),
  ranking_facet_hits AS (
    SELECT
      rf.ranking_id,
      pg_catalog.bool_or(fh.is_exact) AS is_exact,
      pg_catalog.bool_or(fh.is_prefix) AS is_prefix,
      pg_catalog.bool_or(fh.is_long_match) AS is_long_match,
      COALESCE(pg_catalog.max(fh.similarity), 0::REAL) AS similarity
    FROM facet_hits fh
    JOIN public.ranking_facets rf ON rf.facet_id = fh.id
    GROUP BY rf.ranking_id
  ),
  item_facet_hits AS (
    SELECT
      ifa.item_id,
      pg_catalog.bool_or(fh.is_exact) AS is_exact,
      pg_catalog.bool_or(fh.is_prefix) AS is_prefix,
      pg_catalog.bool_or(fh.is_long_match) AS is_long_match,
      COALESCE(pg_catalog.max(fh.similarity), 0::REAL) AS similarity
    FROM facet_hits fh
    JOIN public.item_facets ifa ON ifa.facet_id = fh.id
    GROUP BY ifa.item_id
  ),
  ranking_base AS (
    SELECT
      'ranking'::TEXT AS content_kind,
      r.id,
      r.slug,
      r.title,
      r.summary AS description,
      r.cover_image_url AS image_url,
      c.name AS category_name,
      c.slug AS category_slug,
      s.name AS subcategory_name,
      s.slug AS subcategory_slug,
      NULL::TEXT AS item_type,
      NULL::TEXT AS brand_or_creator,
      COALESCE(r.published_at, r.updated_at, r.created_at) AS sort_time,
      COALESCE(vt.unique_view_count, 0)::BIGINT AS unique_view_count,
      COALESCE(lc.like_count, 0)::BIGINT AS like_count,
      n.title_norm,
      n.summary_norm,
      n.body_norm,
      ch.is_exact AS category_exact,
      ch.is_prefix AS category_prefix,
      COALESCE(ch.is_long_match, FALSE) AS category_long_match,
      sh.is_exact AS subcategory_exact,
      sh.is_prefix AS subcategory_prefix,
      COALESCE(sh.is_long_match, FALSE) AS subcategory_long_match,
      COALESCE(rfh.is_exact, FALSE) AS facet_exact,
      COALESCE(rfh.is_prefix, FALSE) AS facet_prefix,
      COALESCE(rfh.is_long_match, FALSE) AS facet_long_match,
      CASE
        WHEN v_query_length >= 3 THEN GREATEST(
          extensions.word_similarity(v_query, n.title_norm),
          extensions.word_similarity(v_query, n.summary_norm),
          extensions.word_similarity(v_query, n.body_norm),
          COALESCE(ch.similarity, 0::REAL),
          COALESCE(sh.similarity, 0::REAL),
          COALESCE(rfh.similarity, 0::REAL)
        )
        ELSE 0::REAL
      END AS fuzzy_similarity
    FROM public.rankings r
    LEFT JOIN public.categories c
      ON c.id = r.category_id
      AND c.is_visible = TRUE
    LEFT JOIN public.subcategories s
      ON s.id = r.subcategory_id
      AND s.is_visible = TRUE
    LEFT JOIN category_hits ch ON ch.id = r.category_id
    LEFT JOIN subcategory_hits sh ON sh.id = r.subcategory_id
    LEFT JOIN ranking_facet_hits rfh ON rfh.ranking_id = r.id
    LEFT JOIN public.content_view_totals vt ON vt.ranking_id = r.id
    LEFT JOIN LATERAL (
      SELECT pg_catalog.count(*)::BIGINT AS like_count
      FROM public.content_likes cl
      WHERE cl.ranking_id = r.id
    ) lc ON TRUE
    CROSS JOIN LATERAL (
      SELECT
        private.p1_3_normalize_search_text(r.title) AS title_norm,
        private.p1_3_normalize_search_text(r.summary) AS summary_norm,
        private.p1_3_normalize_search_text(r.body) AS body_norm
    ) n
    WHERE v_kind IN ('all', 'ranking')
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
      AND (
        (
          v_query_length = 2
          AND (
            n.title_norm LIKE v_prefix ESCAPE E'\\'
            OR ch.id IS NOT NULL
            OR sh.id IS NOT NULL
            OR rfh.ranking_id IS NOT NULL
          )
        )
        OR
        (
          v_query_length >= 3
          AND (
            r.search_text LIKE v_contains ESCAPE E'\\'
            OR r.search_text OPERATOR(extensions.%>) v_query
            OR ch.id IS NOT NULL
            OR sh.id IS NOT NULL
            OR rfh.ranking_id IS NOT NULL
          )
        )
      )
  ),
  ranking_scored AS (
    SELECT
      rb.content_kind,
      rb.id,
      rb.slug,
      rb.title,
      rb.description,
      rb.image_url,
      rb.category_name,
      rb.category_slug,
      rb.subcategory_name,
      rb.subcategory_slug,
      rb.item_type,
      rb.brand_or_creator,
      rb.sort_time,
      (
        CASE
          WHEN rb.title_norm = v_query THEN 120000
          WHEN rb.title_norm LIKE v_prefix ESCAPE E'\\' THEN 110000
          WHEN v_query_length >= 3 AND rb.title_norm LIKE v_contains ESCAPE E'\\' THEN 100000
          WHEN COALESCE(rb.category_exact, FALSE) OR COALESCE(rb.subcategory_exact, FALSE) THEN 90000
          WHEN COALESCE(rb.category_prefix, FALSE) OR COALESCE(rb.subcategory_prefix, FALSE) THEN 90000
          WHEN rb.facet_exact OR rb.facet_prefix THEN 80000
          WHEN rb.category_long_match OR rb.subcategory_long_match THEN 70000
          WHEN rb.facet_long_match THEN 60000
          WHEN v_query_length >= 3 AND rb.summary_norm LIKE v_contains ESCAPE E'\\' THEN 50000
          WHEN v_query_length >= 3 AND rb.body_norm LIKE v_contains ESCAPE E'\\' THEN 40000
          ELSE 10000
        END
        + CASE
            WHEN v_query_length >= 3 THEN LEAST(
              9999,
              GREATEST(0, pg_catalog.round((rb.fuzzy_similarity * 9999)::NUMERIC)::INTEGER)
            )
            ELSE 0
          END
      )::INTEGER AS relevance_score,
      rb.unique_view_count,
      rb.like_count,
      CASE
        WHEN rb.title_norm = v_query THEN 'title_exact'
        WHEN rb.title_norm LIKE v_prefix ESCAPE E'\\' THEN 'title_prefix'
        WHEN v_query_length >= 3 AND rb.title_norm LIKE v_contains ESCAPE E'\\' THEN 'title'
        WHEN COALESCE(rb.category_exact, FALSE) OR COALESCE(rb.category_prefix, FALSE) OR rb.category_long_match THEN 'category'
        WHEN COALESCE(rb.subcategory_exact, FALSE) OR COALESCE(rb.subcategory_prefix, FALSE) OR rb.subcategory_long_match THEN 'subcategory'
        WHEN rb.facet_exact OR rb.facet_prefix OR rb.facet_long_match THEN 'facet'
        WHEN v_query_length >= 3 AND rb.summary_norm LIKE v_contains ESCAPE E'\\' THEN 'summary'
        WHEN v_query_length >= 3 AND rb.body_norm LIKE v_contains ESCAPE E'\\' THEN 'body'
        ELSE 'fuzzy'
      END::TEXT AS match_reason
    FROM ranking_base rb
  ),
  item_base AS (
    SELECT
      'item'::TEXT AS content_kind,
      i.id,
      i.slug,
      i.title,
      i.description,
      i.image_url,
      NULL::TEXT AS category_name,
      NULL::TEXT AS category_slug,
      NULL::TEXT AS subcategory_name,
      NULL::TEXT AS subcategory_slug,
      i.item_type,
      i.brand_or_creator,
      COALESCE(i.created_at, i.updated_at) AS sort_time,
      COALESCE(vt.unique_view_count, 0)::BIGINT AS unique_view_count,
      COALESCE(lc.like_count, 0)::BIGINT AS like_count,
      n.title_norm,
      n.brand_norm,
      n.type_norm,
      n.description_norm,
      COALESCE(ifh.is_exact, FALSE) AS facet_exact,
      COALESCE(ifh.is_prefix, FALSE) AS facet_prefix,
      COALESCE(ifh.is_long_match, FALSE) AS facet_long_match,
      CASE
        WHEN v_query_length >= 3 THEN GREATEST(
          extensions.word_similarity(v_query, n.title_norm),
          extensions.word_similarity(v_query, n.brand_norm),
          extensions.word_similarity(v_query, n.type_norm),
          extensions.word_similarity(v_query, n.description_norm),
          COALESCE(ifh.similarity, 0::REAL)
        )
        ELSE 0::REAL
      END AS fuzzy_similarity
    FROM public.items i
    LEFT JOIN item_facet_hits ifh ON ifh.item_id = i.id
    LEFT JOIN public.content_view_totals vt ON vt.item_id = i.id
    LEFT JOIN LATERAL (
      SELECT pg_catalog.count(*)::BIGINT AS like_count
      FROM public.content_likes cl
      WHERE cl.item_id = i.id
    ) lc ON TRUE
    CROSS JOIN LATERAL (
      SELECT
        private.p1_3_normalize_search_text(i.title) AS title_norm,
        private.p1_3_normalize_search_text(i.brand_or_creator) AS brand_norm,
        private.p1_3_normalize_search_text(i.item_type) AS type_norm,
        private.p1_3_normalize_search_text(i.description) AS description_norm
    ) n
    WHERE v_kind IN ('all', 'item')
      AND i.status = 'active'
      AND i.moderation_status IN ('clean', 'suggestive')
      AND i.image_moderation_status IN ('clean', 'suggestive')
      AND (
        (
          v_query_length = 2
          AND (
            n.title_norm LIKE v_prefix ESCAPE E'\\'
            OR n.brand_norm LIKE v_prefix ESCAPE E'\\'
            OR n.type_norm LIKE v_prefix ESCAPE E'\\'
            OR ifh.item_id IS NOT NULL
          )
        )
        OR
        (
          v_query_length >= 3
          AND (
            i.search_text LIKE v_contains ESCAPE E'\\'
            OR i.search_text OPERATOR(extensions.%>) v_query
            OR ifh.item_id IS NOT NULL
          )
        )
      )
  ),
  item_scored AS (
    SELECT
      ib.content_kind,
      ib.id,
      ib.slug,
      ib.title,
      ib.description,
      ib.image_url,
      ib.category_name,
      ib.category_slug,
      ib.subcategory_name,
      ib.subcategory_slug,
      ib.item_type,
      ib.brand_or_creator,
      ib.sort_time,
      (
        CASE
          WHEN ib.title_norm = v_query THEN 120000
          WHEN ib.title_norm LIKE v_prefix ESCAPE E'\\' THEN 110000
          WHEN v_query_length >= 3 AND ib.title_norm LIKE v_contains ESCAPE E'\\' THEN 100000
          WHEN ib.brand_norm = v_query OR ib.brand_norm LIKE v_prefix ESCAPE E'\\' THEN 90000
          WHEN v_query_length >= 3 AND ib.brand_norm LIKE v_contains ESCAPE E'\\' THEN 80000
          WHEN ib.type_norm = v_query OR ib.type_norm LIKE v_prefix ESCAPE E'\\' THEN 70000
          WHEN v_query_length >= 3 AND ib.type_norm LIKE v_contains ESCAPE E'\\' THEN 60000
          WHEN ib.facet_exact OR ib.facet_prefix THEN 50000
          WHEN ib.facet_long_match THEN 40000
          WHEN v_query_length >= 3 AND ib.description_norm LIKE v_contains ESCAPE E'\\' THEN 30000
          ELSE 10000
        END
        + CASE
            WHEN v_query_length >= 3 THEN LEAST(
              9999,
              GREATEST(0, pg_catalog.round((ib.fuzzy_similarity * 9999)::NUMERIC)::INTEGER)
            )
            ELSE 0
          END
      )::INTEGER AS relevance_score,
      ib.unique_view_count,
      ib.like_count,
      CASE
        WHEN ib.title_norm = v_query THEN 'title_exact'
        WHEN ib.title_norm LIKE v_prefix ESCAPE E'\\' THEN 'title_prefix'
        WHEN v_query_length >= 3 AND ib.title_norm LIKE v_contains ESCAPE E'\\' THEN 'title'
        WHEN ib.brand_norm = v_query OR ib.brand_norm LIKE v_prefix ESCAPE E'\\' THEN 'brand'
        WHEN v_query_length >= 3 AND ib.brand_norm LIKE v_contains ESCAPE E'\\' THEN 'brand'
        WHEN ib.type_norm = v_query OR ib.type_norm LIKE v_prefix ESCAPE E'\\' THEN 'item_type'
        WHEN v_query_length >= 3 AND ib.type_norm LIKE v_contains ESCAPE E'\\' THEN 'item_type'
        WHEN ib.facet_exact OR ib.facet_prefix OR ib.facet_long_match THEN 'facet'
        WHEN v_query_length >= 3 AND ib.description_norm LIKE v_contains ESCAPE E'\\' THEN 'description'
        ELSE 'fuzzy'
      END::TEXT AS match_reason
    FROM item_base ib
  ),
  combined AS (
    SELECT * FROM ranking_scored
    UNION ALL
    SELECT * FROM item_scored
  )
  SELECT
    x.content_kind,
    x.id,
    x.slug,
    x.title,
    x.description,
    x.image_url,
    x.category_name,
    x.category_slug,
    x.subcategory_name,
    x.subcategory_slug,
    x.item_type,
    x.brand_or_creator,
    x.sort_time,
    x.relevance_score,
    x.unique_view_count,
    x.like_count,
    x.match_reason
  FROM combined x
  WHERE
    p_cursor_id IS NULL
    OR (
      v_sort = 'relevance'
      AND (
        x.relevance_score < p_cursor_relevance
        OR (x.relevance_score = p_cursor_relevance AND x.sort_time < p_cursor_time)
        OR (x.relevance_score = p_cursor_relevance AND x.sort_time = p_cursor_time AND x.content_kind > p_cursor_kind)
        OR (x.relevance_score = p_cursor_relevance AND x.sort_time = p_cursor_time AND x.content_kind = p_cursor_kind AND x.id > p_cursor_id)
      )
    )
    OR (
      v_sort = 'latest'
      AND (
        x.sort_time < p_cursor_time
        OR (x.sort_time = p_cursor_time AND x.content_kind > p_cursor_kind)
        OR (x.sort_time = p_cursor_time AND x.content_kind = p_cursor_kind AND x.id > p_cursor_id)
      )
    )
    OR (
      v_sort = 'popular'
      AND (
        x.unique_view_count < p_cursor_views
        OR (x.unique_view_count = p_cursor_views AND x.like_count < p_cursor_likes)
        OR (x.unique_view_count = p_cursor_views AND x.like_count = p_cursor_likes AND x.sort_time < p_cursor_time)
        OR (x.unique_view_count = p_cursor_views AND x.like_count = p_cursor_likes AND x.sort_time = p_cursor_time AND x.content_kind > p_cursor_kind)
        OR (x.unique_view_count = p_cursor_views AND x.like_count = p_cursor_likes AND x.sort_time = p_cursor_time AND x.content_kind = p_cursor_kind AND x.id > p_cursor_id)
      )
    )
  ORDER BY
    CASE WHEN v_sort = 'relevance' THEN x.relevance_score END DESC,
    CASE WHEN v_sort = 'popular' THEN x.unique_view_count END DESC,
    CASE WHEN v_sort = 'popular' THEN x.like_count END DESC,
    x.sort_time DESC,
    x.content_kind ASC,
    x.id ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_public_content(
  TEXT, TEXT, TEXT, INTEGER, INTEGER, BIGINT, BIGINT, TIMESTAMPTZ, TEXT, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_content(
  TEXT, TEXT, TEXT, INTEGER, INTEGER, BIGINT, BIGINT, TIMESTAMPTZ, TEXT, UUID
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_public_rankings(
  p_category_slug TEXT,
  p_subcategory_slug TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'latest',
  p_limit INTEGER DEFAULT 20,
  p_cursor_views BIGINT DEFAULT NULL,
  p_cursor_likes BIGINT DEFAULT NULL,
  p_cursor_time TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL
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
BEGIN
  IF p_category_slug IS NULL OR p_category_slug = '' THEN
    RAISE EXCEPTION '카테고리 slug가 필요합니다.' USING ERRCODE = '22023';
  END IF;

  IF v_sort NOT IN ('latest', 'popular') THEN
    RAISE EXCEPTION '탐색 정렬이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_limit < 1 OR v_limit > 50 THEN
    RAISE EXCEPTION '탐색 limit은 1 이상 50 이하여야 합니다.' USING ERRCODE = '22023';
  END IF;

  IF p_cursor_id IS NULL THEN
    IF p_cursor_views IS NOT NULL
      OR p_cursor_likes IS NOT NULL
      OR p_cursor_time IS NOT NULL THEN
      RAISE EXCEPTION '탐색 cursor가 완전하지 않습니다.' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_cursor_time IS NULL THEN
      RAISE EXCEPTION '탐색 cursor가 완전하지 않습니다.' USING ERRCODE = '22023';
    END IF;

    IF v_sort = 'popular' AND (p_cursor_views IS NULL OR p_cursor_likes IS NULL) THEN
      RAISE EXCEPTION 'popular cursor가 완전하지 않습니다.' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      r.id,
      r.slug,
      r.title,
      r.summary,
      r.ranking_type,
      r.cover_image_url,
      r.published_at,
      COALESCE(r.published_at, r.updated_at, r.created_at) AS sort_time,
      c.name AS category_name,
      c.slug AS category_slug,
      s.name AS subcategory_name,
      s.slug AS subcategory_slug,
      COALESCE(vt.unique_view_count, 0)::BIGINT AS unique_view_count,
      COALESCE(lc.like_count, 0)::BIGINT AS like_count
    FROM public.rankings r
    JOIN public.categories c
      ON c.id = r.category_id
      AND c.is_visible = TRUE
      AND c.slug = p_category_slug
    LEFT JOIN public.subcategories s
      ON s.id = r.subcategory_id
      AND s.is_visible = TRUE
    LEFT JOIN public.content_view_totals vt ON vt.ranking_id = r.id
    LEFT JOIN LATERAL (
      SELECT pg_catalog.count(*)::BIGINT AS like_count
      FROM public.content_likes cl
      WHERE cl.ranking_id = r.id
    ) lc ON TRUE
    WHERE r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
      AND (
        p_subcategory_slug IS NULL
        OR s.slug = p_subcategory_slug
      )
  )
  SELECT
    x.id,
    x.slug,
    x.title,
    x.summary,
    x.ranking_type,
    x.cover_image_url,
    x.published_at,
    x.sort_time,
    x.category_name,
    x.category_slug,
    x.subcategory_name,
    x.subcategory_slug,
    x.unique_view_count,
    x.like_count
  FROM candidates x
  WHERE
    p_cursor_id IS NULL
    OR (
      v_sort = 'latest'
      AND (
        x.sort_time < p_cursor_time
        OR (x.sort_time = p_cursor_time AND x.id > p_cursor_id)
      )
    )
    OR (
      v_sort = 'popular'
      AND (
        x.unique_view_count < p_cursor_views
        OR (x.unique_view_count = p_cursor_views AND x.like_count < p_cursor_likes)
        OR (x.unique_view_count = p_cursor_views AND x.like_count = p_cursor_likes AND x.sort_time < p_cursor_time)
        OR (x.unique_view_count = p_cursor_views AND x.like_count = p_cursor_likes AND x.sort_time = p_cursor_time AND x.id > p_cursor_id)
      )
    )
  ORDER BY
    CASE WHEN v_sort = 'popular' THEN x.unique_view_count END DESC,
    CASE WHEN v_sort = 'popular' THEN x.like_count END DESC,
    x.sort_time DESC,
    x.id ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.list_public_rankings(
  TEXT, TEXT, TEXT, INTEGER, BIGINT, BIGINT, TIMESTAMPTZ, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_rankings(
  TEXT, TEXT, TEXT, INTEGER, BIGINT, BIGINT, TIMESTAMPTZ, UUID
) TO anon, authenticated;

COMMIT;
