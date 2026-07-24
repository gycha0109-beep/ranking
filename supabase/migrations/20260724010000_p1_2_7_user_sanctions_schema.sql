BEGIN;

CREATE TABLE public.user_sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  sanction_type TEXT NOT NULL CHECK (
    sanction_type IN ('warning', 'comment_restriction', 'report_restriction', 'account_suspension')
  ),
  reason TEXT NOT NULL CHECK (
    reason IN (
      'sexual_suggestive',
      'explicit_sexual',
      'minor_sexualization',
      'real_person_sexualization',
      'harassment',
      'hate',
      'violence',
      'privacy',
      'illegal',
      'spam',
      'misinformation',
      'repeated_abuse',
      'evasion',
      'other'
    )
  ),
  admin_note TEXT NOT NULL CHECK (char_length(admin_note) BETWEEN 10 AND 2000),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  source_comment_id UUID REFERENCES public.comments(id) ON DELETE RESTRICT,
  source_report_decision_id BIGINT REFERENCES public.comment_report_decisions(id) ON DELETE RESTRICT,
  source_moderation_review_id UUID REFERENCES public.moderation_reviews(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_sanctions_duration_shape CHECK (
    (sanction_type = 'warning' AND ends_at IS NULL)
    OR (
      sanction_type <> 'warning'
      AND ends_at IS NOT NULL
      AND ends_at > starts_at
      AND ends_at <= starts_at + INTERVAL '365 days'
    )
  ),
  CONSTRAINT user_sanctions_start_time CHECK (
    starts_at >= created_at - INTERVAL '5 minutes'
  )
);

CREATE UNIQUE INDEX uq_user_sanctions_report_warning
  ON public.user_sanctions(source_report_decision_id)
  WHERE sanction_type = 'warning' AND source_report_decision_id IS NOT NULL;

CREATE INDEX idx_user_sanctions_target_created
  ON public.user_sanctions(target_user_id, created_at DESC, id DESC);

CREATE INDEX idx_user_sanctions_target_type
  ON public.user_sanctions(target_user_id, sanction_type, starts_at DESC);

CREATE INDEX idx_user_sanctions_due
  ON public.user_sanctions(ends_at, id)
  WHERE ends_at IS NOT NULL;

CREATE TABLE public.user_sanction_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sanction_id UUID NOT NULL REFERENCES public.user_sanctions(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('imposed', 'revoked', 'expired', 'overturned')
  ),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_sanction_events_shape CHECK (
    (event_type = 'imposed' AND note IS NULL)
    OR (
      event_type IN ('revoked', 'overturned')
      AND note IS NOT NULL
      AND char_length(note) BETWEEN 10 AND 2000
    )
    OR (event_type = 'expired' AND actor_id IS NULL AND note IS NULL)
  )
);

CREATE UNIQUE INDEX uq_user_sanction_events_imposed
  ON public.user_sanction_events(sanction_id)
  WHERE event_type = 'imposed';

CREATE UNIQUE INDEX uq_user_sanction_events_terminal
  ON public.user_sanction_events(sanction_id)
  WHERE event_type IN ('revoked', 'expired', 'overturned');

CREATE INDEX idx_user_sanction_events_sanction
  ON public.user_sanction_events(sanction_id, created_at, id);

CREATE TABLE public.user_sanction_states (
  sanction_id UUID PRIMARY KEY REFERENCES public.user_sanctions(id) ON DELETE RESTRICT,
  state TEXT NOT NULL CHECK (state IN ('active', 'revoked', 'expired', 'overturned')),
  last_event_id BIGINT NOT NULL REFERENCES public.user_sanction_events(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_sanction_states_active
  ON public.user_sanction_states(state, updated_at DESC)
  WHERE state = 'active';

CREATE TABLE public.user_sanction_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sanction_id UUID NOT NULL UNIQUE REFERENCES public.user_sanctions(id) ON DELETE RESTRICT,
  appellant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  statement TEXT NOT NULL CHECK (char_length(statement) BETWEEN 20 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_sanction_appeals_created
  ON public.user_sanction_appeals(created_at, id);

CREATE TABLE public.user_sanction_appeal_decisions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  appeal_id UUID NOT NULL UNIQUE REFERENCES public.user_sanction_appeals(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note TEXT NOT NULL CHECK (char_length(review_note) BETWEEN 10 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION private.reject_immutable_user_sanction_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION '제재 감사 원장은 수정하거나 삭제할 수 없습니다.' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER trg_user_sanctions_immutable
BEFORE UPDATE OR DELETE ON public.user_sanctions
FOR EACH ROW
EXECUTE FUNCTION private.reject_immutable_user_sanction_mutation();

CREATE TRIGGER trg_user_sanction_events_immutable
BEFORE UPDATE OR DELETE ON public.user_sanction_events
FOR EACH ROW
EXECUTE FUNCTION private.reject_immutable_user_sanction_mutation();

CREATE TRIGGER trg_user_sanction_appeals_immutable
BEFORE UPDATE OR DELETE ON public.user_sanction_appeals
FOR EACH ROW
EXECUTE FUNCTION private.reject_immutable_user_sanction_mutation();

CREATE TRIGGER trg_user_sanction_appeal_decisions_immutable
BEFORE UPDATE OR DELETE ON public.user_sanction_appeal_decisions
FOR EACH ROW
EXECUTE FUNCTION private.reject_immutable_user_sanction_mutation();

ALTER TABLE public.user_sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sanction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sanction_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sanction_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sanction_appeal_decisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_sanctions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_sanction_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_sanction_states FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_sanction_appeals FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_sanction_appeal_decisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reject_immutable_user_sanction_mutation()
FROM PUBLIC, anon, authenticated;

COMMIT;
