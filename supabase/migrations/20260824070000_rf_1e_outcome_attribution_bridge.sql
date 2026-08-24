BEGIN;

-- RF-1E closes the source-provenance gap before any user-visible RF-1 activation.
-- Existing exposure rows cannot be backfilled safely because RF-1B did not retain
-- the source ranking. Fail closed rather than infer provenance.
ALTER TABLE public.rf1_recommendation_exposures
  ADD COLUMN source_ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.rf1_recommendation_exposures) THEN
    RAISE EXCEPTION 'RF-1E cannot infer source_ranking_id for pre-existing exposure rows';
  END IF;
END;
$$;

ALTER TABLE public.rf1_recommendation_exposures
  ALTER COLUMN source_ranking_id SET NOT NULL,
  ADD CONSTRAINT rf1_recommendation_exposures_distinct_source_target
    CHECK (source_ranking_id <> ranking_id);

CREATE INDEX idx_rf1_recommendation_exposures_source_time
  ON public.rf1_recommendation_exposures(source_ranking_id, exposed_at DESC);

CREATE OR REPLACE FUNCTION public.record_rf1_recommendation_exposures(
  p_records JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_record JSONB;
  v_requested INTEGER;
  v_inserted INTEGER := 0;
  v_row_count INTEGER;
  v_exposure_id TEXT;
  v_recommendation_run_id TEXT;
  v_surface TEXT;
  v_source_ranking_id UUID;
  v_ranking_id UUID;
  v_ranking_mode TEXT;
  v_identity_relation TEXT;
  v_source_rank INTEGER;
  v_final_rank INTEGER;
  v_policy_bundle_version TEXT;
  v_profile_version TEXT;
  v_profile_fingerprint TEXT;
  v_session_fingerprint TEXT;
  v_score_breakdown JSONB;
  v_explored BOOLEAN;
  v_diversity_relaxations TEXT[];
  v_exposed_at TIMESTAMPTZ;
  v_existing_matches BOOLEAN;
BEGIN
  IF p_records IS NULL OR jsonb_typeof(p_records) <> 'array' THEN
    RAISE EXCEPTION 'RF-1 exposure records must be a JSON array' USING ERRCODE = '22023';
  END IF;

  v_requested := jsonb_array_length(p_records);
  IF v_requested < 1 OR v_requested > 100 THEN
    RAISE EXCEPTION 'RF-1 exposure batch size must be between 1 and 100' USING ERRCODE = '22023';
  END IF;

  FOR v_record IN SELECT value FROM jsonb_array_elements(p_records)
  LOOP
    IF jsonb_typeof(v_record) <> 'object' THEN
      RAISE EXCEPTION 'RF-1 exposure record must be an object' USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_exposure_id := v_record ->> 'exposure_id';
      v_recommendation_run_id := v_record ->> 'recommendation_run_id';
      v_surface := v_record ->> 'surface';
      v_source_ranking_id := (v_record ->> 'source_ranking_id')::UUID;
      v_ranking_id := (v_record ->> 'ranking_id')::UUID;
      v_ranking_mode := v_record ->> 'ranking_mode';
      v_identity_relation := NULLIF(v_record ->> 'identity_relation', '');
      v_source_rank := (v_record ->> 'source_rank')::INTEGER;
      v_final_rank := (v_record ->> 'final_rank')::INTEGER;
      v_policy_bundle_version := v_record ->> 'policy_bundle_version';
      v_profile_version := v_record ->> 'profile_version';
      v_profile_fingerprint := v_record ->> 'profile_fingerprint';
      v_session_fingerprint := NULLIF(v_record ->> 'session_fingerprint', '');
      v_score_breakdown := v_record -> 'score_breakdown';
      IF v_score_breakdown = 'null'::JSONB THEN
        v_score_breakdown := NULL;
      END IF;
      v_explored := COALESCE((v_record ->> 'explored')::BOOLEAN, FALSE);
      SELECT COALESCE(array_agg(value ORDER BY ordinality), ARRAY[]::TEXT[])
      INTO v_diversity_relaxations
      FROM jsonb_array_elements_text(COALESCE(v_record -> 'diversity_relaxations', '[]'::JSONB)) WITH ORDINALITY;
      v_exposed_at := (v_record ->> 'exposed_at')::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid RF-1 exposure record shape' USING ERRCODE = '22023';
    END;

    IF v_exposure_id IS NULL OR v_exposure_id = '' OR btrim(v_exposure_id) <> v_exposure_id THEN
      RAISE EXCEPTION 'RF-1 exposure_id is required and must be trimmed' USING ERRCODE = '22023';
    END IF;
    IF v_recommendation_run_id IS NULL OR v_recommendation_run_id = '' OR btrim(v_recommendation_run_id) <> v_recommendation_run_id THEN
      RAISE EXCEPTION 'RF-1 recommendation_run_id is required and must be trimmed' USING ERRCODE = '22023';
    END IF;
    IF v_surface <> 'related_rankings' THEN
      RAISE EXCEPTION 'unsupported RF-1 exposure surface' USING ERRCODE = '22023';
    END IF;
    IF v_source_ranking_id = v_ranking_id THEN
      RAISE EXCEPTION 'RF-1 source ranking must differ from target ranking' USING ERRCODE = '22023';
    END IF;
    IF v_ranking_mode NOT IN ('IA2_PROTECTED', 'RF1_RERANKED') THEN
      RAISE EXCEPTION 'unsupported RF-1 ranking mode' USING ERRCODE = '22023';
    END IF;
    IF v_source_rank < 1 OR v_final_rank < 1 THEN
      RAISE EXCEPTION 'RF-1 ranks must be positive' USING ERRCODE = '22023';
    END IF;
    IF v_policy_bundle_version IS NULL OR v_policy_bundle_version = '' OR btrim(v_policy_bundle_version) <> v_policy_bundle_version THEN
      RAISE EXCEPTION 'RF-1 policy bundle version is required' USING ERRCODE = '22023';
    END IF;
    IF v_profile_version IS NULL OR v_profile_version = '' OR btrim(v_profile_version) <> v_profile_version THEN
      RAISE EXCEPTION 'RF-1 profile version is required' USING ERRCODE = '22023';
    END IF;
    IF v_profile_fingerprint IS NULL OR v_profile_fingerprint = '' OR btrim(v_profile_fingerprint) <> v_profile_fingerprint THEN
      RAISE EXCEPTION 'RF-1 profile fingerprint is required' USING ERRCODE = '22023';
    END IF;
    IF v_identity_relation IS NOT NULL AND v_identity_relation NOT IN ('same_version', 'same_view', 'same_claim', 'same_subject') THEN
      RAISE EXCEPTION 'unsupported RF-1 identity relation' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(v_diversity_relaxations) AS relaxation
      WHERE relaxation NOT IN ('category', 'subcategory', 'rankingType')
    ) THEN
      RAISE EXCEPTION 'unsupported RF-1 diversity relaxation dimension' USING ERRCODE = '22023';
    END IF;

    IF v_ranking_mode = 'IA2_PROTECTED' THEN
      IF v_identity_relation IS NULL OR v_score_breakdown IS NOT NULL OR v_explored OR cardinality(v_diversity_relaxations) <> 0 THEN
        RAISE EXCEPTION 'IA2_PROTECTED exposure shape is invalid' USING ERRCODE = '22023';
      END IF;
    ELSE
      IF v_identity_relation IS NOT NULL OR v_score_breakdown IS NULL THEN
        RAISE EXCEPTION 'RF1_RERANKED exposure shape is invalid' USING ERRCODE = '22023';
      END IF;
      IF jsonb_typeof(v_score_breakdown) <> 'object'
        OR NOT (v_score_breakdown ?& ARRAY[
          'neighborhoodScore',
          'interestScore',
          'freshnessScore',
          'popularityScore',
          'lowExposureBoost',
          'baseScore',
          'finalScore'
        ]) THEN
        RAISE EXCEPTION 'RF-1 score breakdown is incomplete' USING ERRCODE = '22023';
      END IF;
    END IF;

    PERFORM 1
    FROM public.rankings r
    WHERE r.id = v_source_ranking_id
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'RF-1 exposure source ranking is not public' USING ERRCODE = 'P0002';
    END IF;

    PERFORM 1
    FROM public.rankings r
    WHERE r.id = v_ranking_id
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'RF-1 exposure target ranking is not public' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.rf1_recommendation_exposures(
      exposure_id,
      recommendation_run_id,
      surface,
      source_ranking_id,
      ranking_id,
      ranking_mode,
      identity_relation,
      source_rank,
      final_rank,
      policy_bundle_version,
      profile_version,
      profile_fingerprint,
      session_fingerprint,
      score_breakdown,
      explored,
      diversity_relaxations,
      exposed_at
    ) VALUES (
      v_exposure_id,
      v_recommendation_run_id,
      v_surface,
      v_source_ranking_id,
      v_ranking_id,
      v_ranking_mode,
      v_identity_relation,
      v_source_rank,
      v_final_rank,
      v_policy_bundle_version,
      v_profile_version,
      v_profile_fingerprint,
      v_session_fingerprint,
      v_score_breakdown,
      v_explored,
      v_diversity_relaxations,
      v_exposed_at
    )
    ON CONFLICT (exposure_id) DO NOTHING;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count = 1 THEN
      v_inserted := v_inserted + 1;
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM public.rf1_recommendation_exposures e
        WHERE e.exposure_id = v_exposure_id
          AND e.recommendation_run_id = v_recommendation_run_id
          AND e.surface = v_surface
          AND e.source_ranking_id = v_source_ranking_id
          AND e.ranking_id = v_ranking_id
          AND e.ranking_mode = v_ranking_mode
          AND e.identity_relation IS NOT DISTINCT FROM v_identity_relation
          AND e.source_rank = v_source_rank
          AND e.final_rank = v_final_rank
          AND e.policy_bundle_version = v_policy_bundle_version
          AND e.profile_version = v_profile_version
          AND e.profile_fingerprint = v_profile_fingerprint
          AND e.session_fingerprint IS NOT DISTINCT FROM v_session_fingerprint
          AND e.score_breakdown IS NOT DISTINCT FROM v_score_breakdown
          AND e.explored = v_explored
          AND e.diversity_relaxations = v_diversity_relaxations
          AND e.exposed_at = v_exposed_at
      ) INTO v_existing_matches;

      IF NOT v_existing_matches THEN
        RAISE EXCEPTION 'conflicting RF-1 exposure replay for %', v_exposure_id USING ERRCODE = '23505';
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'requested', v_requested,
    'inserted', v_inserted,
    'replayed', v_requested - v_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_rf1_recommendation_exposures(JSONB)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_rf1_recommendation_exposures(JSONB)
