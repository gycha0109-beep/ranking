BEGIN;

CREATE OR REPLACE FUNCTION private.enforce_comment_write_sanction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.body IS NOT DISTINCT FROM OLD.body THEN
    RETURN NEW;
  END IF;

  PERFORM private.assert_user_capability(NEW.user_id, 'comment_write');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comments_enforce_write_sanction ON public.comments;
CREATE TRIGGER trg_comments_enforce_write_sanction
BEFORE INSERT OR UPDATE OF body ON public.comments
FOR EACH ROW
EXECUTE FUNCTION private.enforce_comment_write_sanction();

CREATE OR REPLACE FUNCTION private.enforce_comment_report_sanction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  PERFORM private.assert_user_capability(NEW.reporter_id, 'report_comment');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_reports_enforce_sanction ON public.comment_reports;
CREATE TRIGGER trg_comment_reports_enforce_sanction
BEFORE INSERT ON public.comment_reports
FOR EACH ROW
EXECUTE FUNCTION private.enforce_comment_report_sanction();

CREATE OR REPLACE FUNCTION public.set_ranking_like(
  p_ranking_id UUID,
  p_liked BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  PERFORM private.assert_user_capability(v_user_id, 'engagement_write');
  RETURN private.set_content_like(p_ranking_id, NULL, p_liked);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_item_like(
  p_item_id UUID,
  p_liked BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  PERFORM private.assert_user_capability(v_user_id, 'engagement_write');
  RETURN private.set_content_like(NULL, p_item_id, p_liked);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_ranking_bookmark(
  p_ranking_id UUID,
  p_bookmarked BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  PERFORM private.assert_user_capability(v_user_id, 'engagement_write');
  RETURN private.set_content_bookmark(p_ranking_id, NULL, p_bookmarked);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_item_bookmark(
  p_item_id UUID,
  p_bookmarked BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  PERFORM private.assert_user_capability(v_user_id, 'engagement_write');
  RETURN private.set_content_bookmark(NULL, p_item_id, p_bookmarked);
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_comment_write_sanction()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_comment_report_sanction()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_ranking_like(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_item_like(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_ranking_bookmark(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_item_bookmark(UUID, BOOLEAN) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_ranking_like(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_item_like(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_ranking_bookmark(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_item_bookmark(UUID, BOOLEAN) TO authenticated;

COMMIT;
