BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

ALTER TABLE public.comment_reports
  ADD COLUMN IF NOT EXISTS details_redacted_at TIMESTAMPTZ;

CREATE TABLE public.maintenance_job_definitions (
  job_key TEXT PRIMARY KEY,
  cron_job_name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  schedule TEXT NOT NULL,
  batch_size INTEGER NOT NULL CHECK (batch_size BETWEEN 1 AND 10000),
  max_batches INTEGER NOT NULL CHECK (max_batches BETWEEN 1 AND 100),
  timeout_ms INTEGER NOT NULL CHECK (timeout_ms BETWEEN 1000 AND 600000),
  retention_policy TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.maintenance_job_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_key TEXT NOT NULL REFERENCES public.maintenance_job_definitions(job_key) ON DELETE RESTRICT,
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('cron', 'service_role', 'hosted_validation')),
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'no_work', 'failed', 'skipped_locked', 'disabled')),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  batch_count INTEGER NOT NULL DEFAULT 0 CHECK (batch_count >= 0),
  affected_rows BIGINT NOT NULL DEFAULT 0 CHECK (affected_rows >= 0),
  error_code TEXT,
  error_message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT maintenance_job_runs_time_order CHECK (finished_at >= started_at),
  CONSTRAINT maintenance_job_runs_error_shape CHECK (
    (status = 'failed' AND error_code IS NOT NULL AND error_message IS NOT NULL)
    OR (status <> 'failed' AND error_code IS NULL AND error_message IS NULL)
  )
);

CREATE INDEX idx_maintenance_job_runs_job_started
  ON public.maintenance_job_runs(job_key, started_at DESC, id DESC);
CREATE INDEX idx_maintenance_job_runs_status_started
  ON public.maintenance_job_runs(status, started_at DESC, id DESC);

CREATE OR REPLACE FUNCTION private.reject_maintenance_job_run_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION '유지보수 실행 원장은 수정하거나 삭제할 수 없습니다.' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER trg_maintenance_job_runs_immutable
BEFORE UPDATE OR DELETE ON public.maintenance_job_runs
FOR EACH ROW
EXECUTE FUNCTION private.reject_maintenance_job_run_mutation();

ALTER TABLE public.maintenance_job_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_job_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.maintenance_job_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.maintenance_job_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reject_maintenance_job_run_mutation() FROM PUBLIC, anon, authenticated;

INSERT INTO public.maintenance_job_definitions(
  job_key, cron_job_name, description, schedule, batch_size, max_batches, timeout_ms, retention_policy, enabled
) VALUES
  ('expire_user_sanctions', 'ranking-maint-expire-user-sanctions', '기간이 끝난 사용자 제재를 expired 이벤트로 전환합니다.', '*/15 * * * *', 200, 5, 15000, '종료 시각 경과 후 상태 원장에 expired 이벤트 기록', TRUE),
  ('prune_notifications', 'ranking-maint-prune-notifications', '보존기간이 지난 사용자 알림을 삭제합니다.', '10 3 * * *', 5000, 10, 30000, '읽음 90일, 미읽음 180일', TRUE),
  ('purge_daily_views', 'ranking-maint-purge-daily-views', '13개월이 지난 일별 고유 조회 식별자를 삭제합니다.', '20 3 * * *', 10000, 20, 30000, 'UTC 날짜 기준 13개월', TRUE),
  ('redact_blocked_comments', 'ranking-maint-redact-blocked-comments', '장기 보관된 차단 댓글 본문을 고정 placeholder로 비식별화합니다.', '30 3 * * *', 1000, 10, 30000, '차단 상태 30일 이후 본문 비식별화', TRUE),
  ('redact_resolved_report_details', 'ranking-maint-redact-resolved-report-details', '해결된 신고의 자유서술 상세를 비식별화합니다.', '40 3 * * *', 1000, 10, 30000, '해결 또는 기각 180일 이후 details 제거', TRUE),
  ('prune_cron_history', 'ranking-maint-prune-cron-history', '오래된 pg_cron 실행 세부 기록을 정리합니다.', '50 3 * * *', 5000, 10, 30000, 'Cron 실행 종료 후 30일', TRUE)
