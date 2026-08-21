-- LAUNCH-2 follow-up: keep the publication boundary efficient on public Item reads.

CREATE INDEX IF NOT EXISTS idx_ranking_entries_public_item_membership
ON public.ranking_entries (item_id, ranking_id)
WHERE moderation_status IN ('clean', 'suggestive');

ALTER POLICY "Items viewable by everyone if active"
ON public.items
USING (
  is_admin()
  OR (
    (SELECT auth.role()) = 'anon'
    AND status = 'active'
    AND moderation_status IN ('clean', 'suggestive')
    AND image_moderation_status IN ('clean', 'suggestive')
    AND EXISTS (
      SELECT 1
      FROM public.ranking_entries re
      JOIN public.rankings r ON r.id = re.ranking_id
      WHERE re.item_id = items.id
        AND re.moderation_status IN ('clean', 'suggestive')
        AND r.status = 'published'
        AND r.moderation_status IN ('clean', 'suggestive')
        AND r.image_moderation_status IN ('clean', 'suggestive')
    )
  )
);

COMMENT ON INDEX public.idx_ranking_entries_public_item_membership IS
  'LAUNCH-2: supports public Item publication-membership checks by item_id without changing draft authoring data.';
