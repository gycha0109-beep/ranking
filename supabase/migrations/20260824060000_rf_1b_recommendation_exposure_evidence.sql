BEGIN;

CREATE TABLE public.rf1_recommendation_exposures (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exposure_id TEXT NOT NULL,
  recommendation_run_id TEXT NOT NULL,
  surface TEXT NOT NULL,
  ranking_id UUID NOT NULL REFERENCES public.rankings(id) ON DELETE CASCADE,
  ranking_mode TEXT NOT NULL,
  identity_relation TEXT,
  source_rank INTEGER NOT NULL,
  final_rank INTEGER NOT NULL,
  policy_bundle_version TEXT NOT NULL,
  profile_version TEXT NOT NULL,
  profile_fingerprint TEXT NOT NULL,
  session_fingerprint TEXT,
  score_breakdown JSONB,
  explored BOOLEAN NOT NULL DEFAULT FALSE,
  diversity_relaxations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  exposed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rf1_recommendation_exposures_exposure_id_trimmed
    CHECK (exposure_id <> '' AND btrim(exposure_id) = exposure_id),
  CONSTRAINT rf1_recommendation_exposures_run_id_trimmed
    CHECK (recommendation_run_id <> '' AND btrim(recommendation_run_id) = recommendation_run_id),
  CONSTRAINT rf1_recommendation_exposures_surface
    CHECK (surface = 'related_rankings'),
  CONSTRAINT rf1_recommendation_exposures_mode
    CHECK (ranking_mode IN ('IA2_PROTECTED', 'RF1_RERANKED')),
  CONSTRAINT rf1_recommendation_exposures_identity_relation
    CHECK (
      identity_relation IS NULL
      OR identity_relation IN ('same_version', 'same_view', 'same_claim', 'same_subject')
    ),
  CONSTRAINT rf1_recommendation_exposures_rank_positive
    CHECK (source_rank >= 1 AND final_rank >= 1),
  CONSTRAINT rf1_recommendation_exposures_policy_version_trimmed
    CHECK (policy_bundle_version <> '' AND btrim(policy_bundle_version) = policy_bundle_version),
  CONSTRAINT rf1_recommendation_exposures_profile_version_trimmed
    CHECK (profile_version <> '' AND btrim(profile_version) = profile_version),
  CONSTRAINT rf1_recommendation_exposures_profile_fingerprint_trimmed
    CHECK (profile_fingerprint <> '' AND btrim(profile_fingerprint) = profile_fingerprint),
  CONSTRAINT rf1_recommendation_exposures_session_fingerprint_trimmed
    CHECK (session_fingerprint IS NULL OR (session_fingerprint <> '' AND btrim(session_fingerprint) = session_fingerprint)),
  CONSTRAINT rf1_recommendation_exposures_mode_shape
    CHECK (
      (
        ranking_mode = 'IA2_PROTECTED'
        AND identity_relation IS NOT NULL
        AND score_breakdown IS NULL
        AND explored = FALSE
        AND cardinality(diversity_relaxations) = 0
      )
      OR
      (
        ranking_mode = 'RF1_RERANKED'
        AND identity_relation IS NULL
        AND score_breakdown IS NOT NULL
      )
    ),
  CONSTRAINT rf1_recommendation_exposures_score_shape
    CHECK (
      score_breakdown IS NULL
      OR (
        jsonb_typeof(score_breakdown) = 'object'
        AND score_breakdown ?& ARRAY[
          'neighborhoodScore',
          'interestScore',
          'freshnessScore',
          'popularityScore',
          'lowExposureBoost',
          'baseScore',
          'finalScore'
        ]
        AND jsonb_typeof(score_breakdown -> 'neighborhoodScore') = 'number'
        AND jsonb_typeof(score_breakdown -> 'interestScore') = 'number'
        AND jsonb_typeof(score_breakdown -> 'freshnessScore') = 'number'
        AND jsonb_typeof(score_breakdown -> 'popularityScore') = 'number'
        AND jsonb_typeof(score_breakdown -> 'lowExposureBoost') = 'number'
        AND jsonb_typeof(score_breakdown -> 'baseScore') = 'number'
        AND jsonb_typeof(score_breakdown -> 'finalScore') = 'number'
        AND (score_breakdown ->> 'neighborhoodScore')::NUMERIC BETWEEN 0 AND 1
        AND (score_breakdown ->> 'interestScore')::NUMERIC BETWEEN 0 AND 1
        AND (score_breakdown ->> 'freshnessScore')::NUMERIC BETWEEN 0 AND 1
        AND (score_breakdown ->> 'popularityScore')::NUMERIC BETWEEN 0 AND 1
        AND (score_breakdown ->> 'lowExposureBoost')::NUMERIC BETWEEN 0 AND 1
        AND (score_breakdown ->> 'baseScore')::NUMERIC BETWEEN 0 AND 1
        AND (score_breakdown ->> 'finalScore')::NUMERIC BETWEEN 0 AND 1
      )
    )
);