ON CONFLICT (job_key) DO UPDATE SET
  cron_job_name = EXCLUDED.cron_job_name,
  description = EXCLUDED.description,
  schedule = EXCLUDED.schedule,
  batch_size = EXCLUDED.batch_size,
  max_batches = EXCLUDED.max_batches,
  timeout_ms = EXCLUDED.timeout_ms,
  retention_policy = EXCLUDED.retention_policy,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION private.expire_due_user_sanctions_batch(p_batch_size INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_row RECORD;
  v_count INTEGER := 0;
  v_batch_size INTEGER := LEAST(GREATEST(COALESCE(p_batch_size, 200), 1), 1000);
BEGIN
  FOR v_row IN
    SELECT us.id
    FROM public.user_sanctions us
    JOIN public.user_sanction_states state ON state.sanction_id = us.id
    WHERE state.state = 'active'
      AND us.ends_at IS NOT NULL
      AND us.ends_at <= NOW()
    ORDER BY us.ends_at, us.id
    LIMIT v_batch_size
    FOR UPDATE OF state SKIP LOCKED
  LOOP
    IF private.end_user_sanction_record(v_row.id, 'expired', NULL, NULL, TRUE) IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.prune_expired_notifications_batch(
  p_now TIMESTAMPTZ,
  p_batch_size INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
  v_batch_size INTEGER := LEAST(GREATEST(COALESCE(p_batch_size, 5000), 1), 10000);
BEGIN
  WITH expired AS (
    SELECT n.id
    FROM public.notifications n
    WHERE (n.read_at IS NOT NULL AND n.created_at < COALESCE(p_now, NOW()) - INTERVAL '90 days')
       OR (n.read_at IS NULL AND n.created_at < COALESCE(p_now, NOW()) - INTERVAL '180 days')
    ORDER BY n.created_at, n.id
    LIMIT v_batch_size
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.notifications n
  USING expired e
  WHERE n.id = e.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.purge_expired_content_daily_views_batch(p_batch_size INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
  v_batch_size INTEGER := LEAST(GREATEST(COALESCE(p_batch_size, 10000), 1), 10000);
  v_cutoff DATE := (((NOW() AT TIME ZONE 'UTC')::DATE - INTERVAL '13 months')::DATE);
BEGIN
  WITH expired AS (
    SELECT d.id
    FROM public.content_daily_views d
    WHERE d.viewed_on < v_cutoff
    ORDER BY d.viewed_on, d.id
    LIMIT v_batch_size
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.content_daily_views d
  USING expired e
  WHERE d.id = e.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.redact_expired_blocked_comment_bodies_batch(p_batch_size INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
  v_batch_size INTEGER := LEAST(GREATEST(COALESCE(p_batch_size, 1000), 1), 1000);
BEGIN
  WITH expired AS (
    SELECT c.id
    FROM public.comments c
    WHERE c.moderation_status = 'blocked'
      AND c.body_redacted_at IS NULL
      AND c.updated_at < NOW() - INTERVAL '30 days'
    ORDER BY c.updated_at, c.id
    LIMIT v_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.comments c
  SET body = '[REDACTED_BLOCKED_CONTENT]',
      body_redacted_at = NOW()
  FROM expired e
  WHERE c.id = e.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.redact_expired_comment_report_details_batch(p_batch_size INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
  v_batch_size INTEGER := LEAST(GREATEST(COALESCE(p_batch_size, 1000), 1), 1000);
BEGIN
  WITH expired AS (
    SELECT report.id
    FROM public.comment_reports report
    WHERE report.status IN ('resolved', 'dismissed')
      AND report.resolved_at IS NOT NULL
      AND report.resolved_at < NOW() - INTERVAL '180 days'
      AND report.details IS NOT NULL
      AND report.details_redacted_at IS NULL
    ORDER BY report.resolved_at, report.id
    LIMIT v_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.comment_reports report
  SET details = NULL,
      details_redacted_at = NOW()
  FROM expired e
  WHERE report.id = e.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.prune_expired_cron_history_batch(p_batch_size INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cron, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
  v_batch_size INTEGER := LEAST(GREATEST(COALESCE(p_batch_size, 5000), 1), 10000);
BEGIN
  WITH expired AS (
    SELECT runid
    FROM cron.job_run_details
    WHERE COALESCE(end_time, start_time) < NOW() - INTERVAL '30 days'
    ORDER BY COALESCE(end_time, start_time), runid
    LIMIT v_batch_size
  )
  DELETE FROM cron.job_run_details details
  USING expired e
  WHERE details.runid = e.runid;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_due_user_sanctions(p_limit INTEGER DEFAULT 100)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;
  RETURN private.expire_due_user_sanctions_batch(p_limit)::BIGINT;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_expired_notifications(p_now TIMESTAMPTZ DEFAULT NOW())
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_batch INTEGER;
  v_total BIGINT := 0;
  v_iteration INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;
  FOR v_iteration IN 1..20 LOOP
    v_batch := private.prune_expired_notifications_batch(p_now, 5000);
    v_total := v_total + v_batch;
    EXIT WHEN v_batch < 5000;
  END LOOP;
  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_expired_content_daily_views(p_batch_size INTEGER DEFAULT 10000)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;
  RETURN private.purge_expired_content_daily_views_batch(p_batch_size);
END;
$$;

CREATE OR REPLACE FUNCTION public.redact_expired_blocked_comment_bodies(p_batch_size INTEGER DEFAULT 1000)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;
  RETURN private.redact_expired_blocked_comment_bodies_batch(p_batch_size);
END;
$$;

CREATE OR REPLACE FUNCTION public.redact_expired_comment_report_details(p_batch_size INTEGER DEFAULT 1000)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;
  RETURN private.redact_expired_comment_report_details_batch(p_batch_size);
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_expired_cron_job_runs(p_batch_size INTEGER DEFAULT 5000)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;
  RETURN private.prune_expired_cron_history_batch(p_batch_size);
END;
$$;

REVOKE ALL ON FUNCTION private.expire_due_user_sanctions_batch(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prune_expired_notifications_batch(TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.purge_expired_content_daily_views_batch(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.redact_expired_blocked_comment_bodies_batch(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.redact_expired_comment_report_details_batch(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prune_expired_cron_history_batch(INTEGER) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.expire_due_user_sanctions(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_expired_notifications(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_expired_content_daily_views(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redact_expired_blocked_comment_bodies(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redact_expired_comment_report_details(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_expired_cron_job_runs(INTEGER) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.expire_due_user_sanctions(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_expired_notifications(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_content_daily_views(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.redact_expired_blocked_comment_bodies(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.redact_expired_comment_report_details(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_expired_cron_job_runs(INTEGER) TO service_role;

COMMIT;
