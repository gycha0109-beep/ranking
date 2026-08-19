BEGIN;

CREATE TABLE public.product_usage_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_event_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  traffic_class TEXT NOT NULL,
  viewer_key_hash TEXT NOT NULL,
  occurred_on DATE NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_id UUID,
  query_hash TEXT,
  query_text TEXT,
  result_count INTEGER,
  zero_result BOOLEAN,
  ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  selected_position INTEGER,
  discovery_source TEXT,
  source_ranking_id UUID REFERENCES public.rankings(id) ON DELETE SET NULL,
  source_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  source_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  CONSTRAINT product_usage_events_client_event_unique UNIQUE (client_event_id),
  CONSTRAINT product_usage_events_event_type CHECK (
    event_type IN ('content_view', 'search', 'search_result_click', 'content_discovery_click')
  ),
  CONSTRAINT product_usage_events_traffic_class CHECK (
    traffic_class IN ('unknown', 'qa_internal')
  ),
  CONSTRAINT product_usage_events_viewer_hash CHECK (
    viewer_key_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT product_usage_events_query_hash CHECK (
    query_hash IS NULL OR query_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT product_usage_events_query_text_length CHECK (
    query_text IS NULL OR char_length(query_text) BETWEEN 2 AND 80
  ),
  CONSTRAINT product_usage_events_result_count CHECK (
    result_count IS NULL OR result_count BETWEEN 0 AND 1000
  ),
  CONSTRAINT product_usage_events_selected_position CHECK (
    selected_position IS NULL OR selected_position BETWEEN 1 AND 100
  ),
  CONSTRAINT product_usage_events_discovery_source CHECK (
    discovery_source IS NULL OR discovery_source IN (
      'home', 'category', 'search', 'related_ranking', 'ranking_item', 'item_ranking'
    )
  ),
  CONSTRAINT product_usage_events_target_shape CHECK (
    CASE event_type
      WHEN 'search' THEN num_nonnulls(ranking_id, item_id) = 0
      ELSE num_nonnulls(ranking_id, item_id) = 1
    END
  ),
  CONSTRAINT product_usage_events_search_shape CHECK (
    CASE event_type
      WHEN 'search' THEN
        search_id IS NOT NULL
        AND query_hash IS NOT NULL
        AND result_count IS NOT NULL
        AND zero_result IS NOT NULL
        AND selected_position IS NULL
      WHEN 'search_result_click' THEN
        search_id IS NOT NULL
        AND query_hash IS NOT NULL
        AND query_text IS NULL
        AND result_count IS NULL
        AND zero_result IS NULL
        AND selected_position IS NOT NULL
      ELSE
        search_id IS NULL
        AND query_hash IS NULL
        AND query_text IS NULL
        AND result_count IS NULL
        AND zero_result IS NULL
        AND selected_position IS NULL
    END
  ),
  CONSTRAINT product_usage_events_discovery_shape CHECK (
    CASE event_type
      WHEN 'content_discovery_click' THEN
        CASE discovery_source
          WHEN 'home' THEN num_nonnulls(source_ranking_id, source_item_id, source_category_id) = 0
          WHEN 'category' THEN source_category_id IS NOT NULL AND source_ranking_id IS NULL AND source_item_id IS NULL
          WHEN 'related_ranking' THEN source_ranking_id IS NOT NULL AND source_item_id IS NULL AND source_category_id IS NULL
          WHEN 'ranking_item' THEN source_ranking_id IS NOT NULL AND source_item_id IS NULL AND source_category_id IS NULL
          WHEN 'item_ranking' THEN source_item_id IS NOT NULL AND source_ranking_id IS NULL AND source_category_id IS NULL
          ELSE FALSE
        END
      WHEN 'search_result_click' THEN
        discovery_source = 'search'
        AND num_nonnulls(source_ranking_id, source_item_id, source_category_id) = 0
      ELSE
        discovery_source IS NULL
        AND num_nonnulls(source_ranking_id, source_item_id, source_category_id) = 0
    END
  )
);

CREATE UNIQUE INDEX uq_product_usage_content_view_daily_ranking
  ON public.product_usage_events(viewer_key_hash, occurred_on, ranking_id)
  WHERE event_type = 'content_view' AND ranking_id IS NOT NULL;

CREATE UNIQUE INDEX uq_product_usage_content_view_daily_item
  ON public.product_usage_events(viewer_key_hash, occurred_on, item_id)
  WHERE event_type = 'content_view' AND item_id IS NOT NULL;

CREATE UNIQUE INDEX uq_product_usage_search_impression
  ON public.product_usage_events(search_id)
  WHERE event_type = 'search';

CREATE INDEX idx_product_usage_period_class
  ON public.product_usage_events(occurred_on, traffic_class, event_type);

CREATE INDEX idx_product_usage_search_id
  ON public.product_usage_events(search_id)
  WHERE search_id IS NOT NULL;

CREATE INDEX idx_product_usage_query_hash
  ON public.product_usage_events(query_hash, occurred_on)
  WHERE query_hash IS NOT NULL;

CREATE INDEX idx_product_usage_retention
  ON public.product_usage_events(occurred_at, id);

ALTER TABLE public.product_usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_usage_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.product_usage_events_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.purge_measure_1_telemetry_batch(
  p_batch_size INTEGER DEFAULT 500
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_batch_size, 500), 1), 5000);
  v_redacted INTEGER := 0;
  v_deleted INTEGER := 0;
