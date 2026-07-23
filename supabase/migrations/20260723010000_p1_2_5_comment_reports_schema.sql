BEGIN;

CREATE TABLE public.comment_report_decisions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pending_count_snapshot INTEGER NOT NULL CHECK (pending_count_snapshot > 0),
  resolution TEXT NOT NULL CHECK (resolution IN ('dismissed', 'kept', 'hidden', 'blocked')),
  author_action TEXT NOT NULL DEFAULT 'none' CHECK (author_action IN ('none', 'warning')),
  decision_reason TEXT NOT NULL DEFAULT 'none' CHECK (
    decision_reason IN (
      'sexual_suggestive',
      'explicit_sexual',
      'minor_sexualization',
      'real_person_sexualization',
      'hate',
      'violence',
      'privacy',
      'illegal',
      'spam',
      'none',
      'system_error'
    )
  ),
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comment_report_decisions_note_length
    CHECK (review_note IS NULL OR char_length(review_note) <= 2000),
  CONSTRAINT comment_report_decisions_reason_shape
    CHECK (
      (resolution IN ('dismissed', 'kept') AND decision_reason = 'none')
      OR (resolution IN ('hidden', 'blocked') AND decision_reason <> 'none')
    )
);

CREATE INDEX idx_comment_report_decisions_comment_created
  ON public.comment_report_decisions(comment_id, created_at DESC, id DESC);

CREATE INDEX idx_comment_report_decisions_warning_author
  ON public.comment_report_decisions(comment_id, created_at DESC)
  WHERE author_action = 'warning';

CREATE TABLE public.comment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (
    reason IN (
      'spam',
      'harassment',
      'hate',
      'sexual',
      'violence',
      'privacy',
      'illegal',
      'misinformation',
      'other'
    )
  ),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_id BIGINT REFERENCES public.comment_report_decisions(id) ON DELETE SET NULL,
  CONSTRAINT comment_reports_details_length
    CHECK (details IS NULL OR char_length(details) <= 500),
  CONSTRAINT comment_reports_resolution_shape
    CHECK (
      (
        status = 'pending'
        AND resolved_at IS NULL
        AND resolved_by IS NULL
        AND decision_id IS NULL
      )
      OR (
        status IN ('resolved', 'dismissed')
        AND resolved_at IS NOT NULL
        AND decision_id IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX uq_comment_reports_comment_reporter
  ON public.comment_reports(comment_id, reporter_id)
  WHERE reporter_id IS NOT NULL;

CREATE INDEX idx_comment_reports_pending_case
  ON public.comment_reports(comment_id, created_at, id)
  WHERE status = 'pending';

CREATE INDEX idx_comment_reports_reporter_rate
  ON public.comment_reports(reporter_id, created_at DESC)
  WHERE reporter_id IS NOT NULL;

CREATE INDEX idx_comment_reports_decision
  ON public.comment_reports(decision_id)
  WHERE decision_id IS NOT NULL;

ALTER TABLE public.comment_report_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.comment_report_decisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.comment_reports FROM PUBLIC, anon, authenticated;

COMMIT;
