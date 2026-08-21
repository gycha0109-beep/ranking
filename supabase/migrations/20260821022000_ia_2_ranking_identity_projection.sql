-- IA-2 — Ranking Identity & Coordinate Architecture
-- Raw authored ranking content remains authoritative. Semantic projections are optional,
-- post-hoc discovery metadata and MUST NOT gate ranking creation or publication.

CREATE TABLE IF NOT EXISTS public.ranking_semantic_projections (
  ranking_id uuid PRIMARY KEY REFERENCES public.rankings(id) ON DELETE CASCADE,
  subject_key text NOT NULL,
  intent_key text,
  coordinates jsonb NOT NULL DEFAULT '{}'::jsonb,
  method_key text,
  version_coordinates jsonb NOT NULL DEFAULT '{}'::jsonb,
  classification_state text NOT NULL DEFAULT 'inferred',
  confidence numeric(4,3) NOT NULL DEFAULT 1.000,
  projection_version text NOT NULL,
  claim_signature text NOT NULL,
  view_signature text NOT NULL,
  version_signature text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ranking_semantic_projections_subject_key_check
    CHECK (subject_key ~ '^[a-z0-9][a-z0-9._/-]{0,127}$'),
  CONSTRAINT ranking_semantic_projections_intent_key_check
    CHECK (intent_key IS NULL OR intent_key ~ '^[a-z0-9][a-z0-9._/-]{0,127}$'),
  CONSTRAINT ranking_semantic_projections_method_key_check
    CHECK (method_key IS NULL OR method_key ~ '^[a-z0-9][a-z0-9._/-]{0,127}$'),
  CONSTRAINT ranking_semantic_projections_coordinates_object_check
    CHECK (jsonb_typeof(coordinates) = 'object'),
  CONSTRAINT ranking_semantic_projections_version_coordinates_object_check
    CHECK (jsonb_typeof(version_coordinates) = 'object'),
  CONSTRAINT ranking_semantic_projections_classification_state_check
    CHECK (classification_state IN ('inferred', 'reviewed')),
  CONSTRAINT ranking_semantic_projections_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT ranking_semantic_projections_projection_version_check
    CHECK (length(btrim(projection_version)) BETWEEN 1 AND 120)
);

COMMENT ON TABLE public.ranking_semantic_projections IS
  'IA-2 optional post-hoc semantic projection. Absence means unclassified and never blocks ranking creation/publication.';
COMMENT ON COLUMN public.ranking_semantic_projections.coordinates IS
  'Open-world non-version semantic qualifiers. Keys are classifier/review vocabulary, not authoring requirements.';
COMMENT ON COLUMN public.ranking_semantic_projections.version_coordinates IS
  'Time/snapshot/version qualifiers kept separate from the canonical ranking claim.';
COMMENT ON COLUMN public.ranking_semantic_projections.claim_signature IS
  'Derived grouping signature for Subject + Intent + non-version coordinates.';
COMMENT ON COLUMN public.ranking_semantic_projections.view_signature IS
  'Derived grouping signature for Claim + Method/View.';
COMMENT ON COLUMN public.ranking_semantic_projections.version_signature IS
  'Derived signature for Claim + Method/View + Version coordinates. It is intentionally non-unique.';

CREATE OR REPLACE FUNCTION private.ia_2_refresh_projection_signatures()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.subject_key := lower(btrim(NEW.subject_key));
  NEW.intent_key := nullif(lower(btrim(coalesce(NEW.intent_key, ''))), '');
  NEW.method_key := nullif(lower(btrim(coalesce(NEW.method_key, ''))), '');
  NEW.projection_version := btrim(NEW.projection_version);

  NEW.claim_signature := 'ia2:claim:' || md5(
    concat_ws('|',
      NEW.subject_key,
      coalesce(NEW.intent_key, ''),
      NEW.coordinates::text
    )
  );

  NEW.view_signature := 'ia2:view:' || md5(
    concat_ws('|',
      NEW.subject_key,
      coalesce(NEW.intent_key, ''),
      NEW.coordinates::text,
      coalesce(NEW.method_key, '')
    )
  );

  NEW.version_signature := 'ia2:version:' || md5(
    concat_ws('|',
      NEW.subject_key,
      coalesce(NEW.intent_key, ''),
      NEW.coordinates::text,
      coalesce(NEW.method_key, ''),
      NEW.version_coordinates::text
    )
  );

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ia_2_refresh_projection_signatures
  ON public.ranking_semantic_projections;

CREATE TRIGGER trg_ia_2_refresh_projection_signatures
BEFORE INSERT OR UPDATE OF subject_key, intent_key, coordinates, method_key, version_coordinates, projection_version
ON public.ranking_semantic_projections
FOR EACH ROW
EXECUTE FUNCTION private.ia_2_refresh_projection_signatures();

CREATE INDEX IF NOT EXISTS idx_ranking_semantic_projections_subject_key
  ON public.ranking_semantic_projections(subject_key, ranking_id);
CREATE INDEX IF NOT EXISTS idx_ranking_semantic_projections_claim_signature
  ON public.ranking_semantic_projections(claim_signature, ranking_id);
CREATE INDEX IF NOT EXISTS idx_ranking_semantic_projections_view_signature
  ON public.ranking_semantic_projections(view_signature, ranking_id);
CREATE INDEX IF NOT EXISTS idx_ranking_semantic_projections_version_signature
  ON public.ranking_semantic_projections(version_signature, ranking_id);

