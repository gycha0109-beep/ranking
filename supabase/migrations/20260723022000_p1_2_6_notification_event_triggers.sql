BEGIN;

CREATE OR REPLACE FUNCTION private.enqueue_user_notification(
  p_recipient_id UUID,
  p_event_type TEXT,
  p_actor_id UUID,
  p_comment_id UUID,
  p_ranking_id UUID,
  p_item_id UUID,
  p_report_decision_id BIGINT,
  p_event_value TEXT,
  p_dedupe_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  IF p_recipient_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_event_type = 'comment_reply' AND p_actor_id = p_recipient_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications(
    recipient_id,
    event_type,
    actor_id,
    comment_id,
    ranking_id,
    item_id,
    report_decision_id,
    event_value,
    dedupe_key
  ) VALUES (
    p_recipient_id,
    p_event_type,
    p_actor_id,
    p_comment_id,
    p_ranking_id,
    p_item_id,
    p_report_decision_id,
    p_event_value,
    p_dedupe_key
  )
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_notification_id;

  IF v_notification_id IS NULL THEN
    SELECT n.id
    INTO v_notification_id
    FROM public.notifications n
    WHERE n.dedupe_key = p_dedupe_key;
  END IF;

  RETURN v_notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.notify_on_public_comment_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_parent_author_id UUID;
BEGIN
  IF NEW.parent_id IS NULL
     OR NEW.status <> 'visible'
     OR NEW.moderation_status NOT IN ('clean', 'suggestive') THEN
    RETURN NEW;
  END IF;

  SELECT c.user_id
  INTO v_parent_author_id
  FROM public.comments c
  WHERE c.id = NEW.parent_id;

  IF v_parent_author_id IS NULL OR v_parent_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  PERFORM private.enqueue_user_notification(
    v_parent_author_id,
    'comment_reply',
    NEW.user_id,
    NEW.id,
    NEW.ranking_id,
    NEW.item_id,
    NULL,
    NULL,
    'comment-reply:' || NEW.id::TEXT
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.notify_on_manual_comment_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_comment public.comments%ROWTYPE;
  v_parent_author_id UUID;
BEGIN
  IF NEW.entity_type <> 'comment'
     OR NEW.decision_source <> 'manual'
     OR NEW.previous_status IS NOT DISTINCT FROM NEW.decision_status THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_comment
  FROM public.comments c
  WHERE c.id = NEW.entity_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  PERFORM private.enqueue_user_notification(
    v_comment.user_id,
    'comment_moderation_changed',
    NULL,
    v_comment.id,
    v_comment.ranking_id,
    v_comment.item_id,
    NULL,
    NEW.decision_status,
    'comment-moderation:' || NEW.id::TEXT
  );

  IF v_comment.parent_id IS NOT NULL
     AND v_comment.status = 'visible'
     AND NEW.decision_status IN ('clean', 'suggestive')
     AND NEW.previous_status NOT IN ('clean', 'suggestive') THEN
    SELECT c.user_id
    INTO v_parent_author_id
    FROM public.comments c
    WHERE c.id = v_comment.parent_id;

    IF v_parent_author_id IS NOT NULL AND v_parent_author_id <> v_comment.user_id THEN
      PERFORM private.enqueue_user_notification(
        v_parent_author_id,
        'comment_reply',
        v_comment.user_id,
        v_comment.id,
        v_comment.ranking_id,
        v_comment.item_id,
        NULL,
        NULL,
        'comment-reply:' || v_comment.id::TEXT
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.notify_on_comment_report_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_comment public.comments%ROWTYPE;
  v_reporter_id UUID;
BEGIN
  SELECT *
  INTO v_comment
  FROM public.comments c
  WHERE c.id = NEW.comment_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  FOR v_reporter_id IN
    SELECT DISTINCT cr.reporter_id
    FROM public.comment_reports cr
    WHERE cr.comment_id = NEW.comment_id
      AND cr.status = 'pending'
      AND cr.reporter_id IS NOT NULL
  LOOP
    PERFORM private.enqueue_user_notification(
      v_reporter_id,
      'comment_report_resolved',
      NULL,
      v_comment.id,
      v_comment.ranking_id,
      v_comment.item_id,
      NEW.id,
      NEW.resolution,
      'comment-report-resolution:' || NEW.id::TEXT || ':' || v_reporter_id::TEXT
    );
  END LOOP;

  IF NEW.author_action = 'warning' THEN
    PERFORM private.enqueue_user_notification(
      v_comment.user_id,
      'comment_author_warning',
      NULL,
      v_comment.id,
      v_comment.ranking_id,
      v_comment.item_id,
      NEW.id,
      'warning',
      'comment-author-warning:' || NEW.id::TEXT || ':' || v_comment.user_id::TEXT
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_public_comment_reply ON public.comments;
CREATE TRIGGER trg_notify_public_comment_reply
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION private.notify_on_public_comment_reply();

DROP TRIGGER IF EXISTS trg_notify_manual_comment_moderation ON public.moderation_reviews;
CREATE TRIGGER trg_notify_manual_comment_moderation
AFTER INSERT ON public.moderation_reviews
FOR EACH ROW
EXECUTE FUNCTION private.notify_on_manual_comment_moderation();

DROP TRIGGER IF EXISTS trg_notify_comment_report_decision ON public.comment_report_decisions;
CREATE TRIGGER trg_notify_comment_report_decision
AFTER INSERT ON public.comment_report_decisions
FOR EACH ROW
EXECUTE FUNCTION private.notify_on_comment_report_decision();

REVOKE ALL ON FUNCTION private.enqueue_user_notification(UUID, TEXT, UUID, UUID, UUID, UUID, BIGINT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_on_public_comment_reply()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_on_manual_comment_moderation()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_on_comment_report_decision()
FROM PUBLIC, anon, authenticated;

COMMIT;
