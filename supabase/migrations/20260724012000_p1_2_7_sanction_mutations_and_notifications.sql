BEGIN;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_event_type_check;
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_event_shape;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_event_type_check CHECK (
    event_type IN (
      'comment_reply',
      'comment_moderation_changed',
      'comment_report_resolved',
      'comment_author_warning',
      'user_sanction_imposed',
      'user_sanction_appeal_resolved',
      'user_sanction_ended'
    )
  );

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_event_shape CHECK (
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
    OR (
      event_type = 'user_sanction_imposed'
      AND event_value IN ('warning', 'comment_restriction', 'report_restriction', 'account_suspension')
      AND report_decision_id IS NULL
      AND comment_id IS NULL
      AND ranking_id IS NULL
      AND item_id IS NULL
    )
    OR (
      event_type = 'user_sanction_appeal_resolved'
      AND event_value IN ('accepted', 'rejected')
      AND report_decision_id IS NULL
      AND comment_id IS NULL
      AND ranking_id IS NULL
      AND item_id IS NULL
    )
    OR (
      event_type = 'user_sanction_ended'
      AND event_value IN ('revoked', 'expired', 'overturned')
      AND report_decision_id IS NULL
      AND comment_id IS NULL
      AND ranking_id IS NULL
      AND item_id IS NULL
    )
  );

