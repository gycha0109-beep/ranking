-- AUDIT-R4: RLS / foreign-key performance hygiene.
-- Scope is deliberately bounded to advisor findings with verified semantics and query paths.

-- 1) Avoid per-row Auth function re-evaluation without changing policy meaning.
ALTER POLICY "Users can update their own profile"
ON public.profiles
USING ((SELECT auth.uid()) = id);

ALTER POLICY "Roles viewable by admin"
ON public.user_roles
USING (is_admin() OR ((SELECT auth.uid()) = user_id));

ALTER POLICY "ar_users_can_read_own_raw_inputs"
ON public.ar_raw_inputs
USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "ar_users_can_read_own_pain_evidences"
ON public.ar_pain_evidences
USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "ar_users_can_read_own_problem_candidates"
ON public.ar_problem_candidates
USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "ar_users_can_read_own_problem_evidence_links"
ON public.ar_problem_evidence_links
USING (
  EXISTS (
    SELECT 1
    FROM public.ar_problem_candidates pc
    WHERE pc.id = ar_problem_evidence_links.problem_candidate_id
      AND pc.user_id = (SELECT auth.uid())
  )
);

ALTER POLICY "Rankings select policy"
ON public.rankings
USING (
  is_admin()
  OR (
    (SELECT auth.role()) = 'anon'
    AND status = 'published'
    AND moderation_status IN ('clean', 'suggestive')
    AND image_moderation_status IN ('clean', 'suggestive')
  )
);

ALTER POLICY "Ranking entries select policy"
ON public.ranking_entries
USING (
  is_admin()
  OR (
    (SELECT auth.role()) = 'anon'
    AND moderation_status IN ('clean', 'suggestive')
    AND EXISTS (
      SELECT 1
      FROM public.rankings r
      WHERE r.id = ranking_entries.ranking_id
        AND r.status = 'published'
        AND r.moderation_status IN ('clean', 'suggestive')
        AND r.image_moderation_status IN ('clean', 'suggestive')
    )
  )
);

ALTER POLICY "Operators can view moderation reviews"
ON public.moderation_reviews
USING (private.has_admin_capability((SELECT auth.uid()), 'moderation_review'));

-- 2) Remove SELECT overlap from mutation-authority FOR ALL policies.
-- Existing SELECT policies remain authoritative and unchanged apart from the two
-- initplan-safe rewrites above.

DROP POLICY IF EXISTS "Categories manageable by admin only" ON public.categories;
CREATE POLICY "Categories insertable by admin" ON public.categories
FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "Categories updatable by admin" ON public.categories
FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Categories deletable by admin" ON public.categories
FOR DELETE TO public USING (is_admin());

DROP POLICY IF EXISTS "Subcategories manageable by admin only" ON public.subcategories;
CREATE POLICY "Subcategories insertable by admin" ON public.subcategories
FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "Subcategories updatable by admin" ON public.subcategories
FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Subcategories deletable by admin" ON public.subcategories
FOR DELETE TO public USING (is_admin());

DROP POLICY IF EXISTS "Rankings manageable by admin" ON public.rankings;
CREATE POLICY "Rankings insertable by admin" ON public.rankings
FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "Rankings updatable by admin" ON public.rankings
FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Rankings deletable by admin" ON public.rankings
FOR DELETE TO public USING (is_admin());

DROP POLICY IF EXISTS "Items manageable by admin" ON public.items;
CREATE POLICY "Items insertable by admin" ON public.items
FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "Items updatable by admin" ON public.items
FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Items deletable by admin" ON public.items
FOR DELETE TO public USING (is_admin());

DROP POLICY IF EXISTS "Ranking entries manageable by admin" ON public.ranking_entries;
CREATE POLICY "Ranking entries insertable by admin" ON public.ranking_entries
FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "Ranking entries updatable by admin" ON public.ranking_entries
FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Ranking entries deletable by admin" ON public.ranking_entries
FOR DELETE TO public USING (is_admin());

DROP POLICY IF EXISTS "Ranking criteria manageable by admin" ON public.ranking_criteria;
CREATE POLICY "Ranking criteria insertable by admin" ON public.ranking_criteria
FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "Ranking criteria updatable by admin" ON public.ranking_criteria
FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Ranking criteria deletable by admin" ON public.ranking_criteria
FOR DELETE TO public USING (is_admin());

DROP POLICY IF EXISTS "Ranking sources manageable by admin" ON public.ranking_sources;
CREATE POLICY "Ranking sources insertable by admin" ON public.ranking_sources
FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "Ranking sources updatable by admin" ON public.ranking_sources
FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Ranking sources deletable by admin" ON public.ranking_sources
FOR DELETE TO public USING (is_admin());

DROP POLICY IF EXISTS "Ranking facets manageable by admin" ON public.ranking_facets;
CREATE POLICY "Ranking facets insertable by admin" ON public.ranking_facets
FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "Ranking facets updatable by admin" ON public.ranking_facets
FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Ranking facets deletable by admin" ON public.ranking_facets
FOR DELETE TO public USING (is_admin());

DROP POLICY IF EXISTS "Facet groups manageable by admin" ON public.facet_groups;
CREATE POLICY "Facet groups insertable by admin" ON public.facet_groups
FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "Facet groups updatable by admin" ON public.facet_groups
FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Facet groups deletable by admin" ON public.facet_groups
FOR DELETE TO public USING (is_admin());

DROP POLICY IF EXISTS "Facets manageable by admin" ON public.facets;
CREATE POLICY "Facets insertable by admin" ON public.facets
FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "Facets updatable by admin" ON public.facets
FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Facets deletable by admin" ON public.facets
FOR DELETE TO public USING (is_admin());

DROP POLICY IF EXISTS "Item facets manageable by admin" ON public.item_facets;
CREATE POLICY "Item facets insertable by admin" ON public.item_facets
FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "Item facets updatable by admin" ON public.item_facets
FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Item facets deletable by admin" ON public.item_facets
FOR DELETE TO public USING (is_admin());

DROP POLICY IF EXISTS "Moderation terms manageable by admin" ON public.moderation_terms;
CREATE POLICY "Moderation terms insertable by admin" ON public.moderation_terms
FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "Moderation terms updatable by admin" ON public.moderation_terms
FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Moderation terms deletable by admin" ON public.moderation_terms
FOR DELETE TO public USING (is_admin());

-- Reactions are publicly readable, but only the owner may mutate. Splitting the
-- former ALL policy removes duplicate SELECT evaluation while preserving writes.
DROP POLICY IF EXISTS "Reactions manageable by self" ON public.reactions;
CREATE POLICY "Reactions insertable by self" ON public.reactions
FOR INSERT TO public WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Reactions updatable by self" ON public.reactions
FOR UPDATE TO public
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Reactions deletable by self" ON public.reactions
FOR DELETE TO public USING ((SELECT auth.uid()) = user_id);

-- 3) Add only FK indexes justified by recurring ranking child-table paths.
CREATE INDEX IF NOT EXISTS idx_ranking_criteria_ranking_id
  ON public.ranking_criteria (ranking_id);

CREATE INDEX IF NOT EXISTS idx_ranking_sources_ranking_id
  ON public.ranking_sources (ranking_id);
