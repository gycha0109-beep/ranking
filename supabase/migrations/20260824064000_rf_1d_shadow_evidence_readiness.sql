BEGIN;

CREATE TABLE public.rf1_shadow_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shadow_run_id TEXT NOT NULL,
  current_ranking_id UUID NOT NULL REFERENCES public.rankings(id) ON DELETE CASCADE,
  policy_bundle_version TEXT NOT NULL,
  profile_maturity TEXT NOT NULL,
  profile_fingerprint TEXT NOT NULL,
  session_fingerprint TEXT,
  reference_time TIMESTAMPTZ NOT NULL,
  seed TEXT NOT NULL,
  baseline_ranking_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  shadow_ranking_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  candidate_count INTEGER NOT NULL,
  changed_position_count INTEGER NOT NULL,
  protected_identity_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rf1_shadow_runs_run_id_trimmed
    CHECK (shadow_run_id <> '' AND btrim(shadow_run_id) = shadow_run_id),
  CONSTRAINT rf1_shadow_runs_policy_trimmed
    CHECK (policy_bundle_version <> '' AND btrim(policy_bundle_version) = policy_bundle_version),
  CONSTRAINT rf1_shadow_runs_profile_maturity
    CHECK (profile_maturity IN ('EMPTY', 'EMERGING', 'ESTABLISHED')),
  CONSTRAINT rf1_shadow_runs_profile_fingerprint_trimmed
    CHECK (profile_fingerprint <> '' AND btrim(profile_fingerprint) = profile_fingerprint),
  CONSTRAINT rf1_shadow_runs_session_fingerprint_trimmed
    CHECK (session_fingerprint IS NULL OR (session_fingerprint <> '' AND btrim(session_fingerprint) = session_fingerprint)),
  CONSTRAINT rf1_shadow_runs_seed_trimmed
    CHECK (seed <> '' AND btrim(seed) = seed),
  CONSTRAINT rf1_shadow_runs_candidate_count
    CHECK (
      candidate_count >= 0
      AND candidate_count = cardinality(baseline_ranking_ids)
      AND candidate_count = cardinality(shadow_ranking_ids)
    ),
  CONSTRAINT rf1_shadow_runs_changed_position_count
    CHECK (changed_position_count BETWEEN 0 AND candidate_count),
  CONSTRAINT rf1_shadow_runs_protected_identity_count
    CHECK (protected_identity_count BETWEEN 0 AND candidate_count)
);

CREATE UNIQUE INDEX uq_rf1_shadow_runs_shadow_run_id
  ON public.rf1_shadow_runs(shadow_run_id);

CREATE INDEX idx_rf1_shadow_runs_current_reference
  ON public.rf1_shadow_runs(current_ranking_id, reference_time DESC);

CREATE INDEX idx_rf1_shadow_runs_policy_reference
  ON public.rf1_shadow_runs(policy_bundle_version, reference_time DESC);

