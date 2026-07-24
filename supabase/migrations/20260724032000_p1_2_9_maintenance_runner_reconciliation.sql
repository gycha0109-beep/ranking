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
  v_iteration INTEGER;
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
    RETURN jsonb_build_object('run_id', v_run_id, 'job_key', v_job.job_key, 'status', 'skipped_locked', 'batch_count', 0, 'affected_rows', 0);
  END IF;

  IF NOT v_job.enabled THEN
    v_finished_at := NOW();
    INSERT INTO public.maintenance_job_runs(
      job_key, trigger_source, status, started_at, finished_at, batch_count, affected_rows, details
    ) VALUES (
      v_job.job_key, v_source, 'disabled', v_started_at, v_finished_at, 0, 0,
      jsonb_build_object('batch_size', v_job.batch_size, 'max_batches', v_job.max_batches)
    ) RETURNING id INTO v_run_id;
    RETURN jsonb_build_object('run_id', v_run_id, 'job_key', v_job.job_key, 'status', 'disabled', 'batch_count', 0, 'affected_rows', 0);
  END IF;

  BEGIN
    PERFORM set_config('statement_timeout', v_job.timeout_ms::TEXT, TRUE);

    FOR v_iteration IN 1..v_job.max_batches LOOP
      CASE v_job.job_key
        WHEN 'expire_user_sanctions' THEN v_batch_rows := private.expire_due_user_sanctions_batch(v_job.batch_size);
        WHEN 'prune_notifications' THEN v_batch_rows := private.prune_expired_notifications_batch(NOW(), v_job.batch_size);
        WHEN 'purge_daily_views' THEN v_batch_rows := private.purge_expired_content_daily_views_batch(v_job.batch_size);
        WHEN 'redact_blocked_comments' THEN v_batch_rows := private.redact_expired_blocked_comment_bodies_batch(v_job.batch_size);
        WHEN 'redact_resolved_report_details' THEN v_batch_rows := private.redact_expired_comment_report_details_batch(v_job.batch_size);
        WHEN 'prune_cron_history' THEN v_batch_rows := private.prune_expired_cron_history_batch(v_job.batch_size);
        ELSE RAISE EXCEPTION '구현되지 않은 유지보수 작업입니다.' USING ERRCODE = 'P0001';
      END CASE;

      v_batch_count := v_batch_count + 1;
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

REVOKE ALL ON FUNCTION private.run_maintenance_job(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

COMMIT;