ALTER TABLE public.ranking_semantic_projections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ranking_semantic_projections_public_read
  ON public.ranking_semantic_projections;

CREATE POLICY ranking_semantic_projections_public_read
ON public.ranking_semantic_projections
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rankings r
    WHERE r.id = ranking_semantic_projections.ranking_id
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
  )
);

GRANT SELECT ON public.ranking_semantic_projections TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ranking_semantic_projections FROM anon, authenticated;

-- Initial projections are deterministic interpretations of the current authoritative seed.
-- They are marked inferred, not reviewed. No projection changes ranking content or status.
WITH seed(
  slug,
  subject_key,
  intent_key,
  coordinates,
  method_key,
  version_coordinates,
  confidence,
  projection_version
) AS (
  VALUES
    ('fifa-women-world-ranking-2026-06-top-5', 'fifa-world-ranking', 'official-ordering', '{"team_gender":"women"}'::jsonb, 'fifa-ranking', '{"as_of":"2026-06-16"}'::jsonb, 0.990::numeric, 'ia-2-seed-v1'),
    ('fifa-men-world-ranking-2026-07-top-5', 'fifa-world-ranking', 'official-ordering', '{"team_gender":"men"}'::jsonb, 'fifa-ranking', '{"as_of":"2026-07-20"}'::jsonb, 0.990::numeric, 'ia-2-seed-v1'),
    ('pisa-2022-science-top-5', 'pisa-country-performance', 'metric-comparison', '{"domain":"science"}'::jsonb, 'oecd-pisa-mean-score', '{"cycle":"2022"}'::jsonb, 0.990::numeric, 'ia-2-seed-v1'),
    ('pisa-2022-reading-top-5', 'pisa-country-performance', 'metric-comparison', '{"domain":"reading"}'::jsonb, 'oecd-pisa-mean-score', '{"cycle":"2022"}'::jsonb, 0.990::numeric, 'ia-2-seed-v1'),
    ('pisa-2022-mathematics-top-5', 'pisa-country-performance', 'metric-comparison', '{"domain":"mathematics"}'::jsonb, 'oecd-pisa-mean-score', '{"cycle":"2022"}'::jsonb, 0.990::numeric, 'ia-2-seed-v1'),
    ('unesco-world-heritage-properties-2026-top-5', 'unesco-world-heritage-country-count', 'metric-comparison', '{}'::jsonb, 'unesco-property-count', '{"as_of":"2026-08-19"}'::jsonb, 0.990::numeric, 'ia-2-seed-v1'),
    ('kbo-team-winning-percentage-2025-top-5', 'kbo-team-season-performance', 'metric-comparison', '{"metric":"winning-percentage"}'::jsonb, 'kbo-official-team-stat', '{"season":"2025"}'::jsonb, 0.990::numeric, 'ia-2-seed-v1'),
    ('kbo-team-era-2025-top-5', 'kbo-team-season-performance', 'metric-comparison', '{"metric":"era"}'::jsonb, 'kbo-official-team-stat', '{"season":"2025"}'::jsonb, 0.990::numeric, 'ia-2-seed-v1'),
    ('kbo-team-batting-average-2025-top-5', 'kbo-team-season-performance', 'metric-comparison', '{"metric":"batting-average"}'::jsonb, 'kbo-official-team-stat', '{"season":"2025"}'::jsonb, 0.990::numeric, 'ia-2-seed-v1'),
    ('world-nominal-gdp-2024-top-5', 'world-country-nominal-gdp', 'metric-comparison', '{"unit":"current-usd"}'::jsonb, 'world-bank-wdi', '{"year":"2024"}'::jsonb, 0.990::numeric, 'ia-2-seed-v1'),
    ('korea-net-outmigration-rate-2025-top-3', 'korea-interregional-migration-rate', 'metric-comparison', '{"direction":"net-outmigration"}'::jsonb, 'korean-official-migration-statistics', '{"year":"2025"}'::jsonb, 0.980::numeric, 'ia-2-seed-v1'),
    ('korea-net-inmigration-rate-2025-top-3', 'korea-interregional-migration-rate', 'metric-comparison', '{"direction":"net-inmigration"}'::jsonb, 'korean-official-migration-statistics', '{"year":"2025"}'::jsonb, 0.980::numeric, 'ia-2-seed-v1'),
    ('world-population-2024-top-5', 'world-country-population', 'metric-comparison', '{}'::jsonb, 'world-bank-wdi', '{"year":"2024"}'::jsonb, 0.990::numeric, 'ia-2-seed-v1')
)
INSERT INTO public.ranking_semantic_projections (
  ranking_id,
  subject_key,
  intent_key,
  coordinates,
  method_key,
  version_coordinates,
  classification_state,
  confidence,
  projection_version,
  claim_signature,
  view_signature,
  version_signature
)
SELECT
  r.id,
  seed.subject_key,
  seed.intent_key,
  seed.coordinates,
  seed.method_key,
  seed.version_coordinates,
  'inferred',
  seed.confidence,
  seed.projection_version,
  '',
  '',
  ''
FROM seed
JOIN public.rankings r ON r.slug = seed.slug
ON CONFLICT (ranking_id) DO UPDATE
SET
  subject_key = EXCLUDED.subject_key,
  intent_key = EXCLUDED.intent_key,
  coordinates = EXCLUDED.coordinates,
  method_key = EXCLUDED.method_key,
  version_coordinates = EXCLUDED.version_coordinates,
  classification_state = EXCLUDED.classification_state,
  confidence = EXCLUDED.confidence,
  projection_version = EXCLUDED.projection_version;
