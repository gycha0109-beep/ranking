BEGIN;

ALTER FUNCTION public.check_ranking_category_consistency() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.is_admin() SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.check_ranking_category_consistency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

DROP POLICY IF EXISTS "Items viewable by everyone if active" ON public.items;
CREATE POLICY "Items viewable by everyone if active" ON public.items FOR SELECT USING (
  public.is_admin() OR (
    auth.role() = 'anon' AND status = 'active'
    AND moderation_status IN ('clean', 'suggestive')
    AND image_moderation_status IN ('clean', 'suggestive')
  )
);

DROP POLICY IF EXISTS "Rankings select policy" ON public.rankings;
CREATE POLICY "Rankings select policy" ON public.rankings FOR SELECT USING (
  public.is_admin() OR (
    auth.role() = 'anon' AND status = 'published'
    AND moderation_status IN ('clean', 'suggestive')
    AND image_moderation_status IN ('clean', 'suggestive')
  )
);

DROP POLICY IF EXISTS "Ranking entries select policy" ON public.ranking_entries;
CREATE POLICY "Ranking entries select policy" ON public.ranking_entries FOR SELECT USING (
  public.is_admin() OR (
    auth.role() = 'anon'
    AND moderation_status IN ('clean', 'suggestive')
    AND EXISTS (
      SELECT 1 FROM public.rankings r
      WHERE r.id = ranking_id
        AND r.status = 'published'
        AND r.moderation_status IN ('clean', 'suggestive')
        AND r.image_moderation_status IN ('clean', 'suggestive')
    )
  )
);

DROP POLICY IF EXISTS "Comments viewable if visible" ON public.comments;
CREATE POLICY "Comments viewable if visible" ON public.comments FOR SELECT USING (
  public.is_admin() OR (
    auth.role() = 'anon' AND status = 'visible'
    AND moderation_status IN ('clean', 'suggestive')
  )
);

REVOKE SELECT ON TABLE public.rankings FROM anon, authenticated;
REVOKE SELECT ON TABLE public.items FROM anon, authenticated;
REVOKE SELECT ON TABLE public.ranking_entries FROM anon, authenticated;
REVOKE SELECT ON TABLE public.comments FROM anon, authenticated;

GRANT SELECT (
  id, category_id, subcategory_id, title, slug, summary, body, ranking_type,
  scope_json, status, featured, cover_image_url, seo_title, seo_description,
  published_at, created_at, updated_at, moderation_status, moderation_reason,
  image_moderation_status, image_moderation_reason
) ON public.rankings TO anon;

GRANT SELECT (
  id, title, slug, description, item_type, image_url, brand_or_creator,
  external_url, affiliate_url, status, metadata, created_at, updated_at,
  moderation_status, moderation_reason, image_moderation_status,
  image_moderation_reason
) ON public.items TO anon;

GRANT SELECT (
  id, ranking_id, item_id, position, reason, editor_score, score_json,
  sponsor_flag, metadata, created_at, updated_at, moderation_status,
  moderation_reason
) ON public.ranking_entries TO anon;

GRANT SELECT (
  id, user_id, ranking_id, item_id, parent_id, body, status, created_at,
  updated_at, moderation_status, moderation_reason
) ON public.comments TO anon;

GRANT SELECT ON TABLE public.rankings TO authenticated;
GRANT SELECT ON TABLE public.items TO authenticated;
GRANT SELECT ON TABLE public.ranking_entries TO authenticated;
GRANT SELECT ON TABLE public.comments TO authenticated;

COMMIT;
