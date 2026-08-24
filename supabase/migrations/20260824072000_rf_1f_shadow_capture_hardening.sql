BEGIN;

-- A durable SHADOW run is evidence only when an actual candidate ordering was observed.
-- This is a semantic validity invariant, not a production tuning threshold.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.rf1_shadow_runs
    WHERE candidate_count < 1
  ) THEN
    RAISE EXCEPTION 'RF-1F cannot accept pre-existing empty SHADOW runs as durable ordering evidence';
  END IF;
END;
$$;

ALTER TABLE public.rf1_shadow_runs
  ADD CONSTRAINT rf1_shadow_runs_nonempty_candidate_set
    CHECK (candidate_count >= 1),
  ADD CONSTRAINT rf1_shadow_runs_source_not_in_baseline
    CHECK (NOT (current_ranking_id = ANY(baseline_ranking_ids))),
  ADD CONSTRAINT rf1_shadow_runs_source_not_in_shadow
    CHECK (NOT (current_ranking_id = ANY(shadow_ranking_ids)));

COMMIT;
