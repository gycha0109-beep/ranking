BEGIN;

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS body_redacted_at TIMESTAMPTZ;

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_body_length;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_body_length
  CHECK (char_length(body) BETWEEN 1 AND 2000) NOT VALID;

ALTER TABLE public.comments
  VALIDATE CONSTRAINT comments_body_length;

CREATE INDEX IF NOT EXISTS idx_comments_ranking_threads
  ON public.comments(ranking_id, created_at DESC, id DESC)
  WHERE ranking_id IS NOT NULL AND parent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_comments_item_threads
  ON public.comments(item_id, created_at DESC, id DESC)
  WHERE item_id IS NOT NULL AND parent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_comments_parent_created
  ON public.comments(parent_id, created_at, id)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comments_user_updated
  ON public.comments(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_blocked_redaction
  ON public.comments(created_at, id)
  WHERE moderation_status = 'blocked' AND body_redacted_at IS NULL;

CREATE TABLE public.comment_mutation_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('create', 'update', 'delete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comment_mutation_events_exactly_one_target
    CHECK (num_nonnulls(ranking_id, item_id) = 1)
);

CREATE INDEX idx_comment_mutation_events_rate
  ON public.comment_mutation_events(user_id, event_type, created_at DESC);

ALTER TABLE public.comment_mutation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.comment_mutation_events FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Comments manageable by self" ON public.comments;
DROP POLICY IF EXISTS "Comments viewable if visible" ON public.comments;
DROP POLICY IF EXISTS "Comments admin select" ON public.comments;

CREATE POLICY "Comments admin select"
ON public.comments
FOR SELECT
TO authenticated
USING (public.is_admin());

REVOKE ALL ON TABLE public.comments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.comments TO authenticated;

CREATE OR REPLACE FUNCTION private.sync_comment_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF NEW.status = 'deleted' THEN
    IF NEW.deleted_at IS NULL THEN
      NEW.deleted_at := NOW();
    END IF;
    RETURN NEW;
  END IF;

  NEW.deleted_at := NULL;

  IF NEW.moderation_status IN ('clean', 'suggestive') THEN
    NEW.status := 'visible';
  ELSE
    NEW.status := 'hidden';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_comment_visibility ON public.comments;
CREATE TRIGGER trg_sync_comment_visibility
BEFORE INSERT OR UPDATE OF moderation_status, status
ON public.comments
FOR EACH ROW
EXECUTE FUNCTION private.sync_comment_visibility();

REVOKE ALL ON FUNCTION private.sync_comment_visibility()
FROM PUBLIC, anon, authenticated;

COMMIT;
