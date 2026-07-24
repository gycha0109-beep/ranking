BEGIN;

CREATE OR REPLACE FUNCTION public.list_my_user_sanctions(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  sanction_id UUID,
  sanction_type TEXT,
  reason TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  recorded_state TEXT,
  effective_state TEXT,
  source_type TEXT,
  appeal_id UUID,
  appeal_statement TEXT,
  appeal_created_at TIMESTAMPTZ,
  appeal_decision TEXT,
  appeal_decided_at TIMESTAMPTZ,
  can_appeal BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    us.id,
    us.sanction_type,
    us.reason,
    us.starts_at,
    us.ends_at,
    us.created_at,
    state.state,
    CASE
      WHEN state.state = 'active'
           AND us.ends_at IS NOT NULL
           AND us.ends_at <= NOW()
        THEN 'expired'
      ELSE state.state
    END,
    CASE
      WHEN us.source_report_decision_id IS NOT NULL THEN 'comment_report'
      WHEN us.source_moderation_review_id IS NOT NULL THEN 'moderation_review'
      WHEN us.source_comment_id IS NOT NULL THEN 'comment'
      ELSE 'manual'
    END,
    appeal.id,
    appeal.statement,
    appeal.created_at,
    appeal_decision.decision,
    appeal_decision.created_at,
    (
      appeal.id IS NULL
      AND state.state NOT IN ('revoked', 'overturned')
      AND (
        us.sanction_type = 'warning'
        OR NOW() <= us.ends_at + INTERVAL '30 days'
      )
    )
  FROM public.user_sanctions us
  JOIN public.user_sanction_states state ON state.sanction_id = us.id
  LEFT JOIN public.user_sanction_appeals appeal ON appeal.sanction_id = us.id
  LEFT JOIN public.user_sanction_appeal_decisions appeal_decision
    ON appeal_decision.appeal_id = appeal.id
  WHERE us.target_user_id = v_user_id
  ORDER BY us.created_at DESC, us.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.search_user_sanction_candidates(
  p_query TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  warning_count BIGINT,
  active_restriction_count BIGINT,
  last_sanction_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_query TEXT := private.normalize_sanction_text(p_query);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_query) < 2 THEN
    RAISE EXCEPTION '사용자 검색어는 2자 이상 입력해 주세요.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    COUNT(us.id) FILTER (WHERE us.sanction_type = 'warning')::BIGINT,
    COUNT(us.id) FILTER (
      WHERE us.sanction_type <> 'warning'
        AND state.state = 'active'
        AND us.starts_at <= NOW()
        AND us.ends_at > NOW()
    )::BIGINT,
    MAX(us.created_at)
  FROM public.profiles p
  LEFT JOIN public.user_sanctions us ON us.target_user_id = p.id
  LEFT JOIN public.user_sanction_states state ON state.sanction_id = us.id
  WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = p.id
        AND ur.role = 'admin'
    )
    AND (
      p.display_name ILIKE '%' || v_query || '%'
      OR p.id::TEXT = v_query
      OR p.id::TEXT LIKE v_query || '%'
    )
  GROUP BY p.id, p.display_name
  ORDER BY
    CASE WHEN p.id::TEXT = v_query THEN 0 ELSE 1 END,
    MAX(us.created_at) DESC NULLS LAST,
    p.display_name,
    p.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_recent_user_sanctions(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  sanction_id UUID,
  target_user_id UUID,
  target_display_name TEXT,
  sanction_type TEXT,
  reason TEXT,
  admin_note TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  recorded_state TEXT,
  effective_state TEXT,
  source_comment_id UUID,
  source_report_decision_id BIGINT,
  source_moderation_review_id UUID,
  created_by_display_name TEXT,
  appeal_id UUID,
  appeal_status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    us.id,
    us.target_user_id,
    COALESCE(target_profile.display_name, '알 수 없는 사용자'),
    us.sanction_type,
    us.reason,
    us.admin_note,
    us.starts_at,
    us.ends_at,
    us.created_at,
    state.state,
    CASE
      WHEN state.state = 'active'
           AND us.ends_at IS NOT NULL
           AND us.ends_at <= NOW()
        THEN 'expired'
      ELSE state.state
    END,
    us.source_comment_id,
    us.source_report_decision_id,
    us.source_moderation_review_id,
    creator_profile.display_name,
    appeal.id,
    CASE
      WHEN appeal.id IS NULL THEN NULL
      WHEN appeal_decision.id IS NULL THEN 'pending'
      ELSE appeal_decision.decision
    END
  FROM public.user_sanctions us
  JOIN public.user_sanction_states state ON state.sanction_id = us.id
  LEFT JOIN public.profiles target_profile ON target_profile.id = us.target_user_id
  LEFT JOIN public.profiles creator_profile ON creator_profile.id = us.created_by
  LEFT JOIN public.user_sanction_appeals appeal ON appeal.sanction_id = us.id
  LEFT JOIN public.user_sanction_appeal_decisions appeal_decision
    ON appeal_decision.appeal_id = appeal.id
  ORDER BY us.created_at DESC, us.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_pending_user_sanction_appeals(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  appeal_id UUID,
  sanction_id UUID,
  appellant_id UUID,
  appellant_display_name TEXT,
  statement TEXT,
  appeal_created_at TIMESTAMPTZ,
  sanction_type TEXT,
  reason TEXT,
  admin_note TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  effective_state TEXT,
  source_comment_id UUID,
  source_report_decision_id BIGINT,
  source_moderation_review_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    appeal.id,
    us.id,
    appeal.appellant_id,
    COALESCE(p.display_name, '알 수 없는 사용자'),
    appeal.statement,
    appeal.created_at,
    us.sanction_type,
    us.reason,
    us.admin_note,
    us.starts_at,
    us.ends_at,
    CASE
      WHEN state.state = 'active'
           AND us.ends_at IS NOT NULL
           AND us.ends_at <= NOW()
        THEN 'expired'
      ELSE state.state
    END,
    us.source_comment_id,
    us.source_report_decision_id,
    us.source_moderation_review_id
  FROM public.user_sanction_appeals appeal
  JOIN public.user_sanctions us ON us.id = appeal.sanction_id
  JOIN public.user_sanction_states state ON state.sanction_id = us.id
  LEFT JOIN public.profiles p ON p.id = appeal.appellant_id
  LEFT JOIN public.user_sanction_appeal_decisions decision
    ON decision.appeal_id = appeal.id
  WHERE decision.id IS NULL
  ORDER BY appeal.created_at, appeal.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pending_user_sanction_appeal_count()
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.user_sanction_appeals appeal
  LEFT JOIN public.user_sanction_appeal_decisions decision
    ON decision.appeal_id = appeal.id
  WHERE decision.id IS NULL;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_user_sanctions(INTEGER, INTEGER)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_user_sanctions(INTEGER, INTEGER)
TO authenticated;

REVOKE ALL ON FUNCTION public.search_user_sanction_candidates(TEXT, INTEGER)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_user_sanction_candidates(TEXT, INTEGER)
TO authenticated;

REVOKE ALL ON FUNCTION public.list_recent_user_sanctions(INTEGER, INTEGER)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_recent_user_sanctions(INTEGER, INTEGER)
TO authenticated;

REVOKE ALL ON FUNCTION public.list_pending_user_sanction_appeals(INTEGER, INTEGER)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_user_sanction_appeals(INTEGER, INTEGER)
TO authenticated;

REVOKE ALL ON FUNCTION public.get_pending_user_sanction_appeal_count()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pending_user_sanction_appeal_count()
TO authenticated;

COMMIT;