BEGIN
  WITH targets AS (
    SELECT id
    FROM public.product_usage_events
    WHERE query_text IS NOT NULL
      AND occurred_at < NOW() - INTERVAL '30 days'
    ORDER BY occurred_at, id
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.product_usage_events e
  SET query_text = NULL
  FROM targets t
  WHERE e.id = t.id;
  GET DIAGNOSTICS v_redacted = ROW_COUNT;

  WITH targets AS (
    SELECT id
    FROM public.product_usage_events
    WHERE occurred_at < NOW() - INTERVAL '13 months'
    ORDER BY occurred_at, id
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.product_usage_events e
  USING targets t
  WHERE e.id = t.id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('query_text_redacted', v_redacted, 'events_deleted', v_deleted);
END;
$$;

REVOKE ALL ON FUNCTION private.purge_measure_1_telemetry_batch(INTEGER)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_product_usage_event(
  p_client_event_id UUID,
  p_event_type TEXT,
  p_traffic_class TEXT,
  p_viewer_key_hash TEXT,
  p_occurred_on DATE,
  p_search_id UUID DEFAULT NULL,
  p_query_hash TEXT DEFAULT NULL,
  p_query_text TEXT DEFAULT NULL,
  p_result_count INTEGER DEFAULT NULL,
  p_zero_result BOOLEAN DEFAULT NULL,
  p_ranking_id UUID DEFAULT NULL,
  p_item_id UUID DEFAULT NULL,
  p_selected_position INTEGER DEFAULT NULL,
  p_discovery_source TEXT DEFAULT NULL,
  p_source_ranking_id UUID DEFAULT NULL,
  p_source_item_id UUID DEFAULT NULL,
  p_source_category_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_event_id BIGINT;
  v_today_utc DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
BEGIN
  IF p_client_event_id IS NULL THEN
    RAISE EXCEPTION 'client event id is required' USING ERRCODE = '22023';
  END IF;
  IF p_event_type NOT IN ('content_view', 'search', 'search_result_click', 'content_discovery_click') THEN
    RAISE EXCEPTION 'unsupported product usage event type' USING ERRCODE = '22023';
  END IF;
  IF p_traffic_class NOT IN ('unknown', 'qa_internal') THEN
    RAISE EXCEPTION 'unsupported traffic class' USING ERRCODE = '22023';
  END IF;
  IF p_viewer_key_hash IS NULL OR p_viewer_key_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid viewer hash' USING ERRCODE = '22023';
  END IF;
  IF p_occurred_on IS DISTINCT FROM v_today_utc THEN
    RAISE EXCEPTION 'event date must be current UTC date' USING ERRCODE = '22023';
  END IF;
  IF p_query_hash IS NOT NULL AND p_query_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid query hash' USING ERRCODE = '22023';
  END IF;
  IF p_query_text IS NOT NULL AND (char_length(p_query_text) < 2 OR char_length(p_query_text) > 80) THEN
    RAISE EXCEPTION 'invalid retained query text length' USING ERRCODE = '22023';
  END IF;

  IF p_event_type <> 'search' THEN
    IF num_nonnulls(p_ranking_id, p_item_id) <> 1 THEN
      RAISE EXCEPTION 'exactly one content target is required' USING ERRCODE = '22023';
    END IF;

    IF p_ranking_id IS NOT NULL THEN
      PERFORM 1
      FROM public.rankings r
      WHERE r.id = p_ranking_id
        AND r.status = 'published'
        AND r.moderation_status IN ('clean', 'suggestive')
        AND r.image_moderation_status IN ('clean', 'suggestive');
      IF NOT FOUND THEN
        RAISE EXCEPTION 'target ranking is not public' USING ERRCODE = 'P0002';
      END IF;
    ELSE
      PERFORM 1
      FROM public.items i
      WHERE i.id = p_item_id
        AND i.status = 'active'
        AND i.moderation_status IN ('clean', 'suggestive')
        AND i.image_moderation_status IN ('clean', 'suggestive');
      IF NOT FOUND THEN
        RAISE EXCEPTION 'target item is not public' USING ERRCODE = 'P0002';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.product_usage_events(
    client_event_id,
    event_type,
    traffic_class,
    viewer_key_hash,
    occurred_on,
    search_id,
    query_hash,
    query_text,
    result_count,
    zero_result,
    ranking_id,
    item_id,
    selected_position,
    discovery_source,
    source_ranking_id,
    source_item_id,
    source_category_id
  ) VALUES (
    p_client_event_id,
    p_event_type,
    p_traffic_class,
    p_viewer_key_hash,
    p_occurred_on,
    p_search_id,
    p_query_hash,
    p_query_text,
    p_result_count,
    p_zero_result,
    p_ranking_id,
    p_item_id,
    p_selected_position,
    p_discovery_source,
    p_source_ranking_id,
    p_source_item_id,
    p_source_category_id
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_event_id;

  PERFORM private.purge_measure_1_telemetry_batch(100);

  RETURN jsonb_build_object('inserted', v_event_id IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.record_product_usage_event(
  UUID, TEXT, TEXT, TEXT, DATE, UUID, TEXT, TEXT, INTEGER, BOOLEAN,
  UUID, UUID, INTEGER, TEXT, UUID, UUID, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_product_usage_event(
  UUID, TEXT, TEXT, TEXT, DATE, UUID, TEXT, TEXT, INTEGER, BOOLEAN,
  UUID, UUID, INTEGER, TEXT, UUID, UUID, UUID
) TO service_role;

CREATE OR REPLACE FUNCTION public.purge_expired_product_usage_events(
  p_batch_size INTEGER DEFAULT 1000
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.purge_measure_1_telemetry_batch(p_batch_size);
$$;

REVOKE ALL ON FUNCTION public.purge_expired_product_usage_events(INTEGER)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_product_usage_events(INTEGER)
TO service_role;

CREATE OR REPLACE FUNCTION private.measure_1_user_traffic_class(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT CASE
    WHEN COALESCE(u.raw_app_meta_data ->> 'telemetry_class', '') = 'qa_internal'
      OR lower(COALESCE(u.email, '')) LIKE '%@example.com'
      THEN 'qa_internal'
    ELSE 'unknown'
  END
  FROM auth.users u
  WHERE u.id = p_user_id;
$$;

REVOKE ALL ON FUNCTION private.measure_1_user_traffic_class(UUID)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_measure_1_baseline(
  p_from DATE DEFAULT ((NOW() AT TIME ZONE 'UTC')::DATE - 29),
  p_to DATE DEFAULT (NOW() AT TIME ZONE 'UTC')::DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_baseline_started_at TIMESTAMPTZ;
BEGIN
  IF NOT public.has_admin_capability('audit_view') THEN
    RAISE EXCEPTION 'audit_view capability required' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 366 THEN
    RAISE EXCEPTION 'invalid baseline period' USING ERRCODE = '22023';
  END IF;

  SELECT MIN(e.occurred_at)
  INTO v_baseline_started_at
  FROM public.product_usage_events e;

  SELECT jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'measurement_started_at', v_baseline_started_at),
    'eligible', jsonb_build_object(
      'content_views', COUNT(*) FILTER (WHERE e.traffic_class = 'unknown' AND e.event_type = 'content_view'),
      'ranking_views', COUNT(*) FILTER (WHERE e.traffic_class = 'unknown' AND e.event_type = 'content_view' AND e.ranking_id IS NOT NULL),
      'item_views', COUNT(*) FILTER (WHERE e.traffic_class = 'unknown' AND e.event_type = 'content_view' AND e.item_id IS NOT NULL),
      'distinct_daily_viewers', COUNT(DISTINCT (e.occurred_on::TEXT || ':' || e.viewer_key_hash)) FILTER (WHERE e.traffic_class = 'unknown' AND e.event_type = 'content_view')
    ),
    'qa_internal', jsonb_build_object(
      'content_views', COUNT(*) FILTER (WHERE e.traffic_class = 'qa_internal' AND e.event_type = 'content_view'),
      'searches', COUNT(*) FILTER (WHERE e.traffic_class = 'qa_internal' AND e.event_type = 'search'),
      'discovery_clicks', COUNT(*) FILTER (WHERE e.traffic_class = 'qa_internal' AND e.event_type IN ('search_result_click', 'content_discovery_click'))
    ),
    'search', jsonb_build_object(
      'searches', COUNT(*) FILTER (WHERE e.traffic_class = 'unknown' AND e.event_type = 'search'),
      'distinct_daily_searchers', COUNT(DISTINCT (e.occurred_on::TEXT || ':' || e.viewer_key_hash)) FILTER (WHERE e.traffic_class = 'unknown' AND e.event_type = 'search'),
      'zero_result_searches', COUNT(*) FILTER (WHERE e.traffic_class = 'unknown' AND e.event_type = 'search' AND e.zero_result = TRUE),
      'zero_result_rate', CASE
        WHEN COUNT(*) FILTER (WHERE e.traffic_class = 'unknown' AND e.event_type = 'search') = 0 THEN 0
        ELSE ROUND(
          (COUNT(*) FILTER (WHERE e.traffic_class = 'unknown' AND e.event_type = 'search' AND e.zero_result = TRUE))::NUMERIC
          / (COUNT(*) FILTER (WHERE e.traffic_class = 'unknown' AND e.event_type = 'search'))::NUMERIC,
          4
        )
      END,
      'clicked_searches', (
        SELECT COUNT(DISTINCT s.search_id)
        FROM public.product_usage_events s
        WHERE s.traffic_class = 'unknown'
          AND s.event_type = 'search'
          AND s.occurred_on BETWEEN p_from AND p_to
          AND EXISTS (
            SELECT 1
            FROM public.product_usage_events c
            WHERE c.traffic_class = 'unknown'
              AND c.event_type = 'search_result_click'
              AND c.search_id = s.search_id
          )
      ),
      'search_result_ctr', CASE
        WHEN COUNT(*) FILTER (WHERE e.traffic_class = 'unknown' AND e.event_type = 'search') = 0 THEN 0
        ELSE ROUND(
          (
            SELECT COUNT(DISTINCT s.search_id)::NUMERIC
            FROM public.product_usage_events s
            WHERE s.traffic_class = 'unknown'
              AND s.event_type = 'search'
              AND s.occurred_on BETWEEN p_from AND p_to
              AND EXISTS (
                SELECT 1
                FROM public.product_usage_events c
                WHERE c.traffic_class = 'unknown'
                  AND c.event_type = 'search_result_click'
                  AND c.search_id = s.search_id
              )
          ) / (COUNT(*) FILTER (WHERE e.traffic_class = 'unknown' AND e.event_type = 'search'))::NUMERIC,
          4
        )
      END
    ),
    'discovery_by_source', COALESCE((
      SELECT jsonb_object_agg(d.discovery_source, d.event_count ORDER BY d.discovery_source)
      FROM (
        SELECT discovery_source, COUNT(*) AS event_count
        FROM public.product_usage_events
        WHERE traffic_class = 'unknown'
          AND event_type IN ('search_result_click', 'content_discovery_click')
          AND occurred_on BETWEEN p_from AND p_to
        GROUP BY discovery_source
      ) d
    ), '{}'::jsonb),
    'engagement', jsonb_build_object(
      'likes', (
        SELECT COUNT(*) FROM public.content_like_events l
        WHERE v_baseline_started_at IS NOT NULL
          AND l.changed = TRUE AND l.requested_liked = TRUE
          AND l.created_at >= GREATEST(p_from::TIMESTAMPTZ, v_baseline_started_at)
          AND l.created_at < (p_to + 1)::TIMESTAMPTZ
          AND COALESCE(private.measure_1_user_traffic_class(l.user_id), 'unknown') = 'unknown'
      ),
      'bookmarks', (
        SELECT COUNT(*) FROM public.content_bookmark_events b
        WHERE v_baseline_started_at IS NOT NULL
          AND b.changed = TRUE AND b.requested_bookmarked = TRUE
          AND b.created_at >= GREATEST(p_from::TIMESTAMPTZ, v_baseline_started_at)
          AND b.created_at < (p_to + 1)::TIMESTAMPTZ
          AND COALESCE(private.measure_1_user_traffic_class(b.user_id), 'unknown') = 'unknown'
      ),
      'comments', (
        SELECT COUNT(*) FROM public.comments c
        WHERE v_baseline_started_at IS NOT NULL
          AND c.created_at >= GREATEST(p_from::TIMESTAMPTZ, v_baseline_started_at)
          AND c.created_at < (p_to + 1)::TIMESTAMPTZ
          AND COALESCE(private.measure_1_user_traffic_class(c.user_id), 'unknown') = 'unknown'
      ),
      'reactions', (
        SELECT COUNT(*) FROM public.reactions r
        WHERE v_baseline_started_at IS NOT NULL
          AND r.created_at >= GREATEST(p_from::TIMESTAMPTZ, v_baseline_started_at)
          AND r.created_at < (p_to + 1)::TIMESTAMPTZ
          AND COALESCE(private.measure_1_user_traffic_class(r.user_id), 'unknown') = 'unknown'
      )
    ),
    'top_queries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'query', q.query_text,
        'searches', q.searches,
        'zero_result_searches', q.zero_result_searches
      ) ORDER BY q.searches DESC, q.query_text)
      FROM (
        SELECT query_text,
               COUNT(*) AS searches,
               COUNT(*) FILTER (WHERE zero_result = TRUE) AS zero_result_searches
        FROM public.product_usage_events
        WHERE traffic_class = 'unknown'
          AND event_type = 'search'
          AND occurred_on BETWEEN p_from AND p_to
          AND query_text IS NOT NULL
        GROUP BY query_text
        ORDER BY searches DESC, query_text
        LIMIT 10
      ) q
    ), '[]'::jsonb),
    'legacy_view_authority', jsonb_build_object(
      'table', 'content_daily_views',
      'baseline_eligible', FALSE,
      'reason', 'pre-MEASURE-1 rows are not traffic-classified and are QA-contaminated'
    )
  )
  INTO v_result
  FROM public.product_usage_events e
  WHERE e.occurred_on BETWEEN p_from AND p_to;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_measure_1_baseline(DATE, DATE)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_measure_1_baseline(DATE, DATE)
TO authenticated, service_role;

COMMIT;
