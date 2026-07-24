BEGIN;

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check CHECK (
    role IN ('user', 'editor', 'moderator', 'admin', 'super_admin')
  );

CREATE TABLE public.admin_role_change_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  previous_level TEXT NOT NULL CHECK (previous_level IN ('none', 'moderator', 'admin', 'super_admin')),
  new_level TEXT NOT NULL CHECK (new_level IN ('none', 'moderator', 'admin', 'super_admin')),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_role_change_events_actual_change CHECK (previous_level <> new_level)
);

CREATE INDEX idx_admin_role_change_events_created
  ON public.admin_role_change_events(created_at DESC, id DESC);
CREATE INDEX idx_admin_role_change_events_target
  ON public.admin_role_change_events(target_user_id, created_at DESC, id DESC);

INSERT INTO public.admin_role_change_events(
  target_user_id,
  previous_level,
  new_level,
  actor_id,
  reason
)
SELECT DISTINCT
  ur.user_id,
  'admin',
  'super_admin',
  NULL,
  'P1-2.8 역할 분리 도입에 따라 기존 관리자 권한을 최고 관리자 수준으로 이관했습니다.'
FROM public.user_roles ur
WHERE ur.role = 'admin';

INSERT INTO public.user_roles(user_id, role)
SELECT DISTINCT user_id, 'moderator'
FROM public.user_roles
WHERE role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles(user_id, role)
SELECT DISTINCT user_id, 'super_admin'
FROM public.user_roles
WHERE role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION private.reject_admin_role_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION '관리자 역할 변경 감사 원장은 수정하거나 삭제할 수 없습니다.' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER trg_admin_role_change_events_immutable
BEFORE UPDATE OR DELETE ON public.admin_role_change_events
FOR EACH ROW
EXECUTE FUNCTION private.reject_admin_role_event_mutation();

CREATE OR REPLACE FUNCTION private.get_admin_role_level(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user_id AND ur.role = 'super_admin'
    ) THEN 'super_admin'
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user_id AND ur.role = 'admin'
    ) THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user_id AND ur.role = 'moderator'
    ) THEN 'moderator'
    ELSE 'none'
  END;
$$;

CREATE OR REPLACE FUNCTION private.has_admin_capability(
  p_user_id UUID,
  p_capability TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_level TEXT;
  v_capability TEXT := LOWER(BTRIM(COALESCE(p_capability, '')));
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_level := private.get_admin_role_level(p_user_id);

  IF v_capability IN (
    'admin_console_access',
    'moderation_review',
    'report_review',
    'sanction_view',
    'sanction_impose_warning'
  ) THEN
    RETURN v_level IN ('moderator', 'admin', 'super_admin');
  END IF;

  IF v_capability IN (
    'content_manage',
    'sanction_impose_restriction',
    'appeal_reject',
    'audit_view'
  ) THEN
    RETURN v_level IN ('admin', 'super_admin');
  END IF;

  IF v_capability IN (
    'sanction_impose_long_suspension',
    'sanction_revoke',
    'appeal_accept',
    'role_manage'
  ) THEN
    RETURN v_level = 'super_admin';
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_admin_capability(p_capability TEXT)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = auth, private, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF NOT private.has_admin_capability(auth.uid(), p_capability) THEN
    RAISE EXCEPTION '이 운영 작업을 수행할 권한이 없습니다.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_admin_capability(p_capability TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, private, pg_temp
AS $$
  SELECT private.has_admin_capability(auth.uid(), p_capability);
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_access()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_level TEXT;
  v_capabilities JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('role_level', 'none', 'capabilities', '[]'::JSONB);
  END IF;

  v_level := private.get_admin_role_level(v_user_id);

  SELECT COALESCE(jsonb_agg(capability ORDER BY ord), '[]'::JSONB)
  INTO v_capabilities
  FROM (
    VALUES
      (1, 'admin_console_access'),
      (2, 'moderation_review'),
      (3, 'report_review'),
      (4, 'sanction_view'),
      (5, 'sanction_impose_warning'),
      (6, 'content_manage'),
      (7, 'sanction_impose_restriction'),
      (8, 'appeal_reject'),
      (9, 'audit_view'),
      (10, 'sanction_impose_long_suspension'),
      (11, 'sanction_revoke'),
      (12, 'appeal_accept'),
      (13, 'role_manage')
  ) AS capabilities(ord, capability)
  WHERE private.has_admin_capability(v_user_id, capability);

  RETURN jsonb_build_object(
    'role_level', v_level,
    'capabilities', v_capabilities
  );
END;
$$;

DROP POLICY IF EXISTS "Roles manageable by admin only" ON public.user_roles;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;

ALTER TABLE public.admin_role_change_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_role_change_events FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION private.reject_admin_role_event_mutation()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_admin_role_level(UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_admin_capability(UUID, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.assert_admin_capability(TEXT)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_admin_capability(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_admin_capability(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_admin_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_admin_access() TO authenticated;

COMMIT;
