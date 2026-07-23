BEGIN;

DROP TRIGGER IF EXISTS trg_notify_public_comment_reply ON public.comments;
DROP TRIGGER IF EXISTS trg_comments_notify_reply ON public.comments;
DROP TRIGGER IF EXISTS trg_notify_manual_comment_moderation ON public.moderation_reviews;
DROP TRIGGER IF EXISTS trg_moderation_reviews_notify_comment ON public.moderation_reviews;
DROP TRIGGER IF EXISTS trg_notify_comment_report_decision ON public.comment_report_decisions;
DROP TRIGGER IF EXISTS trg_comment_report_decisions_notify ON public.comment_report_decisions;
DROP TRIGGER IF EXISTS trg_comment_reports_notify_resolution ON public.comment_reports;

DROP FUNCTION IF EXISTS private.notify_on_public_comment_reply();
DROP FUNCTION IF EXISTS private.notify_on_manual_comment_moderation();
DROP FUNCTION IF EXISTS private.notify_on_comment_report_decision();
DROP FUNCTION IF EXISTS private.notify_comment_reply();
DROP FUNCTION IF EXISTS private.notify_manual_comment_moderation();
DROP FUNCTION IF EXISTS private.notify_comment_report_decision();
DROP FUNCTION IF EXISTS private.notify_resolved_comment_report();
DROP FUNCTION IF EXISTS private.enqueue_user_notification(UUID, TEXT, UUID, UUID, UUID, UUID, BIGINT, TEXT, TEXT);
DROP FUNCTION IF EXISTS private.emit_notification(UUID, TEXT, TEXT, UUID, UUID, UUID, UUID, BIGINT, TEXT);

CREATE FUNCTION private.emit_notification(
  p_recipient_id UUID,
  p_event_type TEXT,
  p_dedupe_key TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL,
  p_ranking_id UUID DEFAULT NULL,
  p_item_id UUID DEFAULT NULL,
  p_report_decision_id BIGINT DEFAULT NULL,
  p_event_value TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  IF p_recipient_id IS NULL OR BTRIM(COALESCE(p_dedupe_key, '')) = '' THEN
    RETURN NULL;
  END IF;

  IF p_actor_id IS NOT NULL AND p_actor_id = p_recipient_id THEN
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

  RETURN v_notification_id;
END;
$$;

CREATE FUNCTION private.notify_comment_reply()
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

  PERFORM private.emit_notification(
    v_parent_author_id,
    'comment_reply',
    'comment-reply:' || NEW.id::TEXT,
    NEW.user_id,
    NEW.id,
    NEW.ranking_id,
    NEW.item_id,
    NULL,
    NULL
  );

  RETURN NEW;
END;
$$;

CREATE FUNCTION private.notify_manual_comment_moderation()
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
  FROM public.comments
  WHERE id = NEW.entity_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  PERFORM private.emit_notification(
    v_comment.user_id,
    'comment_moderation_changed',
    'comment-moderation:' || NEW.id::TEXT,
    NEW.reviewed_by,
    v_comment.id,
    v_comment.ranking_id,
    v_comment.item_id,
    NULL,
    NEW.decision_status
  );

  IF v_comment.parent_id IS NOT NULL
     AND v_comment.status = 'visible'
     AND NEW.decision_status IN ('clean', 'suggestive')
     AND NEW.previous_status NOT IN ('clean', 'suggestive') THEN
    SELECT c.user_id
    INTO v_parent_author_id
    FROM public.comments c
    WHERE c.id = v_comment.parent_id;

    PERFORM private.emit_notification(
      v_parent_author_id,
      'comment_reply',
      'comment-reply:' || v_comment.id::TEXT,
      v_comment.user_id,
      v_comment.id,
      v_comment.ranking_id,
      v_comment.item_id,
      NULL,
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION private.notify_comment_report_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_comment public.comments%ROWTYPE;
BEGIN
  IF NEW.author_action <> 'warning' THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_comment
  FROM public.comments
  WHERE id = NEW.comment_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  PERFORM private.emit_notification(
    v_comment.user_id,
    'comment_author_warning',
    'comment-author-warning:' || NEW.id::TEXT,
    NEW.reviewed_by,
    NEW.comment_id,
    v_comment.ranking_id,
    v_comment.item_id,
    NEW.id,
    'warning'
  );

  RETURN NEW;
END;
$$;

CREATE FUNCTION private.notify_resolved_comment_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_comment public.comments%ROWTYPE;
  v_resolution TEXT;
  v_reviewer UUID;
BEGIN
  IF OLD.decision_id IS NOT NULL
     OR NEW.decision_id IS NULL
     OR NEW.reporter_id IS NULL
     OR NEW.status NOT IN ('resolved', 'dismissed') THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_comment
  FROM public.comments
  WHERE id = NEW.comment_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT d.resolution, d.reviewed_by
  INTO v_resolution, v_reviewer
  FROM public.comment_report_decisions d
  WHERE d.id = NEW.decision_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  PERFORM private.emit_notification(
    NEW.reporter_id,
    'comment_report_resolved',
    'comment-report-resolution:' || NEW.decision_id::TEXT || ':' || NEW.reporter_id::TEXT,
    v_reviewer,
    NEW.comment_id,
    v_comment.ranking_id,
    v_comment.item_id,
    NEW.decision_id,
    v_resolution
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_comments_notify_reply
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION private.notify_comment_reply();

CREATE TRIGGER trg_moderation_reviews_notify_comment
AFTER INSERT ON public.moderation_reviews
FOR EACH ROW
EXECUTE FUNCTION private.notify_manual_comment_moderation();

CREATE TRIGGER trg_comment_report_decisions_notify
AFTER INSERT ON public.comment_report_decisions
FOR EACH ROW
EXECUTE FUNCTION private.notify_comment_report_decision();

CREATE TRIGGER trg_comment_reports_notify_resolution
AFTER UPDATE OF status, decision_id ON public.comment_reports
FOR EACH ROW
EXECUTE FUNCTION private.notify_resolved_comment_report();

REVOKE ALL ON FUNCTION private.emit_notification(UUID, TEXT, TEXT, UUID, UUID, UUID, UUID, BIGINT, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_comment_reply()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_manual_comment_moderation()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_comment_report_decision()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_resolved_comment_report()
FROM PUBLIC, anon, authenticated;

COMMIT;
