-- IA-2C follow-up: cover the auth.users foreign key used for governance provenance.
-- This does not change Subject/alias semantics or public privileges.

CREATE INDEX IF NOT EXISTS idx_ranking_semantic_subject_aliases_created_by
  ON public.ranking_semantic_subject_aliases(created_by)
  WHERE created_by IS NOT NULL;
