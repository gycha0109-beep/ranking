BEGIN;

CREATE INDEX idx_ranking_revalidations_actor
  ON public.ranking_revalidations(actor_id)
  WHERE actor_id IS NOT NULL;

COMMIT;
