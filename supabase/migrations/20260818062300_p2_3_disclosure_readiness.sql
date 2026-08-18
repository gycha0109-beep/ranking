BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_ranking_sponsorship_disclosures(p_ranking_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', sp.id,
    'sponsor_name', s.name,
    'sponsor_website_url', s.website_url,
    'target_type', sp.target_type,
    'ranking_id', sp.ranking_id,
    'item_id', sp.item_id,
    'relationship_type', sp.relationship_type,
    'disclosure_text', sp.disclosure_text,
    'influence_scope', sp.influence_scope,
    'influence_note', sp.influence_note,
    'starts_at', sp.starts_at,
    'ends_at', sp.ends_at,
    'published_at', sp.published_at,
    'period_state', CASE
      WHEN sp.starts_at > NOW() THEN 'upcoming'
      WHEN sp.ends_at IS NOT NULL AND sp.ends_at <= NOW() THEN 'historical'
      ELSE 'current'
    END
  ) ORDER BY sp.starts_at DESC, sp.id), '[]'::JSONB)
  FROM public.sponsorships sp
  JOIN public.sponsors s ON s.id = sp.sponsor_id
  JOIN public.rankings r ON r.id = sp.ranking_id AND r.status = 'published'
  WHERE sp.ranking_id = p_ranking_id
    AND sp.target_type IN ('ranking', 'placement')
    AND sp.status = 'published';
$$;

CREATE OR REPLACE FUNCTION public.get_public_item_sponsorship_disclosures(p_item_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', sp.id,
    'sponsor_name', s.name,
    'sponsor_website_url', s.website_url,
    'target_type', sp.target_type,
    'item_id', sp.item_id,
    'relationship_type', sp.relationship_type,
    'disclosure_text', sp.disclosure_text,
    'influence_scope', sp.influence_scope,
    'influence_note', sp.influence_note,
    'starts_at', sp.starts_at,
    'ends_at', sp.ends_at,
    'published_at', sp.published_at,
    'period_state', CASE
      WHEN sp.starts_at > NOW() THEN 'upcoming'
      WHEN sp.ends_at IS NOT NULL AND sp.ends_at <= NOW() THEN 'historical'
      ELSE 'current'
    END
  ) ORDER BY sp.starts_at DESC, sp.id), '[]'::JSONB)
  FROM public.sponsorships sp
  JOIN public.sponsors s ON s.id = sp.sponsor_id
  JOIN public.items i ON i.id = sp.item_id AND i.status = 'active'
  WHERE sp.item_id = p_item_id
    AND sp.target_type = 'item'
    AND sp.status = 'published';
$$;

CREATE OR REPLACE FUNCTION public.admin_get_sponsorship_readiness()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_unresolved INTEGER;
  v_reconciled INTEGER;
  v_published INTEGER;
BEGIN
  PERFORM private.assert_admin_capability('sponsorship_manage');

  SELECT COUNT(*) INTO v_unresolved
  FROM public.ranking_entries
  WHERE sponsor_flag IS TRUE;

  SELECT COUNT(*) INTO v_reconciled
  FROM public.sponsorship_events
  WHERE action = 'legacy_reconcile';

  SELECT COUNT(*) INTO v_published
  FROM public.sponsorships
  WHERE status = 'published';

  RETURN jsonb_build_object(
    'unresolved_legacy_flags', v_unresolved,
    'legacy_reconcile_events', v_reconciled,
    'published_sponsorships', v_published,
    'normalized_authority_ready', v_unresolved = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_ranking_sponsorship_disclosures(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_item_sponsorship_disclosures(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_ranking_sponsorship_disclosures(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_item_sponsorship_disclosures(UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_get_sponsorship_readiness() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_sponsorship_readiness() TO authenticated;

COMMIT;
