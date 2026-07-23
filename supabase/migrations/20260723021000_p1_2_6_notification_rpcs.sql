BEGIN;

CREATE OR REPLACE FUNCTION public.list_my_notifications(
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 21
)
RETURNS TABLE (
  notification_id UUID,
  notification_type TEXT,
  event_value TEXT,
  message TEXT,
  href TEXT,
  actor_display_name TEXT,
  actor_avatar_url TEXT,
  created_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 21), 1), 51);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF (p_cursor_created_at IS NULL) <> (p_cursor_id IS NULL) THEN
    RAISE EXCEPTION '알림 커서가 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    n.id,
    n.event_type,
    n.event_value,
    CASE n.event_type
      WHEN 'comment_reply' THEN
        COALESCE(actor.display_name, '누군가') || '님이 회원님의 댓글에 답글을 남겼습니다.'
      WHEN 'comment_moderation_changed' THEN
        CASE n.event_value
          WHEN 'clean' THEN '댓글 검토가 완료되어 공개되었습니다.'
          WHEN 'suggestive' THEN '댓글 검토가 완료되어 제한적으로 공개되었습니다.'
          WHEN 'needs_review' THEN '댓글이 운영 검토 상태로 변경되었습니다.'
          WHEN 'blocked' THEN '댓글이 운영 정책에 따라 차단되었습니다.'
          ELSE '댓글 운영 상태가 변경되었습니다.'
        END
      WHEN 'comment_report_resolved' THEN
        CASE n.event_value
          WHEN 'dismissed' THEN '제출한 댓글 신고가 검토되었으며 위반이 확인되지 않았습니다.'
          WHEN 'kept' THEN '제출한 댓글 신고 검토가 완료되었으며 댓글이 유지되었습니다.'
          WHEN 'hidden' THEN '제출한 댓글 신고 검토 후 댓글이 숨김 처리되었습니다.'
          WHEN 'blocked' THEN '제출한 댓글 신고 검토 후 댓글이 차단되었습니다.'
          ELSE '제출한 댓글 신고 검토가 완료되었습니다.'
        END
      WHEN 'comment_author_warning' THEN
        '댓글 운영 검토 결과 작성자 경고가 기록되었습니다.'
      ELSE '새로운 알림이 있습니다.'
    END,
    CASE
      WHEN n.ranking_id IS NOT NULL
           AND r.slug IS NOT NULL
           AND private.is_public_ranking(n.ranking_id)
        THEN '/rankings/' || r.slug || '#comments-heading'
      WHEN n.item_id IS NOT NULL
           AND i.slug IS NOT NULL
           AND private.is_public_item(n.item_id)
        THEN '/items/' || i.slug || '#comments-heading'
      ELSE NULL
    END,
    CASE WHEN n.event_type = 'comment_reply' THEN actor.display_name ELSE NULL END,
    CASE WHEN n.event_type = 'comment_reply' THEN actor.avatar_url ELSE NULL END,
    n.created_at,
    n.read_at
  FROM public.notifications n
  LEFT JOIN public.profiles actor ON actor.id = n.actor_id
  LEFT JOIN public.rankings r ON r.id = n.ranking_id
  LEFT JOIN public.items i ON i.id = n.item_id
  WHERE n.recipient_id = v_user_id
    AND (
      p_cursor_created_at IS NULL
      OR (n.created_at, n.id) < (p_cursor_created_at, p_cursor_id)
    )
  ORDER BY n.created_at DESC, n.id DESC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_unread_notification_count()
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.notifications n
  WHERE n.recipient_id = v_user_id
    AND n.read_at IS NULL;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_read_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF p_notification_id IS NULL THEN
    RAISE EXCEPTION '알림 ID가 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.notifications n
  SET read_at = COALESCE(n.read_at, NOW())
  WHERE n.id = p_notification_id
    AND n.recipient_id = v_user_id
  RETURNING n.read_at INTO v_read_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION '알림을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'notification_id', p_notification_id,
    'read_at', v_read_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count BIGINT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.notifications n
  SET read_at = NOW()
  WHERE n.recipient_id = v_user_id
    AND n.read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_expired_notifications(
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_count BIGINT := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.notifications n
  WHERE (n.read_at IS NOT NULL AND n.created_at < p_now - INTERVAL '90 days')
     OR (n.read_at IS NULL AND n.created_at < p_now - INTERVAL '180 days');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_notifications(TIMESTAMPTZ, UUID, INTEGER)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_notifications(TIMESTAMPTZ, UUID, INTEGER)
TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_unread_notification_count()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_unread_notification_count()
TO authenticated;

REVOKE ALL ON FUNCTION public.mark_notification_read(UUID)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID)
TO authenticated;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read()
TO authenticated;

REVOKE ALL ON FUNCTION public.prune_expired_notifications(TIMESTAMPTZ)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_expired_notifications(TIMESTAMPTZ)
TO service_role;

COMMIT;