TO service_role;

-- Keep MEASURE-1 as the product-usage event authority. RF-1E adds only an
-- optional correlation pointer to an existing MEASURE-1 row.
ALTER TABLE public.product_usage_events
  ADD COLUMN recommendation_exposure_id TEXT
    REFERENCES public.rf1_recommendation_exposures(exposure_id) ON DELETE SET NULL,
  ADD CONSTRAINT product_usage_events_rf1_attribution_shape
    CHECK (
      recommendation_exposure_id IS NULL
      OR (
        event_type = 'content_discovery_click'
        AND discovery_source = 'related_ranking'
        AND ranking_id IS NOT NULL
        AND item_id IS NULL
        AND source_ranking_id IS NOT NULL
        AND source_item_id IS NULL
        AND source_category_id IS NULL
      )
    );

CREATE INDEX idx_product_usage_rf1_exposure
  ON public.product_usage_events(recommendation_exposure_id, occurred_at DESC)
  WHERE recommendation_exposure_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_rf1_related_discovery_click(
  p_client_event_id UUID,
  p_traffic_class TEXT,
  p_viewer_key_hash TEXT,
  p_occurred_on DATE,
  p_ranking_id UUID,
  p_source_ranking_id UUID,
  p_exposure_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_exposure public.rf1_recommendation_exposures%ROWTYPE;
  v_measure_result JSONB;
  v_event public.product_usage_events%ROWTYPE;
BEGIN
  IF p_exposure_id IS NULL OR p_exposure_id = '' OR btrim(p_exposure_id) <> p_exposure_id THEN
    RAISE EXCEPTION 'RF-1 recommendation exposure id is required and must be trimmed' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_exposure
  FROM public.rf1_recommendation_exposures e
  WHERE e.exposure_id = p_exposure_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RF-1 recommendation exposure does not exist' USING ERRCODE = 'P0002';
  END IF;
  IF v_exposure.surface <> 'related_rankings'
    OR v_exposure.ranking_id IS DISTINCT FROM p_ranking_id
    OR v_exposure.source_ranking_id IS DISTINCT FROM p_source_ranking_id THEN
    RAISE EXCEPTION 'RF-1 recommendation exposure does not match discovery source/target' USING ERRCODE = '22023';
  END IF;

  SELECT public.record_product_usage_event(
    p_client_event_id,
    'content_discovery_click',
    p_traffic_class,
    p_viewer_key_hash,
    p_occurred_on,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    p_ranking_id,
    NULL,
    NULL,
    'related_ranking',
    p_source_ranking_id,
    NULL,
    NULL
  ) INTO v_measure_result;

  SELECT *
  INTO v_event
  FROM public.product_usage_events e
  WHERE e.client_event_id = p_client_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEASURE-1 related-ranking click was not persisted' USING ERRCODE = 'P0002';
  END IF;

  IF v_event.event_type <> 'content_discovery_click'
    OR v_event.discovery_source <> 'related_ranking'
    OR v_event.ranking_id IS DISTINCT FROM p_ranking_id
    OR v_event.item_id IS NOT NULL
    OR v_event.source_ranking_id IS DISTINCT FROM p_source_ranking_id
    OR v_event.source_item_id IS NOT NULL
    OR v_event.source_category_id IS NOT NULL
    OR v_event.traffic_class IS DISTINCT FROM p_traffic_class
    OR v_event.viewer_key_hash IS DISTINCT FROM p_viewer_key_hash
    OR v_event.occurred_on IS DISTINCT FROM p_occurred_on THEN
    RAISE EXCEPTION 'MEASURE-1 event replay conflicts with RF-1 attribution request' USING ERRCODE = '23505';
  END IF;

  IF v_exposure.exposed_at > v_event.occurred_at THEN
    RAISE EXCEPTION 'RF-1 exposure cannot occur after its attributed click' USING ERRCODE = '22023';
  END IF;

  IF v_event.recommendation_exposure_id IS NOT NULL
    AND v_event.recommendation_exposure_id <> p_exposure_id THEN
    RAISE EXCEPTION 'MEASURE-1 event already has a conflicting RF-1 exposure attribution' USING ERRCODE = '23505';
  END IF;

  IF v_event.recommendation_exposure_id IS NULL THEN
    UPDATE public.product_usage_events
    SET recommendation_exposure_id = p_exposure_id
    WHERE id = v_event.id;
  END IF;

  RETURN jsonb_build_object(
    'inserted', COALESCE((v_measure_result ->> 'inserted')::BOOLEAN, FALSE),
    'attributed', TRUE,
    'recommendation_exposure_id', p_exposure_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_rf1_related_discovery_click(
  UUID, TEXT, TEXT, DATE, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_rf1_related_discovery_click(
  UUID, TEXT, TEXT, DATE, UUID, UUID, TEXT
) TO service_role;

-- RF-1 readiness must count only clicks with an exact RF-1 exposure bridge.
CREATE OR REPLACE FUNCTION public.get_rf1_calibration_evidence_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_published_rankings BIGINT;
  v_changed_bookmark_events BIGINT;
  v_bookmark_users BIGINT;
  v_product_usage_events BIGINT;
  v_related_ranking_clicks BIGINT;
  v_attributed_related_ranking_clicks BIGINT;
  v_rf1_exposures BIGINT;
  v_shadow_runs BIGINT;
  v_blockers JSONB := '[]'::JSONB;
BEGIN
  SELECT COUNT(*) INTO v_published_rankings
  FROM public.rankings r
  WHERE r.status = 'published'
    AND r.moderation_status IN ('clean', 'suggestive')
    AND r.image_moderation_status IN ('clean', 'suggestive');

  SELECT COUNT(*), COUNT(DISTINCT user_id)
  INTO v_changed_bookmark_events, v_bookmark_users
  FROM public.content_bookmark_events
  WHERE changed = TRUE;

  SELECT COUNT(*) INTO v_product_usage_events
  FROM public.product_usage_events;

  SELECT COUNT(*) INTO v_related_ranking_clicks
  FROM public.product_usage_events
  WHERE event_type = 'content_discovery_click'
    AND discovery_source = 'related_ranking';

  SELECT COUNT(*) INTO v_attributed_related_ranking_clicks
  FROM public.product_usage_events
  WHERE event_type = 'content_discovery_click'
    AND discovery_source = 'related_ranking'
    AND recommendation_exposure_id IS NOT NULL;

  SELECT COUNT(*) INTO v_rf1_exposures
  FROM public.rf1_recommendation_exposures;

  SELECT COUNT(*) INTO v_shadow_runs
  FROM public.rf1_shadow_runs;

  IF v_shadow_runs = 0 THEN
    v_blockers := v_blockers || jsonb_build_array('NO_DURABLE_SHADOW_RUN_EVIDENCE');
  END IF;
  IF v_changed_bookmark_events = 0 OR v_bookmark_users = 0 THEN
    v_blockers := v_blockers || jsonb_build_array('NO_AUTHENTICATED_SAVE_UNSAVE_EVIDENCE');
  END IF;
  IF v_attributed_related_ranking_clicks = 0 THEN
    v_blockers := v_blockers || jsonb_build_array('NO_RELATED_RANKING_CLICK_OUTCOME_EVIDENCE');
  END IF;
  IF v_rf1_exposures = 0 THEN
    v_blockers := v_blockers || jsonb_build_array('NO_USER_VISIBLE_RF1_EXPOSURE_EVIDENCE');
  END IF;

  RETURN jsonb_build_object(
    'verdict', CASE WHEN jsonb_array_length(v_blockers) = 0
      THEN 'EVIDENCE_PRESENT_REVIEW_REQUIRED'
      ELSE 'NOT_READY'
    END,
    'production_policy_authorized', FALSE,
    'automatic_authorization', 'FORBIDDEN',
    'blockers', v_blockers,
    'dimensions', jsonb_build_object(
      'shadow_order_evidence', CASE WHEN v_shadow_runs > 0 THEN 'PRESENT_REVIEW_REQUIRED' ELSE 'MISSING' END,
      'authenticated_profile_evidence', CASE WHEN v_changed_bookmark_events > 0 AND v_bookmark_users > 0 THEN 'PRESENT_REVIEW_REQUIRED' ELSE 'MISSING' END,
      'related_outcome_evidence', CASE WHEN v_attributed_related_ranking_clicks > 0 THEN 'PRESENT_REVIEW_REQUIRED' ELSE 'MISSING' END,
      'low_exposure_evidence', CASE WHEN v_rf1_exposures > 0 THEN 'PRESENT_REVIEW_REQUIRED' ELSE 'MISSING' END
    ),
    'counts', jsonb_build_object(
      'published_rankings', v_published_rankings,
      'changed_bookmark_events', v_changed_bookmark_events,
      'bookmark_users', v_bookmark_users,
      'product_usage_events', v_product_usage_events,
      'related_ranking_clicks', v_related_ranking_clicks,
      'rf1_attributed_related_ranking_clicks', v_attributed_related_ranking_clicks,
      'rf1_exposures', v_rf1_exposures,
      'shadow_runs', v_shadow_runs
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_rf1_calibration_evidence_summary()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_rf1_calibration_evidence_summary()
TO service_role;

COMMIT;
