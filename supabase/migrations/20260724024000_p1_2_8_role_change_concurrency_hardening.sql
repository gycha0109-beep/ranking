BEGIN;

CREATE OR REPLACE FUNCTION private.set_admin_role_level(
  p_target_user_id UUID,
  p_new_level TEXT,
  p_actor_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_new_level TEXT := LOWER(BTRIM(COALESCE(p_new_level, '')));
  v_reason TEXT := regexp_replace(BTRIM(COALESCE(p_reason, '')), '[[:space:]]+', ' ', 'g');
  v_previous_level TEXT;
  v_super_count INTEGER;
BEGIN
  IF NOT private.has_admin_capability(p_actor_id, 'role_manage') THEN
    RAISE EXCEPTION '최고 관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;
  IF p_target_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION '대상 사용자를 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;
  IF p_target_user_id = p_actor_id THEN
    RAISE EXCEPTION '자기 자신의 운영 역할은 변경할 수 없습니다.' USING ERRCODE = '42501';
  END IF;
  IF v_new_level NOT IN ('none', 'moderator', 'admin', 'super_admin') THEN
    RAISE EXCEPTION '운영 역할 수준이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION '역할 변경 사유는 10자 이상 2,000자 이하로 입력해 주세요.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('admin-role-global', 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('admin-role:' || p_target_user_id::TEXT, 0));

  v_previous_level := private.get_admin_role_level(p_target_user_id);
  IF v_previous_level = v_new_level THEN
    RAISE EXCEPTION '이미 동일한 운영 역할이 부여되어 있습니다.' USING ERRCODE = 'P0004';
  END IF;

  IF v_previous_level = 'super_admin' AND v_new_level <> 'super_admin' THEN
    SELECT COUNT(DISTINCT user_id)::INTEGER INTO v_super_count
    FROM public.user_roles WHERE role = 'super_admin';
    IF v_super_count <= 1 THEN
      RAISE EXCEPTION '마지막 최고 관리자 역할은 제거할 수 없습니다.' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = p_target_user_id AND role IN ('moderator', 'admin', 'super_admin');

  IF v_new_level IN ('moderator', 'admin', 'super_admin') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (p_target_user_id, 'moderator') ON CONFLICT DO NOTHING;
  END IF;
  IF v_new_level IN ('admin', 'super_admin') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (p_target_user_id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  IF v_new_level = 'super_admin' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (p_target_user_id, 'super_admin') ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.admin_role_change_events(target_user_id, previous_level, new_level, actor_id, reason)
  VALUES (p_target_user_id, v_previous_level, v_new_level, p_actor_id, v_reason);

  RETURN jsonb_build_object(
    'target_user_id', p_target_user_id,
    'previous_level', v_previous_level,
    'new_level', v_new_level
  );
END;
$$;

REVOKE ALL ON FUNCTION private.set_admin_role_level(UUID, TEXT, UUID, TEXT)
FROM PUBLIC, anon, authenticated;

COMMIT;