BEGIN;

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'comment_reply',
      'comment_moderation_changed',
      'comment_report_resolved',
      'comment_author_warning'
    )
  ),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  comment_id UUID REFERENCES public.comments(id) ON DELETE SET NULL,
  ranking_id UUID REFERENCES public.rankings(id) ON DELETE SET NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  report_decision_id BIGINT REFERENCES public.comment_report_decisions(id) ON DELETE RESTRICT,
  event_value TEXT,
  dedupe_key TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_target_shape
    CHECK (num_nonnulls(ranking_id, item_id) <= 1),
  CONSTRAINT notifications_dedupe_key_length
    CHECK (char_length(dedupe_key) BETWEEN 1 AND 300),
  CONSTRAINT notifications_read_time
    CHECK (read_at IS NULL OR read_at >= created_at),
  CONSTRAINT notifications_event_shape
    CHECK (
      (
        event_type = 'comment_reply'
        AND actor_id IS NOT NULL
        AND event_value IS NULL
        AND report_decision_id IS NULL
      )
      OR (
        event_type = 'comment_moderation_changed'
        AND event_value IN ('clean', 'suggestive', 'needs_review', 'blocked')
        AND report_decision_id IS NULL
      )
      OR (
        event_type = 'comment_report_resolved'
        AND event_value IN ('dismissed', 'kept', 'hidden', 'blocked')
        AND report_decision_id IS NOT NULL
      )
      OR (
        event_type = 'comment_author_warning'
        AND event_value = 'warning'
        AND report_decision_id IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX uq_notifications_dedupe_key
  ON public.notifications(dedupe_key);

CREATE INDEX idx_notifications_recipient_created
  ON public.notifications(recipient_id, created_at DESC, id DESC);

CREATE INDEX idx_notifications_recipient_unread
  ON public.notifications(recipient_id, created_at DESC, id DESC)
  WHERE read_at IS NULL;

CREATE INDEX idx_notifications_comment
  ON public.notifications(comment_id)
  WHERE comment_id IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated;

COMMIT;
