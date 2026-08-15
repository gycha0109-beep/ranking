BEGIN;

CREATE INDEX IF NOT EXISTS idx_ranking_votes_item
  ON public.ranking_votes(item_id);

CREATE INDEX IF NOT EXISTS idx_ranking_votes_user
  ON public.ranking_votes(user_id);

CREATE INDEX IF NOT EXISTS idx_ranking_vote_settings_updated_by
  ON public.ranking_vote_settings(updated_by)
  WHERE updated_by IS NOT NULL;

COMMIT;
