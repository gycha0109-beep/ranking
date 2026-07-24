BEGIN;

CREATE OR REPLACE FUNCTION private.normalize_sanction_text(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT regexp_replace(BTRIM(COALESCE(p_value, '')), '[[:space:]]+', ' ', 'g');
$$;

CREATE OR REPLACE FUNCTION private.create_user_sanction_record(
  p_target_user_id UUID,
  p_sanction_type TEXT,
  p_duration_hours INTEGER,
  p_reason TEXT,
  p_admin_note TEXT,
  p_created_by UUID,
  p_source_comment_id UUID DEFAULT NULL,
  p_source_report_decision_id BIGINT DEFAULT NULL,
  p_source_moderation_review_id UUID DEFAULT NULL,
  p_notify BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_type TEXT := LOWER(private.normalize_sanction_text(p_sanction_type));
  v_reason TEXT := LOWER(private.normalize_sanction_text(p_reason));
  v_note TEXT := private.normalize_sanction_text(p_admin_note);
  v_now TIMESTAMPTZ := NOW();
  v_ends_at TIMESTAMPTZ;
  v_sanction_id UUID;
  v_event_id BIGINT;
  v_source_user_id UUID;
BEGIN
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION '제재 대상 사용자가 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM auth.users WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '제재 대상 사용자를 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_target_user_id
      AND ur.role = 'admin'
  ) THEN
    RAISE EXCEPTION '관리자 계정은 이 제재 시스템의 대상이 아닙니다.' USING ERRCODE = '42501';
  END IF;

  IF p_created_by IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_created_by
      AND ur.role = 'admin'
  ) THEN
    RAISE EXCEPTION '제재 결정자 권한이 올바르지 않습니다.' USING ERRCODE = '42501';
  END IF;

  IF v_type NOT IN ('warning', 'comment_restriction', 'report_restriction', 'account_suspension') THEN
    RAISE EXCEPTION '제재 종류가 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_reason NOT IN (
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
  ) THEN
    RAISE EXCEPTION '제재 사유가 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_note) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION '관리자 제재 메모는 10자 이상 2,000자 이하로 입력해 주세요.' USING ERRCODE = '22023';
  END IF;

  IF v_type = 'warning' THEN
    IF p_duration_hours IS NOT NULL THEN
      RAISE EXCEPTION '경고에는 제한 기간을 설정할 수 없습니다.' USING ERRCODE = '22023';
    END IF;
    v_ends_at := NULL;
  ELSE
    IF p_duration_hours IS NULL OR p_duration_hours NOT BETWEEN 1 AND 8760 THEN
      RAISE EXCEPTION '기능 제한 기간은 1시간 이상 8,760시간 이하로 설정해 주세요.' USING ERRCODE = '22023';
    END IF;
    v_ends_at := v_now + make_interval(hours => p_duration_hours);
  END IF;

  IF p_source_comment_id IS NOT NULL THEN
    SELECT c.user_id
    INTO v_source_user_id
    FROM public.comments c
    WHERE c.id = p_source_comment_id;

    IF NOT FOUND OR v_source_user_id <> p_target_user_id THEN
      RAISE EXCEPTION '근거 댓글과 제재 대상 사용자가 일치하지 않습니다.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_source_report_decision_id IS NOT NULL THEN
    SELECT c.user_id
    INTO v_source_user_id
    FROM public.comment_report_decisions d
    JOIN public.comments c ON c.id = d.comment_id
    WHERE d.id = p_source_report_decision_id;

    IF NOT FOUND OR v_source_user_id <> p_target_user_id THEN
      RAISE EXCEPTION '신고 결정과 제재 대상 사용자가 일치하지 않습니다.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_source_moderation_review_id IS NOT NULL THEN
    SELECT c.user_id
    INTO v_source_user_id
    FROM public.moderation_reviews mr
    JOIN public.comments c
      ON mr.entity_type = 'comment'
     AND c.id = mr.entity_id
    WHERE mr.id = p_source_moderation_review_id;

    IF NOT FOUND OR v_source_user_id <> p_target_user_id THEN
      RAISE EXCEPTION 'Moderation 근거와 제재 대상 사용자가 일치하지 않습니다.' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('user-sanction-target:' || p_target_user_id::TEXT, 0)
  );

  IF v_type <> 'warning' AND EXISTS (
    SELECT 1
    FROM public.user_sanctions us
    JOIN public.user_sanction_states state ON state.sanction_id = us.id
    WHERE us.target_user_id = p_target_user_id
      AND us.sanction_type = v_type
      AND state.state = 'active'
      AND us.starts_at <= v_now
      AND us.ends_at > v_now
  ) THEN
    RAISE EXCEPTION '동일 종류의 유효한 제재가 이미 존재합니다.' USING ERRCODE = 'P0004';
  END IF;

  INSERT INTO public.user_sanctions(
    target_user_id,
    sanction_type,
    reason,
    admin_note,
    starts_at,
    ends_at,
    source_comment_id,
    source_report_decision_id,
    source_moderation_review_id,
    created_by,
    created_at
  ) VALUES (
    p_target_user_id,
    v_type,
    v_reason,
    v_note,
    v_now,
    v_ends_at,
    p_source_comment_id,
    p_source_report_decision_id,
    p_source_moderation_review_id,
    p_created_by,
    v_now
  )
  RETURNING id INTO v_sanction_id;

  INSERT INTO public.user_sanction_events(
    sanction_id,
    event_type,
    actor_id,
    note,
    created_at
  ) VALUES (
    v_sanction_id,
    'imposed',
    p_created_by,
    NULL,
    v_now
  )
  RETURNING id INTO v_event_id;

  INSERT INTO public.user_sanction_states(
    sanction_id,
    state,
    last_event_id,
    updated_at
  ) VALUES (
    v_sanction_id,
    'active',
    v_event_id,
    v_now
  );

  IF p_notify THEN
    PERFORM private.emit_notification(
      p_target_user_id,
      'user_sanction_imposed',
      'user-sanction-imposed:' || v_sanction_id::TEXT,
      p_created_by,
      NULL,
      NULL,
      NULL,
      NULL,
      v_type
    );
  END IF;

  RETURN v_sanction_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.end_user_sanction_record(
  p_sanction_id UUID,
  p_event_type TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_notify BOOLEAN DEFAULT TRUE
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_event_type TEXT := LOWER(private.normalize_sanction_text(p_event_type));
  v_note TEXT := NULLIF(private.normalize_sanction_text(p_note), '');
  v_sanction public.user_sanctions%ROWTYPE;
  v_state public.user_sanction_states%ROWTYPE;
  v_event_id BIGINT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_event_type NOT IN ('revoked', 'expired', 'overturned') THEN
    RAISE EXCEPTION '제재 종료 이벤트가 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_event_type = 'expired' THEN
    IF p_actor_id IS NOT NULL OR v_note IS NOT NULL THEN
      RAISE EXCEPTION '만료 이벤트에는 운영자나 메모를 지정할 수 없습니다.' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_actor_id IS NULL OR char_length(COALESCE(v_note, '')) NOT BETWEEN 10 AND 2000 THEN
      RAISE EXCEPTION '제재 해제 또는 취소에는 10자 이상의 관리자 메모가 필요합니다.' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = p_actor_id
        AND ur.role = 'admin'
    ) THEN
      RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('user-sanction:' || p_sanction_id::TEXT, 0)
  );

  SELECT *
  INTO v_sanction
  FROM public.user_sanctions
  WHERE id = p_sanction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '제재 기록을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO v_state
  FROM public.user_sanction_states
  WHERE sanction_id = p_sanction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '제재 현재 상태를 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF v_event_type = 'expired' THEN
    IF v_state.state <> 'active' OR v_sanction.ends_at IS NULL OR v_sanction.ends_at > v_now THEN
      RETURN NULL;
    END IF;
  ELSIF v_event_type = 'revoked' THEN
    IF v_state.state <> 'active'
       OR (v_sanction.ends_at IS NOT NULL AND v_sanction.ends_at <= v_now) THEN
      RAISE EXCEPTION '현재 유효한 제재만 수동 해제할 수 있습니다.' USING ERRCODE = 'P0004';
    END IF;
  ELSE
    IF v_state.state IN ('revoked', 'overturned') THEN
      RAISE EXCEPTION '이미 해제 또는 취소된 제재입니다.' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  INSERT INTO public.user_sanction_events(
    sanction_id,
    event_type,
    actor_id,
    note,
    created_at
  ) VALUES (
    p_sanction_id,
    v_event_type,
    p_actor_id,
    v_note,
    v_now
  )
  RETURNING id INTO v_event_id;

  UPDATE public.user_sanction_states
  SET state = v_event_type,
      last_event_id = v_event_id,
      updated_at = v_now
  WHERE sanction_id = p_sanction_id;

  IF p_notify THEN
    PERFORM private.emit_notification(
      v_sanction.target_user_id,
      'user_sanction_ended',
      'user-sanction-ended:' || p_sanction_id::TEXT || ':' || v_event_type,
      p_actor_id,
      NULL,
      NULL,
      NULL,
      NULL,
      v_event_type
    );
  END IF;

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_user_capability(
  p_user_id UUID,
  p_capability TEXT
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_capability TEXT := LOWER(private.normalize_sanction_text(p_capability));
  v_type TEXT;
  v_ends_at TIMESTAMPTZ;
  v_until TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF v_capability NOT IN ('comment_write', 'report_comment', 'engagement_write') THEN
    RAISE EXCEPTION '지원하지 않는 사용자 권한 검사입니다.' USING ERRCODE = '22023';
  END IF;

  SELECT us.sanction_type, us.ends_at
  INTO v_type, v_ends_at
  FROM public.user_sanctions us
  JOIN public.user_sanction_states state ON state.sanction_id = us.id
  WHERE us.target_user_id = p_user_id
    AND state.state = 'active'
    AND us.starts_at <= NOW()
    AND (us.ends_at IS NULL OR us.ends_at > NOW())
    AND (
      us.sanction_type = 'account_suspension'
      OR (v_capability = 'comment_write' AND us.sanction_type = 'comment_restriction')
      OR (v_capability = 'report_comment' AND us.sanction_type = 'report_restriction')
    )
  ORDER BY
    CASE us.sanction_type
      WHEN 'account_suspension' THEN 1
      WHEN 'comment_restriction' THEN 2
      WHEN 'report_restriction' THEN 2
      ELSE 3
    END,
    us.ends_at DESC NULLS LAST,
    us.id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_until := CASE
    WHEN v_ends_at IS NULL THEN '별도 해제 시점'
    ELSE to_char(v_ends_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC'
  END;

  IF v_type = 'account_suspension' THEN
    RAISE EXCEPTION '계정 활동이 %까지 제한되어 있습니다. 내 제재 페이지에서 상세 내용과 이의제기 상태를 확인해 주세요.', v_until
      USING ERRCODE = 'P0003';
  ELSIF v_type = 'comment_restriction' THEN
    RAISE EXCEPTION '댓글 작성 및 수정이 %까지 제한되어 있습니다. 내 제재 페이지에서 상세 내용을 확인해 주세요.', v_until
      USING ERRCODE = 'P0003';
  ELSE
    RAISE EXCEPTION '댓글 신고 기능이 %까지 제한되어 있습니다. 내 제재 페이지에서 상세 내용을 확인해 주세요.', v_until
      USING ERRCODE = 'P0003';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.normalize_sanction_text(TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.create_user_sanction_record(UUID, TEXT, INTEGER, TEXT, TEXT, UUID, UUID, BIGINT, UUID, BOOLEAN)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.end_user_sanction_record(UUID, TEXT, UUID, TEXT, BOOLEAN)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.assert_user_capability(UUID, TEXT)
FROM PUBLIC, anon, authenticated;

COMMIT;
