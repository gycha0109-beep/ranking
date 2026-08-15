BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_ranking_history(
  p_ranking_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  revision_id UUID,
  revision_number INTEGER,
  change_type TEXT,
  reason TEXT,
  vote_round INTEGER,
  eligible_vote_count BIGINT,
  created_at TIMESTAMPTZ,
  changes JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH public_ranking AS (
    SELECT r.id
    FROM public.rankings r
    WHERE r.id = p_ranking_id
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
  ), selected AS (
    SELECT rr.*
    FROM public.ranking_revisions rr
    JOIN public_ranking pr ON pr.id = rr.ranking_id
    ORDER BY rr.revision_number DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20)
  )
  SELECT
    selected.id AS revision_id,
    selected.revision_number,
    selected.change_type,
    selected.reason,
    selected.vote_round,
    selected.eligible_vote_count,
    selected.created_at,
    CASE
      WHEN selected.change_type <> 'vote_finalization' THEN '[]'::JSONB
      ELSE COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'item_id', entry.item_id,
            'title', entry.item_title_snapshot,
            'slug', entry.item_slug_snapshot,
            'before_position', entry.before_position,
            'after_position', entry.after_position,
            'delta', entry.before_position - entry.after_position,
            'direction', CASE
              WHEN entry.after_position < entry.before_position THEN 'up'
              WHEN entry.after_position > entry.before_position THEN 'down'
              ELSE 'same'
            END,
            'vote_count', entry.vote_count,
            'vote_share', CASE
              WHEN selected.eligible_vote_count = 0 THEN 0::NUMERIC
              ELSE ROUND((entry.vote_count::NUMERIC * 100) / selected.eligible_vote_count::NUMERIC, 2)
            END
          )
          ORDER BY entry.after_position ASC, entry.item_id ASC
        )
        FROM public.ranking_revision_entries entry
        JOIN public.items current_item
          ON current_item.id = entry.item_id
         AND current_item.status = 'active'
         AND current_item.moderation_status IN ('clean', 'suggestive')
         AND current_item.image_moderation_status IN ('clean', 'suggestive')
        LEFT JOIN public.ranking_entries current_entry
          ON current_entry.ranking_id = selected.ranking_id
         AND current_entry.item_id = entry.item_id
        WHERE entry.revision_id = selected.id
          AND (
            current_entry.item_id IS NULL
            OR current_entry.moderation_status IN ('clean', 'suggestive')
          )
      ), '[]'::JSONB)
    END AS changes
  FROM selected
  ORDER BY selected.revision_number DESC;
$$;

REVOKE ALL ON FUNCTION public.get_public_ranking_history(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_ranking_history(UUID, INTEGER) TO anon, authenticated;

COMMIT;
