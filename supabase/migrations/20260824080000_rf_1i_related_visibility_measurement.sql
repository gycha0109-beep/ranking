BEGIN;

-- RF-1I extends the existing MEASURE-1 authority with raw observation facts.
-- It intentionally does not persist QUICK_SKIP / DWELL policy judgments.
ALTER TABLE public.product_usage_events
  ADD COLUMN observation_id UUID,
  ADD COLUMN visible_duration_ms BIGINT,
  ADD COLUMN entry_intersection_ratio_ppm INTEGER,
  ADD COLUMN visibility_end_reason TEXT;

ALTER TABLE public.product_usage_events
  DROP CONSTRAINT product_usage_events_event_type,
  DROP CONSTRAINT product_usage_events_discovery_shape,
  DROP CONSTRAINT product_usage_events_rf1_attribution_shape;

ALTER TABLE public.product_usage_events
  ADD CONSTRAINT product_usage_events_event_type CHECK (
    event_type IN (
      'content_view',
      'search',
      'search_result_click',
      'content_discovery_click',
      'content_impression',
      'content_visibility'
    )
  ),
  ADD CONSTRAINT product_usage_events_discovery_shape CHECK (
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
      WHEN 'content_impression' THEN
        discovery_source = 'related_ranking'
        AND ranking_id IS NOT NULL
        AND item_id IS NULL
        AND source_ranking_id IS NOT NULL
        AND source_item_id IS NULL
        AND source_category_id IS NULL
      WHEN 'content_visibility' THEN
        discovery_source = 'related_ranking'
        AND ranking_id IS NOT NULL
        AND item_id IS NULL
        AND source_ranking_id IS NOT NULL
        AND source_item_id IS NULL
        AND source_category_id IS NULL
      WHEN 'search_result_click' THEN
        discovery_source = 'search'
        AND num_nonnulls(source_ranking_id, source_item_id, source_category_id) = 0
      ELSE
        discovery_source IS NULL
        AND num_nonnulls(source_ranking_id, source_item_id, source_category_id) = 0
    END
  ),
  ADD CONSTRAINT product_usage_events_observation_shape CHECK (
    CASE event_type
      WHEN 'content_impression' THEN
        observation_id IS NOT NULL
        AND visible_duration_ms IS NULL
        AND entry_intersection_ratio_ppm BETWEEN 1 AND 1000000
        AND visibility_end_reason IS NULL
      WHEN 'content_visibility' THEN
        observation_id IS NOT NULL
        AND visible_duration_ms >= 0
        AND entry_intersection_ratio_ppm BETWEEN 1 AND 1000000
        AND visibility_end_reason IN ('out_of_view', 'page_hidden', 'page_exit', 'unmount')
      WHEN 'content_discovery_click' THEN
        visible_duration_ms IS NULL
        AND entry_intersection_ratio_ppm IS NULL
        AND visibility_end_reason IS NULL
      ELSE
        observation_id IS NULL
        AND visible_duration_ms IS NULL
        AND entry_intersection_ratio_ppm IS NULL
        AND visibility_end_reason IS NULL
    END
  ),
  ADD CONSTRAINT product_usage_events_rf1_attribution_shape CHECK (
    recommendation_exposure_id IS NULL
    OR (
      event_type IN ('content_discovery_click', 'content_impression', 'content_visibility')
      AND discovery_source = 'related_ranking'
      AND ranking_id IS NOT NULL
      AND item_id IS NULL
      AND source_ranking_id IS NOT NULL
      AND source_item_id IS NULL
      AND source_category_id IS NULL
    )
  );

CREATE UNIQUE INDEX uq_product_usage_related_observation_event
  ON public.product_usage_events(observation_id, event_type)
  WHERE observation_id IS NOT NULL
    AND event_type IN ('content_impression', 'content_visibility', 'content_discovery_click');

CREATE INDEX idx_product_usage_related_visibility_source_target
  ON public.product_usage_events(source_ranking_id, ranking_id, occurred_at DESC)
  WHERE event_type IN ('content_impression', 'content_visibility');

