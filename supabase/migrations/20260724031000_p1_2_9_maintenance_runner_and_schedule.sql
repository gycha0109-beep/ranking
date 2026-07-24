BEGIN;

CREATE OR REPLACE FUNCTION private.run_maintenance_job(
  p_job_key TEXT,
  p_trigger_source TEXT DEFAULT 'cron'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, cron, pg_temp
AS $$
DECLARE
  v_job public.maintenance_job_definitions%ROWTYPE;
  v_started_at TIMESTAMPTZ := NOW();
  v_finished_at TIMESTAMPTZ;
  v_batch_count INTEGER := 0;
  v_batch_rows INTEGER := 0;
  v_affected_rows BIGINT := 0;
  v_status TEXT;
  v_error_code TEXT;
  v_error_message TEXT;
  v_source TEXT := LOWER(BTRIM(COALESCE(p_trigger_source, 'cron')));
  v_run_id BIGINT;
BEGIN
  IF session_user <> 'postgres' AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION '유지보수 실행 권한이 없습니다.' USING ERRCODE = '42501';
  END IF;

  IF v_source NOT IN ('cron', 'service_role', 'hosted_validation') THEN
    RAISE EXCEPTION '유지보수 실행 출처가 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_job
  FROM public.maintenance_job_definitions
  WHERE job_key = LOWER(BTRIM(COALESCE(p_job_key, '')));

  IF NOT FOUND THEN
    RAISE EXCEPTION '등록되지 않은 유지보수 작업입니다.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtextextended('maintenance-job:' || v_job.job_key, 0)) THEN
    v_finished_at := NOW();
    INSERT INTO public.maintenance_job_runs(
      job_key, trigger_source, status, started_at, finished_at, batch_count, affected_rows, details
    ) VALUES (
      v_job.job_key, v_source, 'skipped_locked', v_started_at, v_finished_at, 0, 0,
      jsonb_build_object('batch_size', v_job.batch_size, 'max_batches', v_job.max_batches)
    ) RETURNING id INTO v_run_id;

    RETURN jsonb_build_object('run_id', v_run_id, 'job_key', v_job.job_key, 'status', 'skipped_locked', 'affected_rows', 0);
  END IF;

  IF NOT v_job.enabled THEN
    v_finished_at := NOW();
    INSERT INTO public.maintenance_job_runs(
      job_key, trigger_source, status, started_at, finished_at, batch_count, affected_rows, details
    ) VALUES (
      v_job.job_key, v_source, 'disabled', v_started_at, v_finished_at, 0, 0,
      jsonb_build_object('batch_size', v_job.batch_size, 'max_batches', v_job.max_batches)
    ) RETURNING id INTO v_run_id;

    RETURN jsonb_build_object('run_id', v_run_id, 'job_key', v_job.job_key, 'status', 'disabled', 'affected_rows', 0);
  END IF;

  BEGIN
    PERFORM set_config('statement_timeout', v_job.timeout_ms::TEXT, TRUE);

    FOR v_batch_count IN 1..v_job.max_batches LOOP
      CASE v_job.job_key
        WHEN 'expire_user_sanctions' THEN
          v_batch_rows := private.expire_due_user_sanctions_batch(v_job.batch_size);
        WHEN 'prune_notifications' THEN
          v_batch_rows := private.prune_expired_notifications_batch(NOW(), v_job.batch_size);
        WHEN 'purge_daily_views' THEN
          v_batch_rows := private.purge_expired_content_daily_views_batch(v_job.batch_size);
        WHEN 'redact_blocked_comments' THEN
          v_batch_rows := private.redact_expired_blocked_comment_bodies_batch(v_job.batch_size);
        WHEN 'redact_resolved_report_details' THEN
          v_batch_rows := private.redact_expired_comment_report_details_batch(v_job.batch_size);
        WHEN 'prune_cron_history' THEN
          v_batch_rows := private.prune_expired_cron_history_batch(v_job.batch_size);
        ELSE
          RAISE EXCEPTION '구현되지 않은 유지보수 작업입니다.' USING ERRCODE = 'P0001';
      END CASE;

      v_affected_rows := v_affected_rows + v_batch_rows;
      EXIT WHEN v_batch_rows < v_job.batch_size;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_code = RETURNED_SQLSTATE, v_error_message = MESSAGE_TEXT;
    v_affected_rows := 0;
    v_batch_count := 0;
    v_status := 'failed';
  END;

  v_finished_at := NOW();
  IF v_status IS NULL THEN
    v_status := CASE WHEN v_affected_rows = 0 THEN 'no_work' ELSE 'succeeded' END;
  END IF;

  INSERT INTO public.maintenance_job_runs(
    job_key, trigger_source, status, started_at, finished_at, batch_count, affected_rows,
    error_code, error_message, details
  ) VALUES (
    v_job.job_key, v_source, v_status, v_started_at, v_finished_at, v_batch_count, v_affected_rows,
    v_error_code,
    CASE WHEN v_error_message IS NULL THEN NULL ELSE LEFT(v_error_message, 1000) END,
    jsonb_build_object('batch_size', v_job.batch_size, 'max_batches', v_job.max_batches, 'timeout_ms', v_job.timeout_ms)
  ) RETURNING id INTO v_run_id;

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'job_key', v_job.job_key,
    'status', v_status,
    'batch_count', v_batch_count,
    'affected_rows', v_affected_rows,
    'error_code', v_error_code
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.run_maintenance_job(p_job_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;
  RETURN private.run_maintenance_job(p_job_key, 'service_role');
END;
$$;

CREATE OR REPLACE FUNCTION public.list_maintenance_job_status()
RETURNS TABLE(
  job_key TEXT,
  description TEXT,
  schedule TEXT,
  batch_size INTEGER,
  max_batches INTEGER,
  timeout_ms INTEGER,
  retention_policy TEXT,
  enabled BOOLEAN,
  cron_job_name TEXT,
  cron_registered BOOLEAN,
  cron_active BOOLEAN,
  last_run_id BIGINT,
  last_status TEXT,
  last_trigger_source TEXT,
  last_started_at TIMESTAMPTZ,
  last_finished_at TIMESTAMPTZ,
  last_batch_count INTEGER,
  last_affected_rows BIGINT,
  last_error_code TEXT,
  last_error_message TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, cron, pg_temp
AS $$
BEGIN
  PERFORM private.assert_admin_capability('audit_view');

  RETURN QUERY
  SELECT
    definition.job_key,
    definition.description,
    definition.schedule,
    definition.batch_size,
    definition.max_batches,
    definition.timeout_ms,
    definition.retention_policy,
    definition.enabled,
    definition.cron_job_name,
    (cron_job.jobid IS NOT NULL),
    COALESCE(cron_job.active, FALSE),
    latest.id,
    latest.status,
    latest.trigger_source,
    latest.started_at,
    latest.finished_at,
    latest.batch_count,
    latest.affected_rows,
    latest.error_code,
    latest.error_message
  FROM public.maintenance_job_definitions definition
  LEFT JOIN cron.job cron_job ON cron_job.jobname = definition.cron_job_name
  LEFT JOIN LATERAL (
    SELECT run.*
    FROM public.maintenance_job_runs run
    WHERE run.job_key = definition.job_key
    ORDER BY run.started_at DESC, run.id DESC
    LIMIT 1
  ) latest ON TRUE
  ORDER BY definition.job_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_maintenance_job_runs(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id BIGINT,
  job_key TEXT,
  trigger_source TEXT,
  status TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  batch_count INTEGER,
  affected_rows BIGINT,
  error_code TEXT,
  error_message TEXT,
  details JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
BEGIN
  PERFORM private.assert_admin_capability('audit_view');

  RETURN QUERY
  SELECT
    run.id,
    run.job_key,
    run.trigger_source,
    run.status,
    run.started_at,
    run.finished_at,
    run.batch_count,
    run.affected_rows,
    run.error_code,
    run.error_message,
    run.details
  FROM public.maintenance_job_runs run
  ORDER BY run.started_at DESC, run.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_admin_audit_events(p_limit INTEGER DEFAULT 100, p_offset INTEGER DEFAULT 0)
RETURNS TABLE(event_kind TEXT, event_id TEXT, actor_display_name TEXT, target_label TEXT, action TEXT, details JSONB, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
BEGIN
  PERFORM private.assert_admin_capability('audit_view');
  RETURN QUERY
  SELECT x.event_kind,x.event_id,x.actor_display_name,x.target_label,x.action,x.details,x.created_at
  FROM (
    SELECT 'role_change'::TEXT,e.id::TEXT,ap.display_name,COALESCE(tp.display_name,e.target_user_id::TEXT),e.previous_level||' → '||e.new_level,jsonb_build_object('reason',e.reason),e.created_at
    FROM public.admin_role_change_events e LEFT JOIN public.profiles ap ON ap.id=e.actor_id LEFT JOIN public.profiles tp ON tp.id=e.target_user_id
    UNION ALL
    SELECT 'moderation_review',mr.id::TEXT,rp.display_name,mr.entity_type||':'||mr.entity_id::TEXT,mr.decision_status,jsonb_build_object('previous_status',mr.previous_status,'reason',mr.decision_reason,'note',mr.review_note),mr.reviewed_at
    FROM public.moderation_reviews mr LEFT JOIN public.profiles rp ON rp.id=mr.reviewed_by WHERE mr.decision_source='manual'
    UNION ALL
    SELECT 'comment_report_decision',d.id::TEXT,rp.display_name,'comment:'||d.comment_id::TEXT,d.resolution,jsonb_build_object('author_action',d.author_action,'reason',d.decision_reason,'note',d.review_note),d.created_at
    FROM public.comment_report_decisions d LEFT JOIN public.profiles rp ON rp.id=d.reviewed_by
    UNION ALL
    SELECT 'sanction_event',se.id::TEXT,ap.display_name,COALESCE(tp.display_name,us.target_user_id::TEXT),se.event_type,jsonb_build_object('sanction_type',us.sanction_type,'note',se.note),se.created_at
    FROM public.user_sanction_events se JOIN public.user_sanctions us ON us.id=se.sanction_id LEFT JOIN public.profiles ap ON ap.id=se.actor_id LEFT JOIN public.profiles tp ON tp.id=us.target_user_id
    UNION ALL
    SELECT 'appeal_decision',ad.id::TEXT,rp.display_name,COALESCE(tp.display_name,a.appellant_id::TEXT),ad.decision,jsonb_build_object('review_note',ad.review_note,'sanction_id',a.sanction_id),ad.created_at
    FROM public.user_sanction_appeal_decisions ad JOIN public.user_sanction_appeals a ON a.id=ad.appeal_id LEFT JOIN public.profiles rp ON rp.id=ad.reviewed_by LEFT JOIN public.profiles tp ON tp.id=a.appellant_id
    UNION ALL
    SELECT 'maintenance_job',run.id::TEXT,NULL::TEXT,run.job_key,run.status,jsonb_build_object('trigger_source',run.trigger_source,'batch_count',run.batch_count,'affected_rows',run.affected_rows,'error_code',run.error_code),run.finished_at
    FROM public.maintenance_job_runs run
  ) x
  ORDER BY x.created_at DESC,x.event_kind,x.event_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200) OFFSET GREATEST(COALESCE(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION private.run_maintenance_job(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_maintenance_job(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_maintenance_job(TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.list_maintenance_job_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_maintenance_job_status() TO authenticated;
REVOKE ALL ON FUNCTION public.list_maintenance_job_runs(INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_maintenance_job_runs(INTEGER, INTEGER) TO authenticated;

DO $do$
DECLARE
  v_job RECORD;
BEGIN
  FOR v_job IN SELECT jobid FROM cron.job WHERE jobname LIKE 'ranking-maint-%'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;

  PERFORM cron.schedule('ranking-maint-expire-user-sanctions', '*/15 * * * *', $cmd$SELECT private.run_maintenance_job('expire_user_sanctions', 'cron');$cmd$);
  PERFORM cron.schedule('ranking-maint-prune-notifications', '10 3 * * *', $cmd$SELECT private.run_maintenance_job('prune_notifications', 'cron');$cmd$);
  PERFORM cron.schedule('ranking-maint-purge-daily-views', '20 3 * * *', $cmd$SELECT private.run_maintenance_job('purge_daily_views', 'cron');$cmd$);
  PERFORM cron.schedule('ranking-maint-redact-blocked-comments', '30 3 * * *', $cmd$SELECT private.run_maintenance_job('redact_blocked_comments', 'cron');$cmd$);
  PERFORM cron.schedule('ranking-maint-redact-resolved-report-details', '40 3 * * *', $cmd$SELECT private.run_maintenance_job('redact_resolved_report_details', 'cron');$cmd$);
  PERFORM cron.schedule('ranking-maint-prune-cron-history', '50 3 * * *', $cmd$SELECT private.run_maintenance_job('prune_cron_history', 'cron');$cmd$);
END;
$do$;

COMMIT;