ALTER TABLE public.rf1_shadow_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rf1_shadow_runs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.rf1_shadow_runs_id_seq FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_rf1_shadow_run(
  p_record JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_shadow_run_id TEXT;
  v_current_ranking_id UUID;
  v_policy_bundle_version TEXT;
  v_profile_maturity TEXT;
  v_profile_fingerprint TEXT;
  v_session_fingerprint TEXT;
  v_reference_time TIMESTAMPTZ;
  v_seed TEXT;
  v_baseline_ranking_ids UUID[];
  v_shadow_ranking_ids UUID[];
  v_candidate_count INTEGER;
  v_changed_position_count INTEGER;
  v_protected_identity_count INTEGER;
  v_computed_changed_count INTEGER;
  v_inserted_id BIGINT;
  v_existing_matches BOOLEAN;
BEGIN
  IF p_record IS NULL OR jsonb_typeof(p_record) <> 'object' THEN
    RAISE EXCEPTION 'RF-1 shadow record must be a JSON object' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_shadow_run_id := p_record ->> 'shadow_run_id';
    v_current_ranking_id := (p_record ->> 'current_ranking_id')::UUID;
    v_policy_bundle_version := p_record ->> 'policy_bundle_version';
    v_profile_maturity := p_record ->> 'profile_maturity';
    v_profile_fingerprint := p_record ->> 'profile_fingerprint';
    v_session_fingerprint := NULLIF(p_record ->> 'session_fingerprint', '');
    v_reference_time := (p_record ->> 'reference_time')::TIMESTAMPTZ;
    v_seed := p_record ->> 'seed';

    SELECT COALESCE(array_agg(value::UUID ORDER BY ordinality), ARRAY[]::UUID[])
    INTO v_baseline_ranking_ids
    FROM jsonb_array_elements_text(COALESCE(p_record -> 'baseline_ranking_ids', '[]'::JSONB)) WITH ORDINALITY;

    SELECT COALESCE(array_agg(value::UUID ORDER BY ordinality), ARRAY[]::UUID[])
    INTO v_shadow_ranking_ids
    FROM jsonb_array_elements_text(COALESCE(p_record -> 'shadow_ranking_ids', '[]'::JSONB)) WITH ORDINALITY;

    v_candidate_count := (p_record ->> 'candidate_count')::INTEGER;
    v_changed_position_count := (p_record ->> 'changed_position_count')::INTEGER;
    v_protected_identity_count := (p_record ->> 'protected_identity_count')::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid RF-1 shadow record shape' USING ERRCODE = '22023';
  END;

  IF v_shadow_run_id IS NULL OR v_shadow_run_id = '' OR btrim(v_shadow_run_id) <> v_shadow_run_id THEN
    RAISE EXCEPTION 'RF-1 shadow_run_id is required and must be trimmed' USING ERRCODE = '22023';
  END IF;
  IF v_policy_bundle_version IS NULL OR v_policy_bundle_version = '' OR btrim(v_policy_bundle_version) <> v_policy_bundle_version THEN
    RAISE EXCEPTION 'RF-1 shadow policy bundle version is required' USING ERRCODE = '22023';
  END IF;
  IF v_profile_maturity NOT IN ('EMPTY', 'EMERGING', 'ESTABLISHED') THEN
    RAISE EXCEPTION 'unsupported RF-1 shadow profile maturity' USING ERRCODE = '22023';
  END IF;
  IF v_profile_fingerprint IS NULL OR v_profile_fingerprint = '' OR btrim(v_profile_fingerprint) <> v_profile_fingerprint THEN
    RAISE EXCEPTION 'RF-1 shadow profile fingerprint is required' USING ERRCODE = '22023';
  END IF;
  IF v_session_fingerprint IS NOT NULL AND (v_session_fingerprint = '' OR btrim(v_session_fingerprint) <> v_session_fingerprint) THEN
    RAISE EXCEPTION 'invalid RF-1 shadow session fingerprint' USING ERRCODE = '22023';
  END IF;
  IF v_seed IS NULL OR v_seed = '' OR btrim(v_seed) <> v_seed THEN
    RAISE EXCEPTION 'RF-1 shadow seed is required and must be trimmed' USING ERRCODE = '22023';
  END IF;
  IF v_candidate_count < 0 OR v_candidate_count > 100
    OR cardinality(v_baseline_ranking_ids) <> v_candidate_count
    OR cardinality(v_shadow_ranking_ids) <> v_candidate_count THEN
    RAISE EXCEPTION 'RF-1 shadow candidate count is invalid' USING ERRCODE = '22023';
  END IF;
  IF v_changed_position_count < 0 OR v_changed_position_count > v_candidate_count THEN
    RAISE EXCEPTION 'RF-1 shadow changed position count is invalid' USING ERRCODE = '22023';
  END IF;
  IF v_protected_identity_count < 0 OR v_protected_identity_count > v_candidate_count THEN
    RAISE EXCEPTION 'RF-1 shadow protected identity count is invalid' USING ERRCODE = '22023';
  END IF;

  IF (SELECT COUNT(*) FROM unnest(v_baseline_ranking_ids))
    <> (SELECT COUNT(DISTINCT ranking_id) FROM unnest(v_baseline_ranking_ids) AS ranking_id) THEN
    RAISE EXCEPTION 'RF-1 shadow baseline contains duplicate ranking IDs' USING ERRCODE = '22023';
  END IF;
  IF (SELECT COUNT(*) FROM unnest(v_shadow_ranking_ids))
    <> (SELECT COUNT(DISTINCT ranking_id) FROM unnest(v_shadow_ranking_ids) AS ranking_id) THEN
    RAISE EXCEPTION 'RF-1 shadow result contains duplicate ranking IDs' USING ERRCODE = '22023';
  END IF;
  IF NOT (v_baseline_ranking_ids <@ v_shadow_ranking_ids AND v_shadow_ranking_ids <@ v_baseline_ranking_ids) THEN
    RAISE EXCEPTION 'RF-1 shadow result must preserve the complete baseline candidate set' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_computed_changed_count
  FROM generate_subscripts(v_baseline_ranking_ids, 1) AS g(position)
  WHERE v_baseline_ranking_ids[g.position] IS DISTINCT FROM v_shadow_ranking_ids[g.position];

  IF v_computed_changed_count <> v_changed_position_count THEN
    RAISE EXCEPTION 'RF-1 shadow changed position count does not match the supplied ordering' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.rankings r
  WHERE r.id = v_current_ranking_id
    AND r.status = 'published'
    AND r.moderation_status IN ('clean', 'suggestive')
    AND r.image_moderation_status IN ('clean', 'suggestive');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RF-1 shadow source ranking is not public' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.rf1_shadow_runs(
    shadow_run_id,
    current_ranking_id,
    policy_bundle_version,
    profile_maturity,
    profile_fingerprint,
    session_fingerprint,
    reference_time,
    seed,
    baseline_ranking_ids,
    shadow_ranking_ids,
    candidate_count,
    changed_position_count,
    protected_identity_count
  ) VALUES (
    v_shadow_run_id,
    v_current_ranking_id,
    v_policy_bundle_version,
    v_profile_maturity,
    v_profile_fingerprint,
    v_session_fingerprint,
    v_reference_time,
    v_seed,
    v_baseline_ranking_ids,
    v_shadow_ranking_ids,
    v_candidate_count,
    v_changed_position_count,
    v_protected_identity_count
  )
  ON CONFLICT (shadow_run_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.rf1_shadow_runs s
      WHERE s.shadow_run_id = v_shadow_run_id
        AND s.current_ranking_id = v_current_ranking_id
        AND s.policy_bundle_version = v_policy_bundle_version
        AND s.profile_maturity = v_profile_maturity
        AND s.profile_fingerprint = v_profile_fingerprint
        AND s.session_fingerprint IS NOT DISTINCT FROM v_session_fingerprint
        AND s.reference_time = v_reference_time
        AND s.seed = v_seed
        AND s.baseline_ranking_ids = v_baseline_ranking_ids
        AND s.shadow_ranking_ids = v_shadow_ranking_ids
        AND s.candidate_count = v_candidate_count
        AND s.changed_position_count = v_changed_position_count
        AND s.protected_identity_count = v_protected_identity_count
    ) INTO v_existing_matches;

    IF NOT v_existing_matches THEN
      RAISE EXCEPTION 'conflicting RF-1 shadow replay for %', v_shadow_run_id USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'inserted', v_inserted_id IS NOT NULL,
    'replayed', v_inserted_id IS NULL,
    'shadow_run_id', v_shadow_run_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_rf1_shadow_run(JSONB)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_rf1_shadow_run(JSONB)
TO service_role;

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
  IF v_related_ranking_clicks = 0 THEN
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
      'related_outcome_evidence', CASE WHEN v_related_ranking_clicks > 0 THEN 'PRESENT_REVIEW_REQUIRED' ELSE 'MISSING' END,
      'low_exposure_evidence', CASE WHEN v_rf1_exposures > 0 THEN 'PRESENT_REVIEW_REQUIRED' ELSE 'MISSING' END
    ),
    'counts', jsonb_build_object(
      'published_rankings', v_published_rankings,
      'changed_bookmark_events', v_changed_bookmark_events,
      'bookmark_users', v_bookmark_users,
      'product_usage_events', v_product_usage_events,
      'related_ranking_clicks', v_related_ranking_clicks,
      'rf1_exposures', v_rf1_exposures,
      'shadow_runs', v_shadow_runs
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_rf1_calibration_evidence_summary()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_rf1_calibration_evidence_summary()
TO service_role;

COMMIT;