-- Replace the original MEASURE-1 writer with a backwards-compatible signature
-- extended only by bounded observation fields. Existing callers can omit every
-- new trailing argument because they all have defaults.
DROP FUNCTION public.record_product_usage_event(
  UUID, TEXT, TEXT, TEXT, DATE, UUID, TEXT, TEXT, INTEGER, BOOLEAN,
  UUID, UUID, INTEGER, TEXT, UUID, UUID, UUID
);

CREATE FUNCTION public.record_product_usage_event(
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
  p_source_category_id UUID DEFAULT NULL,
  p_observation_id UUID DEFAULT NULL,
  p_visible_duration_ms BIGINT DEFAULT NULL,
  p_entry_intersection_ratio_ppm INTEGER DEFAULT NULL,
  p_visibility_end_reason TEXT DEFAULT NULL,
  p_recommendation_exposure_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_event_id BIGINT;
  v_today_utc DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_exposure public.rf1_recommendation_exposures%ROWTYPE;
BEGIN
  IF p_client_event_id IS NULL THEN
    RAISE EXCEPTION 'client event id is required' USING ERRCODE = '22023';
  END IF;
  IF p_event_type NOT IN (
    'content_view',
    'search',
    'search_result_click',
    'content_discovery_click',
    'content_impression',
    'content_visibility'
  ) THEN
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

  IF p_event_type IN ('content_impression', 'content_visibility') THEN
    IF p_ranking_id IS NULL
      OR p_item_id IS NOT NULL
      OR p_discovery_source <> 'related_ranking'
      OR p_source_ranking_id IS NULL
      OR p_source_item_id IS NOT NULL
      OR p_source_category_id IS NOT NULL THEN
      RAISE EXCEPTION 'RF-1I raw visibility is limited to related ranking-to-ranking observations' USING ERRCODE = '22023';
    END IF;

    PERFORM 1
    FROM public.rankings r
    WHERE r.id = p_source_ranking_id
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'RF-1I source ranking is not public' USING ERRCODE = 'P0002';
    END IF;

    IF p_observation_id IS NULL THEN
      RAISE EXCEPTION 'RF-1I observation id is required' USING ERRCODE = '22023';
    END IF;
    IF p_entry_intersection_ratio_ppm IS NULL
      OR p_entry_intersection_ratio_ppm < 1
      OR p_entry_intersection_ratio_ppm > 1000000 THEN
      RAISE EXCEPTION 'RF-1I entry intersection ratio is invalid' USING ERRCODE = '22023';
    END IF;

    IF p_event_type = 'content_impression' THEN
      IF p_visible_duration_ms IS NOT NULL OR p_visibility_end_reason IS NOT NULL THEN
        RAISE EXCEPTION 'RF-1I impression must not contain a duration judgment' USING ERRCODE = '22023';
      END IF;
    ELSE
      IF p_visible_duration_ms IS NULL OR p_visible_duration_ms < 0 THEN
        RAISE EXCEPTION 'RF-1I visible duration must be a non-negative raw measurement' USING ERRCODE = '22023';
      END IF;
      IF p_visibility_end_reason NOT IN ('out_of_view', 'page_hidden', 'page_exit', 'unmount') THEN
        RAISE EXCEPTION 'RF-1I visibility end reason is invalid' USING ERRCODE = '22023';
      END IF;
    END IF;
  ELSE
    IF p_visible_duration_ms IS NOT NULL
      OR p_entry_intersection_ratio_ppm IS NOT NULL
      OR p_visibility_end_reason IS NOT NULL THEN
      RAISE EXCEPTION 'raw visibility fields are only valid for RF-1I observation events' USING ERRCODE = '22023';
    END IF;
    IF p_event_type <> 'content_discovery_click' AND p_observation_id IS NOT NULL THEN
      RAISE EXCEPTION 'observation correlation is only valid for related visibility/click events' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_recommendation_exposure_id IS NOT NULL THEN
    IF p_recommendation_exposure_id = '' OR btrim(p_recommendation_exposure_id) <> p_recommendation_exposure_id THEN
      RAISE EXCEPTION 'RF-1 recommendation exposure id must be a non-empty trimmed string' USING ERRCODE = '22023';
    END IF;
    IF p_event_type NOT IN ('content_discovery_click', 'content_impression', 'content_visibility')
      OR p_discovery_source <> 'related_ranking'
      OR p_ranking_id IS NULL
      OR p_source_ranking_id IS NULL THEN
      RAISE EXCEPTION 'RF-1 exposure correlation requires a related ranking event' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_exposure
    FROM public.rf1_recommendation_exposures e
    WHERE e.exposure_id = p_recommendation_exposure_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'RF-1 recommendation exposure does not exist' USING ERRCODE = 'P0002';
    END IF;
    IF v_exposure.surface <> 'related_rankings'
      OR v_exposure.ranking_id IS DISTINCT FROM p_ranking_id
      OR v_exposure.source_ranking_id IS DISTINCT FROM p_source_ranking_id THEN
      RAISE EXCEPTION 'RF-1 recommendation exposure does not match event source/target' USING ERRCODE = '22023';
    END IF;
    IF v_exposure.exposed_at > NOW() THEN
      RAISE EXCEPTION 'RF-1 recommendation exposure cannot occur after its correlated event' USING ERRCODE = '22023';
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
    source_category_id,
    observation_id,
    visible_duration_ms,
    entry_intersection_ratio_ppm,
    visibility_end_reason,
    recommendation_exposure_id
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
    p_source_category_id,
    p_observation_id,
    p_visible_duration_ms,
    p_entry_intersection_ratio_ppm,
    p_visibility_end_reason,
    p_recommendation_exposure_id
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_event_id;

  PERFORM private.purge_measure_1_telemetry_batch(100);

  RETURN jsonb_build_object('inserted', v_event_id IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.record_product_usage_event(
  UUID, TEXT, TEXT, TEXT, DATE, UUID, TEXT, TEXT, INTEGER, BOOLEAN,
  UUID, UUID, INTEGER, TEXT, UUID, UUID, UUID, UUID, BIGINT, INTEGER, TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_product_usage_event(
  UUID, TEXT, TEXT, TEXT, DATE, UUID, TEXT, TEXT, INTEGER, BOOLEAN,
  UUID, UUID, INTEGER, TEXT, UUID, UUID, UUID, UUID, BIGINT, INTEGER, TEXT, TEXT
) TO service_role;

-- Preserve RF-1E exact click attribution while allowing the same raw observation
-- id to connect impression -> visibility -> click. The old seven-argument wrapper
-- is removed to prevent PostgREST overload ambiguity.
DROP FUNCTION public.record_rf1_related_discovery_click(
  UUID, TEXT, TEXT, DATE, UUID, UUID, TEXT
);

CREATE FUNCTION public.record_rf1_related_discovery_click(
  p_client_event_id UUID,
  p_traffic_class TEXT,
  p_viewer_key_hash TEXT,
  p_occurred_on DATE,
  p_ranking_id UUID,
  p_source_ranking_id UUID,
  p_exposure_id TEXT,
  p_observation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT public.record_product_usage_event(
    p_client_event_id => p_client_event_id,
    p_event_type => 'content_discovery_click',
    p_traffic_class => p_traffic_class,
    p_viewer_key_hash => p_viewer_key_hash,
    p_occurred_on => p_occurred_on,
    p_ranking_id => p_ranking_id,
    p_discovery_source => 'related_ranking',
    p_source_ranking_id => p_source_ranking_id,
    p_observation_id => p_observation_id,
    p_recommendation_exposure_id => p_exposure_id
  ) INTO v_result;

  RETURN jsonb_build_object(
    'inserted', COALESCE((v_result ->> 'inserted')::BOOLEAN, FALSE),
    'attributed', TRUE,
    'recommendation_exposure_id', p_exposure_id,
    'observation_id', p_observation_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_rf1_related_discovery_click(
  UUID, TEXT, TEXT, DATE, UUID, UUID, TEXT, UUID
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_rf1_related_discovery_click(
  UUID, TEXT, TEXT, DATE, UUID, UUID, TEXT, UUID
) TO service_role;

COMMIT;
