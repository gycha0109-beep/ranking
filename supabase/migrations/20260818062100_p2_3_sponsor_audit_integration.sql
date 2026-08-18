BEGIN;

ALTER FUNCTION private.list_admin_audit_event_stream(
  TEXT[], TEXT, UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER
) RENAME TO list_admin_audit_event_stream_pre_p2_3;

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
RETURNS TABLE(
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
  WITH audit_events AS (
    SELECT *
    FROM private.list_admin_audit_event_stream_pre_p2_3(
      p_event_kinds, p_event_id, p_actor_id, p_subject_id, p_correlation_id,
      p_from, p_to, p_cursor_created_at, p_cursor_sort_key, p_limit
    )

    UNION ALL

    SELECT
      'sponsorship_change'::TEXT AS event_kind,
      event.id::TEXT AS event_id,
      'sponsorship_change:' || event.id::TEXT AS sort_key,
      'sponsorship:' || event.entity_id::TEXT AS correlation_id,
      'sponsorship:' || event.entity_id::TEXT AS group_id,
      event.actor_id,
      COALESCE(actor_profile.display_name, CASE WHEN event.actor_id IS NULL THEN '시스템' ELSE event.actor_id::TEXT END) AS actor_label,
      event.entity_type AS subject_type,
      event.entity_id AS subject_id,
      COALESCE(
        CASE WHEN event.entity_type = 'sponsor' THEN sponsor.name END,
        CASE
          WHEN event.entity_type = 'sponsorship' AND sponsorship.target_type = 'ranking' THEN ranking.title
          WHEN event.entity_type = 'sponsorship' AND sponsorship.target_type = 'item' THEN item.title
          WHEN event.entity_type = 'sponsorship' AND sponsorship.target_type = 'placement' THEN COALESCE(ranking.title, '랭킹') || ' · ' || COALESCE(item.title, '아이템')
        END,
        event.entity_type || ':' || event.entity_id::TEXT
      ) AS subject_label,
      event.action,
      'sponsorship_' || event.action AS reason_code,
      CASE event.action
        WHEN 'create' THEN '협찬 정보 생성'
        WHEN 'update' THEN '협찬 정보 수정'
        WHEN 'publish' THEN '협찬 관계 공개'
        WHEN 'archive' THEN '협찬 정보 보관'
        WHEN 'legacy_reconcile' THEN 'legacy 협찬 플래그 정리'
        ELSE '협찬 정보 변경'
      END AS summary,
      CASE WHEN event.entity_type = 'sponsor' THEN '/admin/sponsors' ELSE '/admin/sponsorships' END AS source_href,
      event.created_at
    FROM public.sponsorship_events event
    LEFT JOIN public.profiles actor_profile ON actor_profile.id = event.actor_id
    LEFT JOIN public.sponsors sponsor ON event.entity_type = 'sponsor' AND sponsor.id = event.entity_id
    LEFT JOIN public.sponsorships sponsorship ON event.entity_type = 'sponsorship' AND sponsorship.id = event.entity_id
    LEFT JOIN public.rankings ranking ON ranking.id = sponsorship.ranking_id
    LEFT JOIN public.items item ON item.id = sponsorship.item_id
    WHERE (p_event_kinds IS NULL OR 'sponsorship_change' = ANY(p_event_kinds))
      AND (p_event_id IS NULL OR event.id::TEXT = p_event_id)
      AND (p_actor_id IS NULL OR event.actor_id = p_actor_id)
      AND (p_subject_id IS NULL OR event.entity_id = p_subject_id)
      AND (p_correlation_id IS NULL OR p_correlation_id = 'sponsorship:' || event.entity_id::TEXT)
      AND (p_from IS NULL OR event.created_at >= p_from)
      AND (p_to IS NULL OR event.created_at < p_to)
      AND (
        p_cursor_created_at IS NULL
        OR (event.created_at, 'sponsorship_change:' || event.id::TEXT)
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
RETURNS TABLE(
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
  v_event_kinds TEXT[] := CASE WHEN COALESCE(cardinality(p_event_kinds), 0) = 0 THEN NULL ELSE p_event_kinds END;
  v_correlation_id TEXT := NULLIF(LOWER(BTRIM(COALESCE(p_correlation_id, ''))), '');
BEGIN
  PERFORM private.assert_admin_capability('audit_view');

  IF COALESCE(cardinality(v_event_kinds), 0) > 7 THEN
    RAISE EXCEPTION '감사 이벤트 종류 필터가 너무 많습니다.' USING ERRCODE = '22023';
  END IF;
  IF v_event_kinds IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(v_event_kinds) AS allowed_event_kind
    WHERE allowed_event_kind NOT IN (
      'role_change', 'moderation_review', 'comment_report_decision', 'sanction_event',
      'appeal_decision', 'maintenance_job', 'sponsorship_change'
    )
  ) THEN RAISE EXCEPTION '지원하지 않는 감사 이벤트 종류입니다.' USING ERRCODE = '22023'; END IF;
  IF v_correlation_id IS NOT NULL AND v_correlation_id !~ '^[a-z0-9_:-]{1,200}$' THEN
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
  SELECT * FROM private.list_admin_audit_event_stream(
    v_event_kinds, NULL, p_actor_id, p_subject_id, v_correlation_id,
    p_from, p_to, p_cursor_created_at, p_cursor_sort_key, p_limit
  );
END;
$$;

ALTER FUNCTION public.get_admin_audit_event_detail(TEXT, TEXT)
RENAME TO get_admin_audit_event_detail_pre_p2_3;

CREATE OR REPLACE FUNCTION public.get_admin_audit_event_detail(p_event_kind TEXT, p_event_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_kind TEXT := LOWER(BTRIM(COALESCE(p_event_kind, '')));
  v_id TEXT := BTRIM(COALESCE(p_event_id, ''));
  v_uuid UUID;
  v_event JSONB;
  v_evidence JSONB;
  v_sensitive_evidence JSONB;
  v_related_events JSONB;
  v_can_view_sensitive BOOLEAN;
BEGIN
  PERFORM private.assert_admin_capability('audit_view');

  IF v_kind <> 'sponsorship_change' THEN
    RETURN public.get_admin_audit_event_detail_pre_p2_3(v_kind, v_id);
  END IF;

  BEGIN
    v_uuid := v_id::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION '감사 이벤트 ID 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
  END;

  SELECT to_jsonb(event) INTO v_event
  FROM private.list_admin_audit_event_stream(ARRAY['sponsorship_change']::TEXT[], v_id, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1) event
  LIMIT 1;
  IF v_event IS NULL THEN RAISE EXCEPTION '감사 이벤트를 찾을 수 없습니다.' USING ERRCODE = 'P0002'; END IF;

  SELECT
    jsonb_build_object(
      'entity_type', event.entity_type,
      'entity_id', event.entity_id,
      'action', event.action,
      'reason', event.reason,
      'before_data', event.before_data - 'internal_note' - 'created_by' - 'updated_by',
      'after_data', event.after_data - 'internal_note' - 'created_by' - 'updated_by'
    ),
    jsonb_build_object(
      'actor_id', event.actor_id,
      'before_data', event.before_data,
      'after_data', event.after_data
    )
  INTO v_evidence, v_sensitive_evidence
  FROM public.sponsorship_events event
  WHERE event.id = v_uuid;

  IF v_evidence IS NULL THEN RAISE EXCEPTION '감사 이벤트 근거를 찾을 수 없습니다.' USING ERRCODE = 'P0002'; END IF;

  v_can_view_sensitive := private.has_admin_capability(auth.uid(), 'audit_sensitive_view');
  IF NOT v_can_view_sensitive THEN v_sensitive_evidence := NULL; END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(related_event) ORDER BY related_event.created_at DESC, related_event.sort_key DESC), '[]'::JSONB)
  INTO v_related_events
  FROM private.list_admin_audit_event_stream(
    NULL, NULL, NULL, NULL, 'sponsorship:' || (v_evidence->>'entity_id'),
    NULL, NULL, NULL, NULL, 50
  ) related_event;

  RETURN jsonb_build_object(
    'event', v_event,
    'evidence', v_evidence,
    'sensitive_evidence', v_sensitive_evidence,
    'related_events', v_related_events,
    'can_view_sensitive', v_can_view_sensitive
  );
END;
$$;

REVOKE ALL ON FUNCTION private.list_admin_audit_event_stream_pre_p2_3(TEXT[], TEXT, UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.list_admin_audit_event_stream(TEXT[], TEXT, UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_admin_audit_event_detail_pre_p2_3(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_admin_audit_events_v2(TEXT[], UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_audit_event_detail(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_audit_events_v2(TEXT[], UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_event_detail(TEXT, TEXT) TO authenticated;

COMMIT;
