-- IA-2 privilege hardening.
-- Supabase default table privileges can leave non-DML capabilities such as
-- TRUNCATE, REFERENCES, and TRIGGER on a newly created public table.
-- Public clients need read-only discovery access and nothing else.

REVOKE ALL PRIVILEGES ON TABLE public.ranking_semantic_projections FROM anon, authenticated;
GRANT SELECT ON TABLE public.ranking_semantic_projections TO anon, authenticated;
