BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_audit_event_detail(
  p_event_kind TEXT,
  p_event_id TEXT
)
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
  v_bigint BIGINT;
  v_event JSONB;
  v_evidence JSONB;
  v_sensitive_evidence JSONB;
  v_related_events JSONB;
  v_correlation_id TEXT;
  v_can_view_sensitive BOOLEAN;
BEGIN
  PERFORM private.assert_admin_capability('audit_view');

  IF v_kind NOT IN (
    'role_change',
    'moderation_review',
    'comment_report_decision',
    'sanction_event',
    'appeal_decision',
    'maintenance_job'
  ) THEN
    RAISE EXCEPTION '지원하지 않는 감사 이벤트 종류입니다.' USING ERRCODE = '22023';
  END IF;

  IF v_id = '' OR char_length(v_id) > 100 THEN
    RAISE EXCEPTION '감사 이벤트 ID 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_kind = 'moderation_review' THEN
    BEGIN
      v_uuid := v_id::UUID;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION '감사 이벤트 ID 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
    END;
  ELSE
    IF v_id !~ '^[0-9]{1,19}$' THEN
      RAISE EXCEPTION '감사 이벤트 ID 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_bigint := v_id::BIGINT;
    EXCEPTION
      WHEN numeric_value_out_of_range THEN
        RAISE EXCEPTION '감사 이벤트 ID 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
    END;
  END IF;

  SELECT to_jsonb(event), event.correlation_id
  INTO v_event, v_correlation_id
  FROM private.list_admin_audit_event_stream(
    ARRAY[v_kind]::TEXT[],
    v_id,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    1
  ) event
  LIMIT 1;

  IF v_event IS NULL THEN
    RAISE EXCEPTION '감사 이벤트를 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  v_can_view_sensitive := private.has_admin_capability(auth.uid(), 'audit_sensitive_view');

  CASE v_kind
    WHEN 'role_change' THEN
      SELECT
        jsonb_build_object(
          'target_user_id', event.target_user_id,
          'actor_id', event.actor_id,
          'previous_level', event.previous_level,
          'new_level', event.new_level
        ),
        jsonb_build_object('reason', event.reason)
      INTO v_evidence, v_sensitive_evidence
      FROM public.admin_role_change_events event
      WHERE event.id = v_bigint;

    WHEN 'moderation_review' THEN
      SELECT
        jsonb_build_object(
          'entity_type', review.entity_type,
          'entity_id', review.entity_id,
          'previous_status', review.previous_status,
          'previous_reason', review.previous_reason,
          'decision_status', review.decision_status,
          'decision_reason', review.decision_reason,
          'decision_source', review.decision_source,
          'matched_term_id', review.matched_term_id,
          'reviewed_by', review.reviewed_by,
          'metadata', review.metadata
        ),
        jsonb_build_object('review_note', review.review_note)
      INTO v_evidence, v_sensitive_evidence
      FROM public.moderation_reviews review
      WHERE review.id = v_uuid
        AND review.decision_source = 'manual';

    WHEN 'comment_report_decision' THEN
      SELECT
        jsonb_build_object(
          'comment_id', decision.comment_id,
          'reviewed_by', decision.reviewed_by,
          'pending_count_snapshot', decision.pending_count_snapshot,
          'resolution', decision.resolution,
          'author_action', decision.author_action,
          'decision_reason', decision.decision_reason
        ),
        jsonb_build_object('review_note', decision.review_note)
      INTO v_evidence, v_sensitive_evidence
      FROM public.comment_report_decisions decision
      WHERE decision.id = v_bigint;

    WHEN 'sanction_event' THEN
      SELECT
        jsonb_build_object(
          'sanction_id', sanction.id,
          'target_user_id', sanction.target_user_id,
          'sanction_type', sanction.sanction_type,
          'reason', sanction.reason,
          'starts_at', sanction.starts_at,
          'ends_at', sanction.ends_at,
          'source_comment_id', sanction.source_comment_id,
          'source_report_decision_id', sanction.source_report_decision_id,
          'source_moderation_review_id', sanction.source_moderation_review_id,
          'created_by', sanction.created_by,
          'event_type', sanction_event.event_type,
          'event_actor_id', sanction_event.actor_id,
          'recorded_state', state.state
        ),
        jsonb_build_object(
          'sanction_admin_note', sanction.admin_note,
          'event_note', sanction_event.note
        )
      INTO v_evidence, v_sensitive_evidence
      FROM public.user_sanction_events sanction_event
      JOIN public.user_sanctions sanction ON sanction.id = sanction_event.sanction_id
      LEFT JOIN public.user_sanction_states state ON state.sanction_id = sanction.id
      WHERE sanction_event.id = v_bigint;

    WHEN 'appeal_decision' THEN
      SELECT
        jsonb_build_object(
          'appeal_id', appeal.id,
          'sanction_id', sanction.id,
          'appellant_id', appeal.appellant_id,
          'sanction_type', sanction.sanction_type,
          'sanction_reason', sanction.reason,
          'decision', appeal_decision.decision,
          'reviewed_by', appeal_decision.reviewed_by,
          'recorded_state', state.state
        ),
        jsonb_build_object(
          'appeal_statement', appeal.statement,
          'review_note', appeal_decision.review_note,
          'sanction_admin_note', sanction.admin_note
        )
      INTO v_evidence, v_sensitive_evidence
      FROM public.user_sanction_appeal_decisions appeal_decision
      JOIN public.user_sanction_appeals appeal ON appeal.id = appeal_decision.appeal_id
      JOIN public.user_sanctions sanction ON sanction.id = appeal.sanction_id
      LEFT JOIN public.user_sanction_states state ON state.sanction_id = sanction.id
      WHERE appeal_decision.id = v_bigint;

    WHEN 'maintenance_job' THEN
      SELECT
        jsonb_build_object(
          'job_key', run.job_key,
          'trigger_source', run.trigger_source,
          'status', run.status,
          'started_at', run.started_at,
          'finished_at', run.finished_at,
          'batch_count', run.batch_count,
          'affected_rows', run.affected_rows,
          'error_code', run.error_code,
          'details', run.details
        ),
        jsonb_build_object('error_message', run.error_message)
      INTO v_evidence, v_sensitive_evidence
      FROM public.maintenance_job_runs run
      WHERE run.id = v_bigint;
  END CASE;

  IF v_evidence IS NULL THEN
    RAISE EXCEPTION '감사 이벤트 근거를 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_can_view_sensitive THEN
    v_sensitive_evidence := NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(related_event) ORDER BY related_event.created_at DESC, related_event.sort_key DESC),
    '[]'::JSONB
  )
  INTO v_related_events
  FROM private.list_admin_audit_event_stream(
    NULL,
    NULL,
    NULL,
    NULL,
    v_correlation_id,
    NULL,
    NULL,
    NULL,
    NULL,
    50
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

REVOKE ALL ON FUNCTION public.get_admin_audit_event_detail(TEXT, TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_event_detail(TEXT, TEXT)
TO authenticated;

COMMIT;