DROP FUNCTION IF EXISTS public.list_my_notifications(TIMESTAMPTZ, UUID, INTEGER);
CREATE FUNCTION public.list_my_notifications(
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
      WHEN 'user_sanction_imposed' THEN
        CASE n.event_value
          WHEN 'warning' THEN '계정에 운영 경고가 기록되었습니다.'
          WHEN 'comment_restriction' THEN '댓글 작성 및 수정 기능이 일정 기간 제한되었습니다.'
          WHEN 'report_restriction' THEN '댓글 신고 기능이 일정 기간 제한되었습니다.'
          WHEN 'account_suspension' THEN '계정의 비필수 활동이 일정 기간 제한되었습니다.'
          ELSE '계정 운영 조치가 기록되었습니다.'
        END
      WHEN 'user_sanction_appeal_resolved' THEN
        CASE n.event_value
          WHEN 'accepted' THEN '제재 이의제기가 수용되어 원결정이 취소되었습니다.'
          WHEN 'rejected' THEN '제재 이의제기 검토가 완료되었으며 원결정이 유지되었습니다.'
          ELSE '제재 이의제기 검토가 완료되었습니다.'
        END
      WHEN 'user_sanction_ended' THEN
        CASE n.event_value
          WHEN 'revoked' THEN '계정 제재가 운영자에 의해 조기 해제되었습니다.'
          WHEN 'expired' THEN '기간제 계정 제재가 만료되었습니다.'
          WHEN 'overturned' THEN '계정 제재 원결정이 취소되었습니다.'
          ELSE '계정 제재 상태가 종료되었습니다.'
        END
      ELSE '새로운 알림이 있습니다.'
    END,
    CASE
      WHEN n.event_type IN (
        'user_sanction_imposed',
        'user_sanction_appeal_resolved',
        'user_sanction_ended'
      ) THEN '/me/sanctions'
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

CREATE OR REPLACE FUNCTION public.admin_impose_user_sanction(
  p_target_user_id UUID,
  p_sanction_type TEXT,
  p_reason TEXT,
  p_admin_note TEXT,
  p_duration_hours INTEGER DEFAULT NULL,
  p_source_comment_id UUID DEFAULT NULL,
  p_source_report_decision_id BIGINT DEFAULT NULL,
  p_source_moderation_review_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_sanction_id UUID;
  v_sanction public.user_sanctions%ROWTYPE;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  v_sanction_id := private.create_user_sanction_record(
    p_target_user_id,
    p_sanction_type,
    p_duration_hours,
    p_reason,
    p_admin_note,
    v_admin_id,
    p_source_comment_id,
    p_source_report_decision_id,
    p_source_moderation_review_id,
    TRUE
  );

  SELECT * INTO v_sanction
  FROM public.user_sanctions
  WHERE id = v_sanction_id;

  RETURN jsonb_build_object(
    'sanction_id', v_sanction.id,
    'sanction_type', v_sanction.sanction_type,
    'starts_at', v_sanction.starts_at,
    'ends_at', v_sanction.ends_at,
    'state', 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_user_sanction(
  p_sanction_id UUID,
  p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_event_id BIGINT;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_sanction_appeals a
    LEFT JOIN public.user_sanction_appeal_decisions d ON d.appeal_id = a.id
    WHERE a.sanction_id = p_sanction_id
      AND d.id IS NULL
  ) THEN
    RAISE EXCEPTION '처리 대기 중인 이의제기가 있습니다. 이의제기 검토 화면에서 결정해 주세요.' USING ERRCODE = 'P0004';
  END IF;

  v_event_id := private.end_user_sanction_record(
    p_sanction_id,
    'revoked',
    v_admin_id,
    p_note,
    TRUE
  );

  RETURN jsonb_build_object(
    'sanction_id', p_sanction_id,
    'event_id', v_event_id,
    'state', 'revoked'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_user_sanction_appeal(
  p_sanction_id UUID,
  p_statement TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_statement TEXT := private.normalize_sanction_text(p_statement);
  v_sanction public.user_sanctions%ROWTYPE;
  v_state public.user_sanction_states%ROWTYPE;
  v_appeal_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_statement) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION '이의제기 내용은 20자 이상 2,000자 이하로 입력해 주세요.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('user-sanction-appeal:' || p_sanction_id::TEXT, 0)
  );

  SELECT * INTO v_sanction
  FROM public.user_sanctions
  WHERE id = p_sanction_id;

  IF NOT FOUND OR v_sanction.target_user_id <> v_user_id THEN
    RAISE EXCEPTION '이의제기할 제재를 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_state
  FROM public.user_sanction_states
  WHERE sanction_id = p_sanction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '제재 상태를 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF v_state.state IN ('revoked', 'overturned') THEN
    RAISE EXCEPTION '이미 해제 또는 취소된 제재에는 이의제기할 수 없습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_sanction.sanction_type <> 'warning'
     AND NOW() > v_sanction.ends_at + INTERVAL '30 days' THEN
    RAISE EXCEPTION '기간제 제재 종료 후 30일이 지나 이의제기할 수 없습니다.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_sanction_appeals a
    WHERE a.sanction_id = p_sanction_id
  ) THEN
    RAISE EXCEPTION '이 제재에는 이미 이의제기를 제출했습니다.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.user_sanction_appeals(
    sanction_id,
    appellant_id,
    statement
  ) VALUES (
    p_sanction_id,
    v_user_id,
    v_statement
  )
  RETURNING id, created_at INTO v_appeal_id, v_created_at;

  RETURN jsonb_build_object(
    'appeal_id', v_appeal_id,
    'sanction_id', p_sanction_id,
    'status', 'pending',
    'created_at', v_created_at
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION '이 제재에는 이미 이의제기를 제출했습니다.' USING ERRCODE = '23505';
END;
$$;

CREATE OR REPLACE FUNCTION public.review_user_sanction_appeal(
  p_appeal_id UUID,
  p_decision TEXT,
  p_review_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_decision TEXT := LOWER(private.normalize_sanction_text(p_decision));
  v_note TEXT := private.normalize_sanction_text(p_review_note);
  v_appeal public.user_sanction_appeals%ROWTYPE;
  v_decision_id BIGINT;
  v_created_at TIMESTAMPTZ;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF v_decision NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION '이의제기 처리 결과가 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_note) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION '이의제기 검토 메모는 10자 이상 2,000자 이하로 입력해 주세요.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('user-sanction-appeal-review:' || p_appeal_id::TEXT, 0)
  );

  SELECT * INTO v_appeal
  FROM public.user_sanction_appeals
  WHERE id = p_appeal_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '이의제기를 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_sanction_appeal_decisions d
    WHERE d.appeal_id = p_appeal_id
  ) THEN
    RAISE EXCEPTION '이미 처리된 이의제기입니다.' USING ERRCODE = 'P0004';
  END IF;

  IF v_decision = 'accepted' THEN
    PERFORM private.end_user_sanction_record(
      v_appeal.sanction_id,
      'overturned',
      v_admin_id,
      v_note,
      FALSE
    );
  END IF;

  INSERT INTO public.user_sanction_appeal_decisions(
    appeal_id,
    decision,
    reviewed_by,
    review_note
  ) VALUES (
    p_appeal_id,
    v_decision,
    v_admin_id,
    v_note
  )
  RETURNING id, created_at INTO v_decision_id, v_created_at;

  PERFORM private.emit_notification(
    v_appeal.appellant_id,
    'user_sanction_appeal_resolved',
    'user-sanction-appeal:' || p_appeal_id::TEXT,
    v_admin_id,
    NULL,
    NULL,
    NULL,
    NULL,
    v_decision
  );

  RETURN jsonb_build_object(
    'appeal_id', p_appeal_id,
    'appeal_decision_id', v_decision_id,
    'decision', v_decision,
    'sanction_state', CASE WHEN v_decision = 'accepted' THEN 'overturned' ELSE NULL END,
    'created_at', v_created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_due_user_sanctions(
  p_limit INTEGER DEFAULT 100
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_row RECORD;
  v_count BIGINT := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  FOR v_row IN
    SELECT us.id
    FROM public.user_sanctions us
    JOIN public.user_sanction_states state ON state.sanction_id = us.id
    WHERE state.state = 'active'
      AND us.ends_at IS NOT NULL
      AND us.ends_at <= NOW()
    ORDER BY us.ends_at, us.id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 1000)
  LOOP
    IF private.end_user_sanction_record(
      v_row.id,
      'expired',
      NULL,
      NULL,
      TRUE
    ) IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.create_warning_sanction_from_report_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_target_user_id UUID;
  v_reason TEXT;
  v_note TEXT;
BEGIN
  IF NEW.author_action <> 'warning' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_sanctions us
    WHERE us.source_report_decision_id = NEW.id
      AND us.sanction_type = 'warning'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT c.user_id
  INTO v_target_user_id
  FROM public.comments c
  WHERE c.id = NEW.comment_id;

  IF NOT FOUND OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = v_target_user_id
      AND ur.role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  v_reason := CASE
    WHEN NEW.decision_reason IN (
      'sexual_suggestive',
      'explicit_sexual',
      'minor_sexualization',
      'real_person_sexualization',
      'hate',
      'violence',
      'privacy',
      'illegal',
      'spam'
    ) THEN NEW.decision_reason
    ELSE 'other'
  END;

  v_note := COALESCE(
    NULLIF(private.normalize_sanction_text(NEW.review_note), ''),
    '댓글 신고 사건에서 작성자 경고가 결정되어 자동 기록되었습니다.'
  );

  PERFORM private.create_user_sanction_record(
    v_target_user_id,
    'warning',
    NULL,
    v_reason,
    v_note,
    NEW.reviewed_by,
    NEW.comment_id,
    NEW.id,
    NULL,
    FALSE
  );

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT
      d.id AS decision_id,
      d.comment_id,
      d.reviewed_by,
      d.decision_reason,
      d.review_note,
      c.user_id AS target_user_id
    FROM public.comment_report_decisions d
    JOIN public.comments c ON c.id = d.comment_id
    WHERE d.author_action = 'warning'
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_sanctions us
        WHERE us.source_report_decision_id = d.id
          AND us.sanction_type = 'warning'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = c.user_id
          AND ur.role = 'admin'
      )
    ORDER BY d.id
  LOOP
    PERFORM private.create_user_sanction_record(
      v_row.target_user_id,
      'warning',
      NULL,
      CASE
        WHEN v_row.decision_reason IN (
          'sexual_suggestive',
          'explicit_sexual',
          'minor_sexualization',
          'real_person_sexualization',
          'hate',
          'violence',
          'privacy',
          'illegal',
          'spam'
        ) THEN v_row.decision_reason
        ELSE 'other'
      END,
      COALESCE(
        NULLIF(private.normalize_sanction_text(v_row.review_note), ''),
        '기존 댓글 신고 경고 결정에서 이관된 감사 기록입니다.'
      ),
      v_row.reviewed_by,
      v_row.comment_id,
      v_row.decision_id,
      NULL,
      FALSE
    );
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_decision_create_warning_sanction
ON public.comment_report_decisions;
CREATE TRIGGER trg_report_decision_create_warning_sanction
AFTER INSERT ON public.comment_report_decisions
FOR EACH ROW
EXECUTE FUNCTION private.create_warning_sanction_from_report_decision();

REVOKE ALL ON FUNCTION private.create_warning_sanction_from_report_decision()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.list_my_notifications(TIMESTAMPTZ, UUID, INTEGER)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_notifications(TIMESTAMPTZ, UUID, INTEGER)
TO authenticated;

REVOKE ALL ON FUNCTION public.admin_impose_user_sanction(UUID, TEXT, TEXT, TEXT, INTEGER, UUID, BIGINT, UUID)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_impose_user_sanction(UUID, TEXT, TEXT, TEXT, INTEGER, UUID, BIGINT, UUID)
TO authenticated;

REVOKE ALL ON FUNCTION public.admin_revoke_user_sanction(UUID, TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_sanction(UUID, TEXT)
TO authenticated;

REVOKE ALL ON FUNCTION public.submit_user_sanction_appeal(UUID, TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_user_sanction_appeal(UUID, TEXT)
TO authenticated;

REVOKE ALL ON FUNCTION public.review_user_sanction_appeal(UUID, TEXT, TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_user_sanction_appeal(UUID, TEXT, TEXT)
TO authenticated;

REVOKE ALL ON FUNCTION public.expire_due_user_sanctions(INTEGER)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_due_user_sanctions(INTEGER)
TO service_role;

COMMIT;
