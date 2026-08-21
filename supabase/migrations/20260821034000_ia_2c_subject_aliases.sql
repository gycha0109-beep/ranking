-- IA-2C — Canonical Subject Alias mapping.
-- This table is governance metadata only. It never becomes a publication requirement.
-- Canonical subjects continue to emerge from actual semantic projections; no closed taxonomy is introduced.

CREATE TABLE IF NOT EXISTS public.ranking_semantic_subject_aliases (
  alias_key text PRIMARY KEY,
  canonical_subject_key text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ranking_semantic_subject_aliases_alias_key_check
    CHECK (alias_key ~ '^[a-z0-9][a-z0-9._/-]{0,127}$'),
  CONSTRAINT ranking_semantic_subject_aliases_canonical_key_check
    CHECK (canonical_subject_key ~ '^[a-z0-9][a-z0-9._/-]{0,127}$'),
  CONSTRAINT ranking_semantic_subject_aliases_not_identity_check
    CHECK (alias_key <> canonical_subject_key)
);

COMMENT ON TABLE public.ranking_semantic_subject_aliases IS
  'IA-2C reviewed alias mapping for canonical semantic Subject reuse. Absence of an alias never blocks creating a new Subject.';
COMMENT ON COLUMN public.ranking_semantic_subject_aliases.alias_key IS
  'Normalized alternate Subject key. Exact matches may resolve to canonical_subject_key during reviewed ingestion.';
COMMENT ON COLUMN public.ranking_semantic_subject_aliases.canonical_subject_key IS
  'Canonical Subject key chosen by an admin. This is not a foreign key to a closed taxonomy.';

CREATE INDEX IF NOT EXISTS idx_ranking_semantic_subject_aliases_canonical
  ON public.ranking_semantic_subject_aliases(canonical_subject_key, alias_key);

ALTER TABLE public.ranking_semantic_subject_aliases ENABLE ROW LEVEL SECURITY;

-- Alias governance is admin/server-only. Public discovery does not need this mapping directly.
REVOKE ALL PRIVILEGES ON TABLE public.ranking_semantic_subject_aliases FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.ranking_semantic_subject_aliases TO service_role;
