BEGIN;

CREATE TABLE public.operation_monitor_policies (
  job_key TEXT PRIMARY KEY REFERENCES public.maintenance_job_definitions(job_key) ON DELETE CASCADE,
  stale_after_minutes INTEGER NOT NULL CHECK (stale_after_minutes BETWEEN 10 AND 10080),
  failure_threshold INTEGER NOT NULL DEFAULT 2 CHECK (failure_threshold BETWEEN 1 AND 10),
  lock_skip_window_minutes INTEGER NOT NULL DEFAULT 60 CHECK (lock_skip_window_minutes BETWEEN 10 AND 1440),
  lock_skip_threshold INTEGER NOT NULL DEFAULT 3 CHECK (lock_skip_threshold BETWEEN 1 AND 100),
  backlog_run_threshold INTEGER NOT NULL DEFAULT 3 CHECK (backlog_run_threshold BETWEEN 2 AND 20),
  monitoring_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.operation_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_key TEXT NOT NULL UNIQUE,
  job_key TEXT NOT NULL REFERENCES public.maintenance_job_definitions(job_key) ON DELETE RESTRICT,
  incident_type TEXT NOT NULL CHECK (incident_type IN ('cron_unavailable','execution_stale','consecutive_failure','repeated_lock_skip','persistent_backlog')),
  status TEXT NOT NULL CHECK (status IN ('open','resolved')),
  severity TEXT NOT NULL CHECK (severity IN ('warning','critical')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_detected_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  latest_run_id BIGINT REFERENCES public.maintenance_job_runs(id) ON DELETE SET NULL,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operation_incidents_resolution_shape CHECK (
    (status='open' AND resolved_at IS NULL) OR (status='resolved' AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX idx_operation_incidents_status_severity ON public.operation_incidents(status, severity, last_detected_at DESC);
CREATE INDEX idx_operation_incidents_job_type ON public.operation_incidents(job_key, incident_type);

CREATE TABLE public.operation_incident_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES public.operation_incidents(id) ON DELETE RESTRICT,
  job_key TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('opened','observed','resolved')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  severity TEXT NOT NULL CHECK (severity IN ('warning','critical')),
  summary TEXT NOT NULL,
  related_run_id BIGINT REFERENCES public.maintenance_job_runs(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX idx_operation_incident_events_detected ON public.operation_incident_events(detected_at DESC, id DESC);
CREATE INDEX idx_operation_incident_events_incident ON public.operation_incident_events(incident_id, detected_at DESC, id DESC);

CREATE TABLE public.operation_alert_outbox (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_event_id BIGINT NOT NULL UNIQUE REFERENCES public.operation_incident_events(id) ON DELETE RESTRICT,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel='email'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','delivered','failed','dead_letter')),
  recipient_key TEXT NOT NULL DEFAULT 'operations_primary',
  subject TEXT NOT NULL,
  payload JSONB NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_operation_alert_outbox_claim ON public.operation_alert_outbox(status, available_at, id);

CREATE TABLE public.operation_monitor_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('cron','service_role','hosted_validation')),
  status TEXT NOT NULL CHECK (status IN ('succeeded','failed','skipped_locked')),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  opened_count INTEGER NOT NULL DEFAULT 0,
  observed_count INTEGER NOT NULL DEFAULT 0,
  resolved_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  CONSTRAINT operation_monitor_runs_error_shape CHECK (
    (status='failed' AND error_code IS NOT NULL AND error_message IS NOT NULL)
    OR (status<>'failed' AND error_code IS NULL AND error_message IS NULL)
  )
);

CREATE OR REPLACE FUNCTION private.reject_operation_immutable_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION '운영 감시 원장은 수정하거나 삭제할 수 없습니다.' USING ERRCODE='42501';
END;
$$;

CREATE TRIGGER trg_operation_incident_events_immutable
BEFORE UPDATE OR DELETE ON public.operation_incident_events
FOR EACH ROW EXECUTE FUNCTION private.reject_operation_immutable_mutation();
CREATE TRIGGER trg_operation_monitor_runs_immutable
BEFORE UPDATE OR DELETE ON public.operation_monitor_runs
FOR EACH ROW EXECUTE FUNCTION private.reject_operation_immutable_mutation();

ALTER TABLE public.operation_monitor_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_alert_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_monitor_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.operation_monitor_policies FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.operation_incidents FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.operation_incident_events FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.operation_alert_outbox FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.operation_monitor_runs FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO public.operation_monitor_policies(job_key, stale_after_minutes)
SELECT definition.job_key,
       CASE WHEN definition.schedule='*/15 * * * *' THEN 45 ELSE 1800 END
FROM public.maintenance_job_definitions definition
ON CONFLICT (job_key) DO UPDATE SET
  stale_after_minutes=EXCLUDED.stale_after_minutes,
  updated_at=NOW();

CREATE OR REPLACE FUNCTION private.record_operation_condition(
  p_job_key TEXT,
  p_incident_type TEXT,
  p_severity TEXT,
  p_active BOOLEAN,
  p_summary TEXT,
  p_related_run_id BIGINT,
  p_fingerprint TEXT,
  p_details JSONB DEFAULT '{}'::JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_incident public.operation_incidents%ROWTYPE;
  v_event_type TEXT;
  v_event_id BIGINT;
  v_now TIMESTAMPTZ := NOW();
  v_title TEXT := p_job_key || ' · ' || p_incident_type;
  v_last_event_at TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_incident
  FROM public.operation_incidents
  WHERE incident_key=p_job_key||':'||p_incident_type
  FOR UPDATE;

  IF p_active THEN
    IF NOT FOUND THEN
      INSERT INTO public.operation_incidents(
        incident_key,job_key,incident_type,status,severity,title,summary,
        first_detected_at,last_detected_at,latest_run_id,fingerprint
      ) VALUES (
        p_job_key||':'||p_incident_type,p_job_key,p_incident_type,'open',p_severity,v_title,p_summary,
        v_now,v_now,p_related_run_id,p_fingerprint
      ) RETURNING * INTO v_incident;
      v_event_type := 'opened';
    ELSIF v_incident.status='resolved' THEN
      UPDATE public.operation_incidents SET
        status='open',severity=p_severity,title=v_title,summary=p_summary,
        first_detected_at=v_now,last_detected_at=v_now,resolved_at=NULL,
        occurrence_count=occurrence_count+1,latest_run_id=p_related_run_id,
        fingerprint=p_fingerprint,updated_at=v_now
      WHERE id=v_incident.id RETURNING * INTO v_incident;
      v_event_type := 'opened';
    ELSE
      SELECT MAX(detected_at) INTO v_last_event_at
      FROM public.operation_incident_events
      WHERE incident_id=v_incident.id AND event_type='observed';

      UPDATE public.operation_incidents SET
        severity=p_severity,summary=p_summary,last_detected_at=v_now,
        occurrence_count=occurrence_count+1,latest_run_id=p_related_run_id,
        fingerprint=p_fingerprint,updated_at=v_now
      WHERE id=v_incident.id RETURNING * INTO v_incident;

      IF v_incident.fingerprint IS DISTINCT FROM p_fingerprint
         OR v_last_event_at IS NULL
         OR v_last_event_at < v_now-INTERVAL '6 hours' THEN
        v_event_type := 'observed';
      END IF;
    END IF;
  ELSIF FOUND AND v_incident.status='open' THEN
    UPDATE public.operation_incidents SET
      status='resolved',resolved_at=v_now,last_detected_at=v_now,
      summary=p_summary,latest_run_id=p_related_run_id,fingerprint=p_fingerprint,updated_at=v_now
    WHERE id=v_incident.id RETURNING * INTO v_incident;
    v_event_type := 'resolved';
  END IF;

  IF v_event_type IS NOT NULL THEN
    INSERT INTO public.operation_incident_events(
      incident_id,job_key,incident_type,event_type,detected_at,severity,summary,related_run_id,details
    ) VALUES (
      v_incident.id,p_job_key,p_incident_type,v_event_type,v_now,p_severity,p_summary,p_related_run_id,COALESCE(p_details,'{}'::JSONB)
    ) RETURNING id INTO v_event_id;

    IF v_event_type IN ('opened','resolved') THEN
      INSERT INTO public.operation_alert_outbox(incident_event_id,subject,payload)
      VALUES (
        v_event_id,
        CASE WHEN v_event_type='opened' THEN '[랭킹위키 운영 장애] ' ELSE '[랭킹위키 운영 복구] ' END || v_title,
        jsonb_build_object(
          'event_type',v_event_type,'job_key',p_job_key,'incident_type',p_incident_type,
          'severity',p_severity,'summary',p_summary,'detected_at',v_now,'admin_path','/admin/operations'
        )
      );
    END IF;
  END IF;

  RETURN v_event_type;
END;
$$;

CREATE OR REPLACE FUNCTION private.evaluate_operation_health(p_trigger_source TEXT DEFAULT 'cron')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, cron, pg_temp
AS $$
DECLARE
  v_source TEXT := LOWER(BTRIM(COALESCE(p_trigger_source,'cron')));
  v_started TIMESTAMPTZ := NOW();
  v_finished TIMESTAMPTZ;
  v_policy RECORD;
  v_latest public.maintenance_job_runs%ROWTYPE;
  v_cron_ok BOOLEAN;
  v_stale BOOLEAN;
  v_failed_count INTEGER;
  v_lock_count INTEGER;
  v_backlog_count INTEGER;
  v_event TEXT;
  v_opened INTEGER := 0;
  v_observed INTEGER := 0;
  v_resolved INTEGER := 0;
  v_error_code TEXT;
  v_error_message TEXT;
  v_run_id BIGINT;
BEGIN
  IF session_user<>'postgres' AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION '운영 감시 실행 권한이 없습니다.' USING ERRCODE='42501';
  END IF;
  IF v_source NOT IN ('cron','service_role','hosted_validation') THEN
    RAISE EXCEPTION '운영 감시 실행 출처가 올바르지 않습니다.' USING ERRCODE='22023';
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtextextended('ranking:operation-health-monitor',0)) THEN
    INSERT INTO public.operation_monitor_runs(trigger_source,status,started_at,finished_at)
    VALUES(v_source,'skipped_locked',v_started,NOW()) RETURNING id INTO v_run_id;
    RETURN jsonb_build_object('run_id',v_run_id,'status','skipped_locked');
  END IF;

  BEGIN
    FOR v_policy IN
      SELECT policy.*, definition.cron_job_name, definition.batch_size, definition.max_batches
      FROM public.operation_monitor_policies policy
      JOIN public.maintenance_job_definitions definition USING(job_key)
      WHERE policy.enabled AND definition.enabled
      ORDER BY policy.job_key
    LOOP
      SELECT run.* INTO v_latest
      FROM public.maintenance_job_runs run
      WHERE run.job_key=v_policy.job_key
      ORDER BY run.finished_at DESC,run.id DESC LIMIT 1;

      SELECT EXISTS(
        SELECT 1 FROM cron.job job
        WHERE job.jobname=v_policy.cron_job_name AND job.active
      ) INTO v_cron_ok;

      v_event := private.record_operation_condition(
        v_policy.job_key,'cron_unavailable','critical',NOT v_cron_ok,
        CASE WHEN v_cron_ok THEN 'Cron 작업이 등록되어 활성 상태입니다.' ELSE 'Cron 작업이 없거나 비활성 상태입니다.' END,
        v_latest.id,md5(v_cron_ok::TEXT),jsonb_build_object('cron_job_name',v_policy.cron_job_name)
      );
      IF v_event='opened' THEN v_opened:=v_opened+1; ELSIF v_event='observed' THEN v_observed:=v_observed+1; ELSIF v_event='resolved' THEN v_resolved:=v_resolved+1; END IF;

      v_stale := COALESCE(v_latest.finished_at,v_policy.monitoring_started_at) < NOW()-make_interval(mins=>v_policy.stale_after_minutes);
      v_event := private.record_operation_condition(
        v_policy.job_key,'execution_stale','critical',v_stale,
        CASE WHEN v_stale THEN '허용 지연을 초과해 최근 실행이 없습니다.' ELSE '최근 실행 시각이 허용 범위 안입니다.' END,
        v_latest.id,md5(COALESCE(v_latest.finished_at::TEXT,v_policy.monitoring_started_at::TEXT)),
        jsonb_build_object('stale_after_minutes',v_policy.stale_after_minutes,'last_finished_at',v_latest.finished_at)
      );
      IF v_event='opened' THEN v_opened:=v_opened+1; ELSIF v_event='observed' THEN v_observed:=v_observed+1; ELSIF v_event='resolved' THEN v_resolved:=v_resolved+1; END IF;

      SELECT COUNT(*) INTO v_failed_count FROM (
        SELECT status FROM public.maintenance_job_runs
        WHERE job_key=v_policy.job_key ORDER BY finished_at DESC,id DESC LIMIT v_policy.failure_threshold
      ) recent WHERE status='failed';
      v_event := private.record_operation_condition(
        v_policy.job_key,'consecutive_failure','critical',v_failed_count>=v_policy.failure_threshold,
        CASE WHEN v_failed_count>=v_policy.failure_threshold THEN v_failed_count||'회 연속 실패가 감지되었습니다.' ELSE '연속 실패 기준을 충족하지 않습니다.' END,
        v_latest.id,md5(v_failed_count::TEXT),jsonb_build_object('failure_count',v_failed_count,'threshold',v_policy.failure_threshold)
      );
      IF v_event='opened' THEN v_opened:=v_opened+1; ELSIF v_event='observed' THEN v_observed:=v_observed+1; ELSIF v_event='resolved' THEN v_resolved:=v_resolved+1; END IF;

      SELECT COUNT(*) INTO v_lock_count
      FROM public.maintenance_job_runs
      WHERE job_key=v_policy.job_key AND status='skipped_locked'
        AND finished_at>=NOW()-make_interval(mins=>v_policy.lock_skip_window_minutes);
      v_event := private.record_operation_condition(
        v_policy.job_key,'repeated_lock_skip','warning',v_lock_count>=v_policy.lock_skip_threshold,
        CASE WHEN v_lock_count>=v_policy.lock_skip_threshold THEN '중복 실행 잠금 건너뜀이 반복되었습니다.' ELSE '잠금 건너뜀 횟수가 허용 범위입니다.' END,
        v_latest.id,md5(v_lock_count::TEXT),jsonb_build_object('lock_skip_count',v_lock_count,'threshold',v_policy.lock_skip_threshold)
      );
      IF v_event='opened' THEN v_opened:=v_opened+1; ELSIF v_event='observed' THEN v_observed:=v_observed+1; ELSIF v_event='resolved' THEN v_resolved:=v_resolved+1; END IF;

      SELECT COUNT(*) INTO v_backlog_count FROM (
        SELECT status,batch_count,affected_rows FROM public.maintenance_job_runs
        WHERE job_key=v_policy.job_key ORDER BY finished_at DESC,id DESC LIMIT v_policy.backlog_run_threshold
      ) recent
      WHERE status='succeeded' AND batch_count>=v_policy.max_batches
        AND affected_rows>=v_policy.batch_size::BIGINT*v_policy.max_batches::BIGINT;
      v_event := private.record_operation_condition(
        v_policy.job_key,'persistent_backlog','warning',v_backlog_count>=v_policy.backlog_run_threshold,
        CASE WHEN v_backlog_count>=v_policy.backlog_run_threshold THEN '최대 처리량을 연속 소진해 backlog가 의심됩니다.' ELSE '지속 backlog 기준을 충족하지 않습니다.' END,
        v_latest.id,md5(v_backlog_count::TEXT),jsonb_build_object('backlog_runs',v_backlog_count,'threshold',v_policy.backlog_run_threshold)
      );
      IF v_event='opened' THEN v_opened:=v_opened+1; ELSIF v_event='observed' THEN v_observed:=v_observed+1; ELSIF v_event='resolved' THEN v_resolved:=v_resolved+1; END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_code=RETURNED_SQLSTATE,v_error_message=MESSAGE_TEXT;
  END;

  v_finished:=NOW();
  INSERT INTO public.operation_monitor_runs(
    trigger_source,status,started_at,finished_at,opened_count,observed_count,resolved_count,error_code,error_message
  ) VALUES (
    v_source,CASE WHEN v_error_code IS NULL THEN 'succeeded' ELSE 'failed' END,v_started,v_finished,
    v_opened,v_observed,v_resolved,v_error_code,CASE WHEN v_error_message IS NULL THEN NULL ELSE LEFT(v_error_message,500) END
  ) RETURNING id INTO v_run_id;

  RETURN jsonb_build_object('run_id',v_run_id,'status',CASE WHEN v_error_code IS NULL THEN 'succeeded' ELSE 'failed' END,
    'opened_count',v_opened,'observed_count',v_observed,'resolved_count',v_resolved,'error_code',v_error_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.run_operation_monitor()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public,auth,private,pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role 권한이 필요합니다.' USING ERRCODE='42501';
  END IF;
  RETURN private.evaluate_operation_health('service_role');
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_operation_alerts(p_limit INTEGER DEFAULT 20)
RETURNS SETOF public.operation_alert_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public,auth,pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service role 권한이 필요합니다.' USING ERRCODE='42501'; END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM public.operation_alert_outbox
    WHERE attempt_count<5 AND available_at<=NOW()
      AND (status IN ('pending','failed') OR (status='processing' AND claimed_at<NOW()-INTERVAL '15 minutes'))
    ORDER BY available_at,id LIMIT LEAST(GREATEST(COALESCE(p_limit,20),1),50)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.operation_alert_outbox outbox SET
      status='processing',claimed_at=NOW(),attempt_count=attempt_count+1,updated_at=NOW()
    FROM candidates WHERE outbox.id=candidates.id RETURNING outbox.*
  ) SELECT * FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_operation_alert(
  p_alert_id BIGINT,p_delivered BOOLEAN,p_error_code TEXT DEFAULT NULL,p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public,auth,pg_temp
AS $$
DECLARE v_attempt INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service role 권한이 필요합니다.' USING ERRCODE='42501'; END IF;
  SELECT attempt_count INTO v_attempt FROM public.operation_alert_outbox WHERE id=p_alert_id AND status='processing' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '처리 중인 알림을 찾을 수 없습니다.' USING ERRCODE='P0002'; END IF;
  UPDATE public.operation_alert_outbox SET
    status=CASE WHEN p_delivered THEN 'delivered' WHEN v_attempt>=5 THEN 'dead_letter' ELSE 'failed' END,
    delivered_at=CASE WHEN p_delivered THEN NOW() ELSE NULL END,
    available_at=CASE WHEN p_delivered OR v_attempt>=5 THEN available_at ELSE NOW()+make_interval(mins=>LEAST(60,POWER(2,v_attempt)::INTEGER)) END,
    last_error_code=CASE WHEN p_delivered THEN NULL ELSE LEFT(COALESCE(p_error_code,'delivery_failed'),100) END,
    last_error_message=CASE WHEN p_delivered THEN NULL ELSE LEFT(COALESCE(p_error_message,'알림 전달에 실패했습니다.'),500) END,
    updated_at=NOW()
  WHERE id=p_alert_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_operation_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public,auth,private,cron,pg_temp
AS $$
DECLARE v_result JSONB;
BEGIN
  PERFORM private.assert_admin_capability('audit_view');
  SELECT jsonb_build_object(
    'health',CASE WHEN COUNT(*) FILTER(WHERE status='open' AND severity='critical')>0 THEN 'critical'
                  WHEN COUNT(*) FILTER(WHERE status='open' AND severity='warning')>0 THEN 'warning' ELSE 'healthy' END,
    'open_critical',COUNT(*) FILTER(WHERE status='open' AND severity='critical'),
    'open_warning',COUNT(*) FILTER(WHERE status='open' AND severity='warning'),
    'last_monitor_run',(SELECT to_jsonb(run) FROM public.operation_monitor_runs run ORDER BY finished_at DESC,id DESC LIMIT 1)
  ) INTO v_result FROM public.operation_incidents;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_operation_incidents(p_status TEXT DEFAULT NULL,p_limit INTEGER DEFAULT 100)
RETURNS TABLE(id UUID,job_key TEXT,incident_type TEXT,status TEXT,severity TEXT,title TEXT,summary TEXT,first_detected_at TIMESTAMPTZ,last_detected_at TIMESTAMPTZ,resolved_at TIMESTAMPTZ,occurrence_count INTEGER,latest_run_id BIGINT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public,auth,private,pg_temp
AS $$
BEGIN
  PERFORM private.assert_admin_capability('audit_view');
  RETURN QUERY SELECT incident.id,incident.job_key,incident.incident_type,incident.status,incident.severity,incident.title,incident.summary,incident.first_detected_at,incident.last_detected_at,incident.resolved_at,incident.occurrence_count,incident.latest_run_id
  FROM public.operation_incidents incident
  WHERE p_status IS NULL OR incident.status=p_status
  ORDER BY CASE incident.status WHEN 'open' THEN 0 ELSE 1 END,CASE incident.severity WHEN 'critical' THEN 0 ELSE 1 END,incident.last_detected_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_operation_alert_status(p_limit INTEGER DEFAULT 100)
RETURNS TABLE(id BIGINT,subject TEXT,status TEXT,attempt_count INTEGER,available_at TIMESTAMPTZ,claimed_at TIMESTAMPTZ,delivered_at TIMESTAMPTZ,last_error_code TEXT,last_error_message TEXT,created_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public,auth,private,pg_temp
AS $$
BEGIN
  PERFORM private.assert_admin_capability('audit_view');
  RETURN QUERY SELECT outbox.id,outbox.subject,outbox.status,outbox.attempt_count,outbox.available_at,outbox.claimed_at,outbox.delivered_at,outbox.last_error_code,outbox.last_error_message,outbox.created_at
  FROM public.operation_alert_outbox outbox ORDER BY outbox.created_at DESC,outbox.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_admin_audit_events(p_limit INTEGER DEFAULT 100, p_offset INTEGER DEFAULT 0)
RETURNS TABLE(event_kind TEXT,event_id TEXT,actor_display_name TEXT,target_label TEXT,action TEXT,details JSONB,created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public,auth,private,pg_temp
AS $$
BEGIN
  PERFORM private.assert_admin_capability('audit_view');
  RETURN QUERY SELECT x.event_kind,x.event_id,x.actor_display_name,x.target_label,x.action,x.details,x.created_at FROM (
    SELECT 'role_change'::TEXT,e.id::TEXT,ap.display_name,COALESCE(tp.display_name,e.target_user_id::TEXT),e.previous_level||' → '||e.new_level,jsonb_build_object('reason',e.reason),e.created_at FROM public.admin_role_change_events e LEFT JOIN public.profiles ap ON ap.id=e.actor_id LEFT JOIN public.profiles tp ON tp.id=e.target_user_id
    UNION ALL SELECT 'moderation_review',mr.id::TEXT,rp.display_name,mr.entity_type||':'||mr.entity_id::TEXT,mr.decision_status,jsonb_build_object('previous_status',mr.previous_status,'reason',mr.decision_reason,'note',mr.review_note),mr.reviewed_at FROM public.moderation_reviews mr LEFT JOIN public.profiles rp ON rp.id=mr.reviewed_by WHERE mr.decision_source='manual'
    UNION ALL SELECT 'comment_report_decision',d.id::TEXT,rp.display_name,'comment:'||d.comment_id::TEXT,d.resolution,jsonb_build_object('author_action',d.author_action,'reason',d.decision_reason,'note',d.review_note),d.created_at FROM public.comment_report_decisions d LEFT JOIN public.profiles rp ON rp.id=d.reviewed_by
    UNION ALL SELECT 'sanction_event',se.id::TEXT,ap.display_name,COALESCE(tp.display_name,us.target_user_id::TEXT),se.event_type,jsonb_build_object('sanction_type',us.sanction_type,'note',se.note),se.created_at FROM public.user_sanction_events se JOIN public.user_sanctions us ON us.id=se.sanction_id LEFT JOIN public.profiles ap ON ap.id=se.actor_id LEFT JOIN public.profiles tp ON tp.id=us.target_user_id
    UNION ALL SELECT 'appeal_decision',ad.id::TEXT,rp.display_name,COALESCE(tp.display_name,a.appellant_id::TEXT),ad.decision,jsonb_build_object('review_note',ad.review_note,'sanction_id',a.sanction_id),ad.created_at FROM public.user_sanction_appeal_decisions ad JOIN public.user_sanction_appeals a ON a.id=ad.appeal_id LEFT JOIN public.profiles rp ON rp.id=ad.reviewed_by LEFT JOIN public.profiles tp ON tp.id=a.appellant_id
    UNION ALL SELECT 'maintenance_job',run.id::TEXT,NULL::TEXT,run.job_key,run.status,jsonb_build_object('trigger_source',run.trigger_source,'batch_count',run.batch_count,'affected_rows',run.affected_rows,'error_code',run.error_code),run.finished_at FROM public.maintenance_job_runs run
    UNION ALL SELECT 'operation_incident',event.id::TEXT,NULL::TEXT,event.job_key,event.event_type,jsonb_build_object('incident_type',event.incident_type,'severity',event.severity,'related_run_id',event.related_run_id),event.detected_at FROM public.operation_incident_events event
  ) x ORDER BY x.created_at DESC,x.event_kind,x.event_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200) OFFSET GREATEST(COALESCE(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION private.record_operation_condition(TEXT,TEXT,TEXT,BOOLEAN,TEXT,BIGINT,TEXT,JSONB) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.evaluate_operation_health(TEXT) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.run_operation_monitor() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.run_operation_monitor() TO service_role;
REVOKE ALL ON FUNCTION public.claim_operation_alerts(INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_operation_alerts(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.complete_operation_alert(BIGINT,BOOLEAN,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_operation_alert(BIGINT,BOOLEAN,TEXT,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.list_operation_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_operation_status() TO authenticated;
REVOKE ALL ON FUNCTION public.list_operation_incidents(TEXT,INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_operation_incidents(TEXT,INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.list_operation_alert_status(INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_operation_alert_status(INTEGER) TO authenticated;

DO $schedule$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='ranking-operations-watchdog';
  PERFORM cron.schedule('ranking-operations-watchdog','*/10 * * * *',$command$SELECT private.evaluate_operation_health('cron');$command$);
END;
$schedule$;

COMMIT;
