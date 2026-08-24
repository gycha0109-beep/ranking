BEGIN;

ALTER TABLE public.rf1_shadow_runs
  ADD COLUMN policy_hypothesis_fingerprint TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.rf1_shadow_runs) THEN
    RAISE EXCEPTION 'RF-1H cannot infer policy hypothesis provenance for pre-existing SHADOW rows';
  END IF;
END;
$$;

ALTER TABLE public.rf1_shadow_runs
  ALTER COLUMN policy_hypothesis_fingerprint SET NOT NULL,
  ADD CONSTRAINT rf1_shadow_runs_policy_hypothesis_fingerprint_trimmed
    CHECK (
      policy_hypothesis_fingerprint <> ''
      AND btrim(policy_hypothesis_fingerprint) = policy_hypothesis_fingerprint
    );

CREATE INDEX idx_rf1_shadow_runs_policy_hypothesis_reference
  ON public.rf1_shadow_runs(policy_hypothesis_fingerprint, reference_time DESC);

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
  v_policy_hypothesis_fingerprint TEXT;
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
    v_policy_hypothesis_fingerprint := p_record ->> 'policy_hypothesis_fingerprint';
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
  IF v_policy_hypothesis_fingerprint IS NULL
    OR v_policy_hypothesis_fingerprint = ''
    OR btrim(v_policy_hypothesis_fingerprint) <> v_policy_hypothesis_fingerprint THEN
    RAISE EXCEPTION 'RF-1 shadow policy hypothesis fingerprint is required' USING ERRCODE = '22023';
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
  IF v_candidate_count < 1 OR v_candidate_count > 100
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

  IF v_current_ranking_id = ANY(v_baseline_ranking_ids)
    OR v_current_ranking_id = ANY(v_shadow_ranking_ids) THEN
    RAISE EXCEPTION 'RF-1 shadow source ranking must not appear in candidate orderings' USING ERRCODE = '22023';
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
    policy_hypothesis_fingerprint,
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
    v_policy_hypothesis_fingerprint,
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
        AND s.policy_hypothesis_fingerprint = v_policy_hypothesis_fingerprint
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
    'shadow_run_id', v_shadow_run_id,
    'policy_hypothesis_fingerprint', v_policy_hypothesis_fingerprint
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_rf1_shadow_run(JSONB)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_rf1_shadow_run(JSONB)
TO service_role;

COMMIT;
