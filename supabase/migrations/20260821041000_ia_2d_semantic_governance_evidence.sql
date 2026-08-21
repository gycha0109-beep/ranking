-- IA-2D — Semantic Governance Observability & Fragmentation Baseline.
-- This evidence stream is admin/server-only and intentionally separate from MEASURE-1
-- real-user product telemetry. It records finalized semantic-governance decisions only.

CREATE TABLE IF NOT EXISTS public.ranking_semantic_governance_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL,
  ranking_id uuid REFERENCES public.rankings(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  input_subject_key text,
  canonical_subject_key text,
  resolution_kind text,
  suggestion_keys text[] NOT NULL DEFAULT '{}'::text[],
  selected_subject_key text,
  selected_rank smallint,
  same_version_advisory_count smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ranking_semantic_governance_event_type_check CHECK (
    event_type IN (
      'subject_decision_saved',
      'subject_alias_created',
      'subject_alias_deleted',
      'projection_cleared'
    )
  ),
  CONSTRAINT ranking_semantic_governance_input_key_check CHECK (
    input_subject_key IS NULL OR input_subject_key ~ '^[a-z0-9][a-z0-9._/-]{0,127}$'
  ),
  CONSTRAINT ranking_semantic_governance_canonical_key_check CHECK (
    canonical_subject_key IS NULL OR canonical_subject_key ~ '^[a-z0-9][a-z0-9._/-]{0,127}$'
  ),
  CONSTRAINT ranking_semantic_governance_selected_key_check CHECK (
    selected_subject_key IS NULL OR selected_subject_key ~ '^[a-z0-9][a-z0-9._/-]{0,127}$'
  ),
  CONSTRAINT ranking_semantic_governance_resolution_kind_check CHECK (
    resolution_kind IS NULL OR resolution_kind IN ('new', 'existing', 'alias', 'suggestion')
  ),
  CONSTRAINT ranking_semantic_governance_suggestion_count_check CHECK (
    cardinality(suggestion_keys) BETWEEN 0 AND 5
  ),
  CONSTRAINT ranking_semantic_governance_selected_rank_check CHECK (
    selected_rank IS NULL OR selected_rank BETWEEN 1 AND 5
  ),
  CONSTRAINT ranking_semantic_governance_same_version_count_check CHECK (
    same_version_advisory_count BETWEEN 0 AND 100
  ),
  CONSTRAINT ranking_semantic_governance_event_shape_check CHECK (
    CASE event_type
      WHEN 'subject_decision_saved' THEN
        ranking_id IS NOT NULL
        AND actor_user_id IS NOT NULL
        AND input_subject_key IS NOT NULL
        AND canonical_subject_key IS NOT NULL
        AND resolution_kind IS NOT NULL
        AND (
          (resolution_kind = 'suggestion' AND selected_subject_key = canonical_subject_key AND selected_rank IS NOT NULL)
          OR
          (resolution_kind <> 'suggestion' AND selected_subject_key IS NULL AND selected_rank IS NULL)
        )
      WHEN 'subject_alias_created' THEN
        actor_user_id IS NOT NULL
        AND input_subject_key IS NOT NULL
        AND canonical_subject_key IS NOT NULL
        AND resolution_kind IS NULL
        AND cardinality(suggestion_keys) = 0
        AND selected_subject_key IS NULL
        AND selected_rank IS NULL
        AND same_version_advisory_count = 0
      WHEN 'subject_alias_deleted' THEN
        actor_user_id IS NOT NULL
        AND input_subject_key IS NOT NULL
        AND canonical_subject_key IS NOT NULL
        AND resolution_kind IS NULL
        AND cardinality(suggestion_keys) = 0
        AND selected_subject_key IS NULL
        AND selected_rank IS NULL
        AND same_version_advisory_count = 0
      WHEN 'projection_cleared' THEN
        ranking_id IS NOT NULL
        AND actor_user_id IS NOT NULL
        AND input_subject_key IS NULL
        AND resolution_kind IS NULL
        AND cardinality(suggestion_keys) = 0
        AND selected_subject_key IS NULL
        AND selected_rank IS NULL
        AND same_version_advisory_count = 0
      ELSE FALSE
    END
  )
);

COMMENT ON TABLE public.ranking_semantic_governance_events IS
  'IA-2D append-only evidence for finalized admin semantic-governance decisions. It is not real-user product telemetry and stores no arbitrary JSON payload.';
COMMENT ON COLUMN public.ranking_semantic_governance_events.suggestion_keys IS
  'Deterministic Top-N canonical Subject suggestions visible at the finalized save decision, bounded to five normalized keys.';
COMMENT ON COLUMN public.ranking_semantic_governance_events.resolution_kind IS
  'How the finalized Subject decision resolved: new, existing, exact reviewed alias, or explicitly selected deterministic suggestion.';

CREATE INDEX IF NOT EXISTS idx_ranking_semantic_governance_created
  ON public.ranking_semantic_governance_events(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_semantic_governance_event_created
  ON public.ranking_semantic_governance_events(event_type, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_semantic_governance_canonical_created
  ON public.ranking_semantic_governance_events(canonical_subject_key, created_at DESC, id DESC)
  WHERE canonical_subject_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ranking_semantic_governance_actor
  ON public.ranking_semantic_governance_events(actor_user_id, created_at DESC)
  WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ranking_semantic_governance_ranking
  ON public.ranking_semantic_governance_events(ranking_id, created_at DESC)
  WHERE ranking_id IS NOT NULL;

ALTER TABLE public.ranking_semantic_governance_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.ranking_semantic_governance_events FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.ranking_semantic_governance_events_id_seq FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.ranking_semantic_governance_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ranking_semantic_governance_events_id_seq TO service_role;

CREATE OR REPLACE FUNCTION private.prevent_semantic_governance_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'ranking_semantic_governance_events is append-only' USING ERRCODE = '55000';
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_semantic_governance_event_mutation()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ranking_semantic_governance_append_only
  ON public.ranking_semantic_governance_events;
CREATE TRIGGER trg_ranking_semantic_governance_append_only
BEFORE UPDATE OR DELETE ON public.ranking_semantic_governance_events
FOR EACH ROW EXECUTE FUNCTION private.prevent_semantic_governance_event_mutation();
