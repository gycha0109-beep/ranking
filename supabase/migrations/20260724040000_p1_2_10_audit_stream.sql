BEGIN;

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

  IF v_capability IN ('admin_console_access', 'moderation_review') THEN
    RETURN v_level IN ('moderator', 'admin', 'super_admin');
  END IF;

  IF v_capability IN (
    'report_review',
    'sanction_view',
    'sanction_impose_warning',
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
    'role_manage',
    'audit_sensitive_view'
  ) THEN
    RETURN v_level = 'super_admin';
  END IF;

  RETURN FALSE;
END;
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
      (13, 'role_manage'),
      (14, 'audit_sensitive_view')
  ) AS capabilities(ord, capability)
  WHERE private.has_admin_capability(v_user_id, capability);

  RETURN jsonb_build_object(
    'role_level', v_level,
    'capabilities', v_capabilities
  );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_moderation_reviews_manual_reviewed
  ON public.moderation_reviews(reviewed_at DESC, id DESC)
  WHERE decision_source = 'manual';

CREATE INDEX IF NOT EXISTS idx_comment_report_decisions_created
  ON public.comment_report_decisions(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_user_sanction_events_created
  ON public.user_sanction_events(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_user_sanction_appeal_decisions_created
  ON public.user_sanction_appeal_decisions(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_maintenance_job_runs_finished
  ON public.maintenance_job_runs(finished_at DESC, id DESC);

CREATE OR REPLACE FUNCTION private.list_admin_audit_event_stream(
  p_event_kinds TEXT[] DEFAULT NULL,
  p_event_id TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_subject_id UUID DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_sort_key TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  event_kind TEXT,
  event_id TEXT,
  sort_key TEXT,
  correlation_id TEXT,
  group_id TEXT,
  actor_id UUID,
  actor_label TEXT,
  subject_type TEXT,
  subject_id UUID,
  subject_label TEXT,
  action TEXT,
  reason_code TEXT,
  summary TEXT,
  source_href TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  WITH sanctions_resolved AS (
    SELECT
      us.*,
      CASE
        WHEN us.source_comment_id IS NOT NULL
          THEN 'comment:' || us.source_comment_id::TEXT
        WHEN source_decision.comment_id IS NOT NULL
          THEN 'comment:' || source_decision.comment_id::TEXT
        WHEN source_review.entity_type = 'comment'
          THEN 'comment:' || source_review.entity_id::TEXT
        WHEN source_review.id IS NOT NULL
          THEN 'moderation:' || source_review.entity_type || ':' || source_review.entity_id::TEXT
        ELSE 'sanction:' || us.id::TEXT
      END AS root_correlation_id,
      'sanction:' || us.id::TEXT AS sanction_group_id
    FROM public.user_sanctions us
    LEFT JOIN public.comment_report_decisions source_decision
      ON source_decision.id = us.source_report_decision_id
    LEFT JOIN public.moderation_reviews source_review
      ON source_review.id = us.source_moderation_review_id
  ), audit_events AS (
    SELECT
      'role_change'::TEXT AS event_kind,
      event.id::TEXT AS event_id,
      'role_change:' || event.id::TEXT AS sort_key,
      'user:' || event.target_user_id::TEXT AS correlation_id,
      'user:' || event.target_user_id::TEXT AS group_id,
      event.actor_id,
      COALESCE(actor_profile.display_name, CASE WHEN event.actor_id IS NULL THEN '시스템' ELSE event.actor_id::TEXT END) AS actor_label,
      'user'::TEXT AS subject_type,
      event.target_user_id AS subject_id,
      COALESCE(target_profile.display_name, event.target_user_id::TEXT) AS subject_label,
      event.previous_level || ' → ' || event.new_level AS action,
      'role_change'::TEXT AS reason_code,
      '운영 역할이 ' || event.previous_level || '에서 ' || event.new_level || '로 변경됨' AS summary,
      '/admin/access-control'::TEXT AS source_href,
      event.created_at
    FROM public.admin_role_change_events event
    LEFT JOIN public.profiles actor_profile ON actor_profile.id = event.actor_id
    LEFT JOIN public.profiles target_profile ON target_profile.id = event.target_user_id
    WHERE (p_event_kinds IS NULL OR 'role_change' = ANY(p_event_kinds))
      AND (p_event_id IS NULL OR event.id::TEXT = p_event_id)
      AND (p_actor_id IS NULL OR event.actor_id = p_actor_id)
      AND (p_subject_id IS NULL OR event.target_user_id = p_subject_id)
      AND (p_correlation_id IS NULL OR p_correlation_id = 'user:' || event.target_user_id::TEXT)
      AND (p_from IS NULL OR event.created_at >= p_from)
      AND (p_to IS NULL OR event.created_at < p_to)
      AND (
        p_cursor_created_at IS NULL
        OR (event.created_at, 'role_change:' || event.id::TEXT)
           < (p_cursor_created_at, p_cursor_sort_key)
      )

    UNION ALL

    SELECT
      'moderation_review'::TEXT,
      review.id::TEXT,
      'moderation_review:' || review.id::TEXT,
      CASE
        WHEN review.entity_type = 'comment' THEN 'comment:' || review.entity_id::TEXT
        ELSE 'moderation:' || review.entity_type || ':' || review.entity_id::TEXT
      END,
      CASE
        WHEN review.entity_type = 'comment' THEN 'comment:' || review.entity_id::TEXT
        ELSE 'moderation:' || review.entity_type || ':' || review.entity_id::TEXT
      END,
      review.reviewed_by,
      COALESCE(reviewer_profile.display_name, CASE WHEN review.reviewed_by IS NULL THEN '시스템' ELSE review.reviewed_by::TEXT END),
      review.entity_type,
      review.entity_id,
      review.entity_type || ':' || review.entity_id::TEXT,
      review.decision_status,
      review.decision_reason,
      review.entity_type || ' 상태 ' || review.previous_status || ' → ' || review.decision_status,
      CASE WHEN review.entity_type = 'comment' THEN '/admin/comments' ELSE '/admin/rankings' END,
      review.reviewed_at
    FROM public.moderation_reviews review
    LEFT JOIN public.profiles reviewer_profile ON reviewer_profile.id = review.reviewed_by
    WHERE review.decision_source = 'manual'
      AND (p_event_kinds IS NULL OR 'moderation_review' = ANY(p_event_kinds))
      AND (p_event_id IS NULL OR review.id::TEXT = p_event_id)
      AND (p_actor_id IS NULL OR review.reviewed_by = p_actor_id)
      AND (p_subject_id IS NULL OR review.entity_id = p_subject_id)
      AND (
        p_correlation_id IS NULL
        OR p_correlation_id = CASE
          WHEN review.entity_type = 'comment' THEN 'comment:' || review.entity_id::TEXT
          ELSE 'moderation:' || review.entity_type || ':' || review.entity_id::TEXT
        END
      )
      AND (p_from IS NULL OR review.reviewed_at >= p_from)
      AND (p_to IS NULL OR review.reviewed_at < p_to)
      AND (
        p_cursor_created_at IS NULL
        OR (review.reviewed_at, 'moderation_review:' || review.id::TEXT)
           < (p_cursor_created_at, p_cursor_sort_key)
      )

    UNION ALL

    SELECT
      'comment_report_decision'::TEXT,
      decision.id::TEXT,
      'comment_report_decision:' || decision.id::TEXT,
      'comment:' || decision.comment_id::TEXT,
      'report-decision:' || decision.id::TEXT,
      decision.reviewed_by,
      COALESCE(reviewer_profile.display_name, CASE WHEN decision.reviewed_by IS NULL THEN '시스템' ELSE decision.reviewed_by::TEXT END),
      'comment'::TEXT,
      decision.comment_id,
      'comment:' || decision.comment_id::TEXT,
      decision.resolution,
      decision.decision_reason,
      '댓글 신고 ' || decision.pending_count_snapshot::TEXT || '건을 ' || decision.resolution || ' 처리',
      '/admin/comment-reports'::TEXT,
      decision.created_at
    FROM public.comment_report_decisions decision
    LEFT JOIN public.profiles reviewer_profile ON reviewer_profile.id = decision.reviewed_by
    WHERE (p_event_kinds IS NULL OR 'comment_report_decision' = ANY(p_event_kinds))
      AND (p_event_id IS NULL OR decision.id::TEXT = p_event_id)
      AND (p_actor_id IS NULL OR decision.reviewed_by = p_actor_id)
      AND (p_subject_id IS NULL OR decision.comment_id = p_subject_id)
      AND (p_correlation_id IS NULL OR p_correlation_id = 'comment:' || decision.comment_id::TEXT)
      AND (p_from IS NULL OR decision.created_at >= p_from)
      AND (p_to IS NULL OR decision.created_at < p_to)
      AND (
        p_cursor_created_at IS NULL
        OR (decision.created_at, 'comment_report_decision:' || decision.id::TEXT)
           < (p_cursor_created_at, p_cursor_sort_key)
      )

    UNION ALL

    SELECT
      'sanction_event'::TEXT,
      sanction_event.id::TEXT,
      'sanction_event:' || sanction_event.id::TEXT,
      sanction.root_correlation_id,
      sanction.sanction_group_id,
      sanction_event.actor_id,
      COALESCE(actor_profile.display_name, CASE WHEN sanction_event.actor_id IS NULL THEN '시스템' ELSE sanction_event.actor_id::TEXT END),
      'user'::TEXT,
      sanction.target_user_id,
      COALESCE(target_profile.display_name, sanction.target_user_id::TEXT),
      sanction_event.event_type,
      sanction.reason,
      sanction.sanction_type || ' 제재 ' || sanction_event.event_type,
      '/admin/user-sanctions'::TEXT,
      sanction_event.created_at
    FROM public.user_sanction_events sanction_event
    JOIN sanctions_resolved sanction ON sanction.id = sanction_event.sanction_id
    LEFT JOIN public.profiles actor_profile ON actor_profile.id = sanction_event.actor_id
    LEFT JOIN public.profiles target_profile ON target_profile.id = sanction.target_user_id
    WHERE (p_event_kinds IS NULL OR 'sanction_event' = ANY(p_event_kinds))
      AND (p_event_id IS NULL OR sanction_event.id::TEXT = p_event_id)
      AND (p_actor_id IS NULL OR sanction_event.actor_id = p_actor_id)
      AND (p_subject_id IS NULL OR sanction.target_user_id = p_subject_id)
      AND (p_correlation_id IS NULL OR p_correlation_id = sanction.root_correlation_id)
      AND (p_from IS NULL OR sanction_event.created_at >= p_from)
      AND (p_to IS NULL OR sanction_event.created_at < p_to)
      AND (
        p_cursor_created_at IS NULL
        OR (sanction_event.created_at, 'sanction_event:' || sanction_event.id::TEXT)
           < (p_cursor_created_at, p_cursor_sort_key)
      )

    UNION ALL

    SELECT
      'appeal_decision'::TEXT,
      appeal_decision.id::TEXT,
      'appeal_decision:' || appeal_decision.id::TEXT,
      sanction.root_correlation_id,
      sanction.sanction_group_id,
      appeal_decision.reviewed_by,
      COALESCE(reviewer_profile.display_name, CASE WHEN appeal_decision.reviewed_by IS NULL THEN '시스템' ELSE appeal_decision.reviewed_by::TEXT END),
      'user'::TEXT,
      appeal.appellant_id,
      COALESCE(appellant_profile.display_name, appeal.appellant_id::TEXT),
      appeal_decision.decision,
      'appeal_decision'::TEXT,
      sanction.sanction_type || ' 제재 이의제기 ' || appeal_decision.decision,
      '/admin/user-sanctions'::TEXT,
      appeal_decision.created_at
    FROM public.user_sanction_appeal_decisions appeal_decision
    JOIN public.user_sanction_appeals appeal ON appeal.id = appeal_decision.appeal_id
    JOIN sanctions_resolved sanction ON sanction.id = appeal.sanction_id
    LEFT JOIN public.profiles reviewer_profile ON reviewer_profile.id = appeal_decision.reviewed_by
    LEFT JOIN public.profiles appellant_profile ON appellant_profile.id = appeal.appellant_id
    WHERE (p_event_kinds IS NULL OR 'appeal_decision' = ANY(p_event_kinds))
      AND (p_event_id IS NULL OR appeal_decision.id::TEXT = p_event_id)
      AND (p_actor_id IS NULL OR appeal_decision.reviewed_by = p_actor_id)
      AND (p_subject_id IS NULL OR appeal.appellant_id = p_subject_id)
      AND (p_correlation_id IS NULL OR p_correlation_id = sanction.root_correlation_id)
      AND (p_from IS NULL OR appeal_decision.created_at >= p_from)
      AND (p_to IS NULL OR appeal_decision.created_at < p_to)
      AND (
        p_cursor_created_at IS NULL
        OR (appeal_decision.created_at, 'appeal_decision:' || appeal_decision.id::TEXT)
           < (p_cursor_created_at, p_cursor_sort_key)
      )

    UNION ALL

    SELECT
      'maintenance_job'::TEXT,
      run.id::TEXT,
      'maintenance_job:' || run.id::TEXT,
      'maintenance:' || run.job_key,
      'maintenance-run:' || run.id::TEXT,
      NULL::UUID,
      '시스템'::TEXT,
      'maintenance_job'::TEXT,
      NULL::UUID,
      run.job_key,
      run.status,
      run.error_code,
      run.job_key || ' 작업 ' || run.status || ' · ' || run.affected_rows::TEXT || '건 처리',
      '/admin/maintenance'::TEXT,
      run.finished_at
    FROM public.maintenance_job_runs run
    WHERE (p_event_kinds IS NULL OR 'maintenance_job' = ANY(p_event_kinds))
      AND (p_event_id IS NULL OR run.id::TEXT = p_event_id)
      AND p_actor_id IS NULL
      AND p_subject_id IS NULL
      AND (p_correlation_id IS NULL OR p_correlation_id = 'maintenance:' || run.job_key)
      AND (p_from IS NULL OR run.finished_at >= p_from)
      AND (p_to IS NULL OR run.finished_at < p_to)
      AND (
        p_cursor_created_at IS NULL
        OR (run.finished_at, 'maintenance_job:' || run.id::TEXT)
           < (p_cursor_created_at, p_cursor_sort_key)
      )
  )
  SELECT audit_events.*
  FROM audit_events
  ORDER BY audit_events.created_at DESC, audit_events.sort_key DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.list_admin_audit_events_v2(
  p_event_kinds TEXT[] DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_subject_id UUID DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_sort_key TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  event_kind TEXT,
  event_id TEXT,
  sort_key TEXT,
  correlation_id TEXT,
  group_id TEXT,
  actor_id UUID,
  actor_label TEXT,
  subject_type TEXT,
  subject_id UUID,
  subject_label TEXT,
  action TEXT,
  reason_code TEXT,
  summary TEXT,
  source_href TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_event_kinds TEXT[] := CASE
    WHEN COALESCE(cardinality(p_event_kinds), 0) = 0 THEN NULL
    ELSE p_event_kinds
  END;
  v_correlation_id TEXT := NULLIF(LOWER(BTRIM(COALESCE(p_correlation_id, ''))), '');
BEGIN
  PERFORM private.assert_admin_capability('audit_view');

  IF v_event_kinds IS NOT NULL AND EXISTS (
    SELECT 1
    FROM unnest(v_event_kinds) AS event_kind
    WHERE event_kind NOT IN (
      'role_change',
      'moderation_review',
      'comment_report_decision',
      'sanction_event',
      'appeal_decision',
      'maintenance_job'
    )
  ) THEN
    RAISE EXCEPTION '지원하지 않는 감사 이벤트 종류입니다.' USING ERRCODE = '22023';
  END IF;

  IF v_correlation_id IS NOT NULL
     AND v_correlation_id !~ '^[a-z0-9_:-]{1,200}$' THEN
    RAISE EXCEPTION '상관관계 ID 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from >= p_to THEN
    RAISE EXCEPTION '감사 조회 기간이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF (p_cursor_created_at IS NULL) <> (p_cursor_sort_key IS NULL) THEN
    RAISE EXCEPTION '감사 조회 cursor가 완전하지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_cursor_sort_key IS NOT NULL AND char_length(p_cursor_sort_key) > 300 THEN
    RAISE EXCEPTION '감사 조회 cursor가 너무 깁니다.' USING ERRCODE = '22023';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION '감사 조회 개수는 1개 이상 100개 이하이어야 합니다.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT *
  FROM private.list_admin_audit_event_stream(
    v_event_kinds,
    NULL,
    p_actor_id,
    p_subject_id,
    v_correlation_id,
    p_from,
    p_to,
    p_cursor_created_at,
    p_cursor_sort_key,
    p_limit
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_admin_audit_events(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  event_kind TEXT,
  event_id TEXT,
  actor_display_name TEXT,
  target_label TEXT,
  action TEXT,
  details JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
BEGIN
  PERFORM private.assert_admin_capability('audit_view');

  RETURN QUERY
  SELECT event.event_kind,
         event.event_id,
         event.actor_display_name,
         event.target_label,
         event.action,
         event.details,
         event.created_at
  FROM (
    SELECT
      'role_change'::TEXT AS event_kind,
      role_event.id::TEXT AS event_id,
      actor_profile.display_name AS actor_display_name,
      COALESCE(target_profile.display_name, role_event.target_user_id::TEXT) AS target_label,
      role_event.previous_level || ' → ' || role_event.new_level AS action,
      jsonb_build_object(
        'previous_level', role_event.previous_level,
        'new_level', role_event.new_level,
        'target_user_id', role_event.target_user_id
      ) AS details,
      role_event.created_at
    FROM public.admin_role_change_events role_event
    LEFT JOIN public.profiles actor_profile ON actor_profile.id = role_event.actor_id
    LEFT JOIN public.profiles target_profile ON target_profile.id = role_event.target_user_id

    UNION ALL

    SELECT
      'moderation_review',
      review.id::TEXT,
      reviewer_profile.display_name,
      review.entity_type || ':' || review.entity_id::TEXT,
      review.decision_status,
      jsonb_build_object(
        'previous_status', review.previous_status,
        'reason', review.decision_reason,
        'entity_type', review.entity_type,
        'entity_id', review.entity_id
      ),
      review.reviewed_at
    FROM public.moderation_reviews review
    LEFT JOIN public.profiles reviewer_profile ON reviewer_profile.id = review.reviewed_by
    WHERE review.decision_source = 'manual'

    UNION ALL

    SELECT
      'comment_report_decision',
      decision.id::TEXT,
      reviewer_profile.display_name,
      'comment:' || decision.comment_id::TEXT,
      decision.resolution,
      jsonb_build_object(
        'author_action', decision.author_action,
        'reason', decision.decision_reason,
        'pending_count', decision.pending_count_snapshot,
        'comment_id', decision.comment_id
      ),
      decision.created_at
    FROM public.comment_report_decisions decision
    LEFT JOIN public.profiles reviewer_profile ON reviewer_profile.id = decision.reviewed_by

    UNION ALL

    SELECT
      'sanction_event',
      sanction_event.id::TEXT,
      actor_profile.display_name,
      COALESCE(target_profile.display_name, sanction.target_user_id::TEXT),
      sanction_event.event_type,
      jsonb_build_object(
        'sanction_id', sanction.id,
        'sanction_type', sanction.sanction_type,
        'reason', sanction.reason
      ),
      sanction_event.created_at
    FROM public.user_sanction_events sanction_event
    JOIN public.user_sanctions sanction ON sanction.id = sanction_event.sanction_id
    LEFT JOIN public.profiles actor_profile ON actor_profile.id = sanction_event.actor_id
    LEFT JOIN public.profiles target_profile ON target_profile.id = sanction.target_user_id

    UNION ALL

    SELECT
      'appeal_decision',
      appeal_decision.id::TEXT,
      reviewer_profile.display_name,
      COALESCE(appellant_profile.display_name, appeal.appellant_id::TEXT),
      appeal_decision.decision,
      jsonb_build_object(
        'appeal_id', appeal.id,
        'sanction_id', appeal.sanction_id
      ),
      appeal_decision.created_at
    FROM public.user_sanction_appeal_decisions appeal_decision
    JOIN public.user_sanction_appeals appeal ON appeal.id = appeal_decision.appeal_id
    LEFT JOIN public.profiles reviewer_profile ON reviewer_profile.id = appeal_decision.reviewed_by
    LEFT JOIN public.profiles appellant_profile ON appellant_profile.id = appeal.appellant_id

    UNION ALL

    SELECT
      'maintenance_job',
      run.id::TEXT,
      NULL::TEXT,
      run.job_key,
      run.status,
      jsonb_build_object(
        'trigger_source', run.trigger_source,
        'batch_count', run.batch_count,
        'affected_rows', run.affected_rows,
        'error_code', run.error_code
      ),
      run.finished_at
    FROM public.maintenance_job_runs run
  ) event
  ORDER BY event.created_at DESC, event.event_kind, event.event_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION private.list_admin_audit_event_stream(
  TEXT[], TEXT, UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.list_admin_audit_events_v2(
  TEXT[], UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_audit_events_v2(
  TEXT[], UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER
) TO authenticated;

COMMIT;