CREATE UNIQUE INDEX uq_rf1_recommendation_exposures_exposure_id
  ON public.rf1_recommendation_exposures(exposure_id);

CREATE UNIQUE INDEX uq_rf1_recommendation_exposures_run_ranking
  ON public.rf1_recommendation_exposures(recommendation_run_id, ranking_id);

CREATE INDEX idx_rf1_recommendation_exposures_ranking_time
  ON public.rf1_recommendation_exposures(ranking_id, exposed_at DESC);

CREATE INDEX idx_rf1_recommendation_exposures_run
  ON public.rf1_recommendation_exposures(recommendation_run_id, final_rank);

ALTER TABLE public.rf1_recommendation_exposures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rf1_recommendation_exposures FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.rf1_recommendation_exposures_id_seq FROM PUBLIC, anon, authenticated, service_role;

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
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_rf1_recommendation_exposures(JSONB)
TO service_role;

CREATE OR REPLACE FUNCTION public.get_rf1_candidate_signals(
  p_ranking_ids UUID[],
  p_exposure_since TIMESTAMPTZ
)
RETURNS TABLE (
  ranking_id UUID,
  item_ids UUID[],
  unique_view_count BIGINT,
  like_count BIGINT,
  bookmark_count BIGINT,
  recent_exposure_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
BEGIN
  IF p_ranking_ids IS NULL OR cardinality(p_ranking_ids) < 1 OR cardinality(p_ranking_ids) > 100 THEN
    RAISE EXCEPTION 'RF-1 candidate ranking IDs must contain between 1 and 100 IDs' USING ERRCODE = '22023';
  END IF;
  IF p_exposure_since IS NULL THEN
    RAISE EXCEPTION 'RF-1 exposure window start is required' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH requested AS (
    SELECT DISTINCT unnest(p_ranking_ids) AS ranking_id
  ),
  eligible AS (
    SELECT r.id AS ranking_id
    FROM requested req
    JOIN public.rankings r ON r.id = req.ranking_id
    WHERE r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
  ),
  entry_agg AS (
    SELECT
      e.ranking_id,
      array_agg(e.item_id ORDER BY e.position, e.id) AS item_ids
    FROM public.ranking_entries e
    JOIN public.items i ON i.id = e.item_id
    JOIN eligible el ON el.ranking_id = e.ranking_id
    WHERE e.moderation_status IN ('clean', 'suggestive')
      AND i.status = 'active'
      AND i.moderation_status IN ('clean', 'suggestive')
      AND i.image_moderation_status IN ('clean', 'suggestive')
    GROUP BY e.ranking_id
  ),
  like_agg AS (
    SELECT l.ranking_id, COUNT(*)::BIGINT AS like_count
    FROM public.content_likes l
    JOIN eligible el ON el.ranking_id = l.ranking_id
    WHERE l.ranking_id IS NOT NULL
    GROUP BY l.ranking_id
  ),
  bookmark_agg AS (
    SELECT b.ranking_id, COUNT(*)::BIGINT AS bookmark_count
    FROM public.content_bookmarks b
    JOIN eligible el ON el.ranking_id = b.ranking_id
    WHERE b.ranking_id IS NOT NULL
    GROUP BY b.ranking_id
  ),
  exposure_agg AS (
    SELECT x.ranking_id, COUNT(*)::BIGINT AS recent_exposure_count
    FROM public.rf1_recommendation_exposures x
    JOIN eligible el ON el.ranking_id = x.ranking_id
    WHERE x.exposed_at >= p_exposure_since
    GROUP BY x.ranking_id
  )
  SELECT
    el.ranking_id,
    COALESCE(entries.item_ids, ARRAY[]::UUID[]) AS item_ids,
    COALESCE(views.unique_view_count, 0)::BIGINT AS unique_view_count,
    COALESCE(likes.like_count, 0)::BIGINT AS like_count,
    COALESCE(bookmarks.bookmark_count, 0)::BIGINT AS bookmark_count,
    COALESCE(exposures.recent_exposure_count, 0)::BIGINT AS recent_exposure_count
  FROM eligible el
  LEFT JOIN entry_agg entries ON entries.ranking_id = el.ranking_id
  LEFT JOIN public.content_view_totals views ON views.ranking_id = el.ranking_id
  LEFT JOIN like_agg likes ON likes.ranking_id = el.ranking_id
  LEFT JOIN bookmark_agg bookmarks ON bookmarks.ranking_id = el.ranking_id
  LEFT JOIN exposure_agg exposures ON exposures.ranking_id = el.ranking_id
  ORDER BY el.ranking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_rf1_candidate_signals(UUID[], TIMESTAMPTZ)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_rf1_candidate_signals(UUID[], TIMESTAMPTZ)
TO service_role;

COMMIT;
