BEGIN;

DROP TRIGGER IF EXISTS trg_comment_report_decisions_notify ON public.comment_report_decisions;
DROP FUNCTION IF EXISTS private.notify_comment_report_decision();

CREATE OR REPLACE FUNCTION private.notify_comment_report_decision()
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

  SELECT * INTO v_comment
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

CREATE TRIGGER trg_comment_report_decisions_notify
AFTER INSERT ON public.comment_report_decisions
FOR EACH ROW
EXECUTE FUNCTION private.notify_comment_report_decision();

CREATE OR REPLACE FUNCTION private.notify_resolved_comment_report()
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

  SELECT * INTO v_comment
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

DROP TRIGGER IF EXISTS trg_comment_reports_notify_resolution ON public.comment_reports;
CREATE TRIGGER trg_comment_reports_notify_resolution
AFTER UPDATE OF status, decision_id ON public.comment_reports
FOR EACH ROW
EXECUTE FUNCTION private.notify_resolved_comment_report();

REVOKE ALL ON FUNCTION private.notify_comment_report_decision()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_resolved_comment_report()
FROM PUBLIC, anon, authenticated;

COMMIT;
