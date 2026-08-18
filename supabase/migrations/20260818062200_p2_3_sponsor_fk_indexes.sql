BEGIN;

CREATE INDEX IF NOT EXISTS idx_sponsors_created_by
  ON public.sponsors(created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sponsors_updated_by
  ON public.sponsors(updated_by)
  WHERE updated_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sponsorships_created_by
  ON public.sponsorships(created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sponsorships_updated_by
  ON public.sponsorships(updated_by)
  WHERE updated_by IS NOT NULL;

COMMIT;
