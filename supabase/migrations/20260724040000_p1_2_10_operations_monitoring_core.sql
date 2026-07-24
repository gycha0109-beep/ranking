BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.operations_monitor_policies (
  job_key TEXT PRIMARY KEY REFERENCES public.maintenance_job_definitions(job_key) ON DELETE CASCADE,
  expected_interval_minutes INTEGER NOT NULL CHECK (expected_interval_minutes BETWEEN 1 AND 10080),
  stale_after_minutes INTEGER NOT NULL CHECK (stale_after_minutes >= expected_interval_minutes),
  failure_threshold INTEGER NOT NULL CHECK (failure_threshold BETWEEN 1 AND 20),
  saturation_threshold INTEGER NOT NULL CHECK (saturation_threshold BETWEEN 1 AND 20),
  lock_skip_threshold INTEGER NOT NULL CHECK (lock_skip_threshold BETWEEN 1 AND 100),
  lock_window_minutes INTEGER NOT NULL CHECK (lock_window_minutes BETWEEN 5 AND 1440),
  recovery_threshold INTEGER NOT NULL DEFAULT 2 CHECK (recovery_threshold BETWEEN 1 AND 10),
  monitor_after TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.operations_incidents (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  job_key TEXT NOT NULL REFERENCES public.maintenance_job_definitions(job_key) ON DELETE RESTRICT,
  incident_type TEXT NOT NULL CHECK (incident_type IN (
    'cron_missing',
    'cron_inactive',
    'schedule_mismatch',
    'execution_stale',
    'consecutive_failures',
    'batch_saturation',
    'lock_contention',
    'disabled_but_scheduled'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  summary TEXT NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 500),
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_detected_at TIMESTAMPTZ NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_count >= 1),
  healthy_scan_count INTEGER NOT NULL DEFAULT 0 CHECK (healthy_scan_count >= 0),
  opened_run_id BIGINT REFERENCES public.maintenance_job_runs(id) ON DELETE SET NULL,
  latest_run_id BIGINT REFERENCES public.maintenance_job_runs(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operations_incidents_time_order CHECK (last_detected_at >= first_detected_at),
  CONSTRAINT operations_incidents_resolution_shape CHECK (
    (status = 'open' AND resolved_at IS NULL)
    OR (status = 'resolved' AND resolved_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_operations_incidents_open_type
  ON public.operations_incidents(job_key, incident_type)
  WHERE status = 'open';
CREATE INDEX idx_operations_incidents_status_detected
  ON public.operations_incidents(status, last_detected_at DESC, id);
CREATE INDEX idx_operations_incidents_job_detected
  ON public.operations_incidents(job_key, last_detected_at DESC, id);

CREATE TABLE public.operations_monitor_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('cron', 'service_role', 'hosted_validation')),
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'skipped_locked')),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  opened_count INTEGER NOT NULL DEFAULT 0 CHECK (opened_count >= 0),
  resolved_count INTEGER NOT NULL DEFAULT 0 CHECK (resolved_count >= 0),
  dispatched_count INTEGER NOT NULL DEFAULT 0 CHECK (dispatched_count >= 0),
  error_code TEXT,
  error_message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT operations_monitor_runs_time_order CHECK (finished_at >= started_at),
  CONSTRAINT operations_monitor_runs_error_shape CHECK (
    (status = 'failed' AND error_code IS NOT NULL AND error_message IS NOT NULL)
    OR (status <> 'failed' AND error_code IS NULL AND error_message IS NULL)
  )
);

CREATE INDEX idx_operations_monitor_runs_started
  ON public.operations_monitor_runs(started_at DESC, id DESC);

CREATE TABLE public.operations_alert_channels (
  channel_key TEXT PRIMARY KEY CHECK (channel_key = 'email'),
  endpoint_url TEXT NOT NULL CHECK (endpoint_url ~ '^https://'),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
  token_ttl_seconds INTEGER NOT NULL DEFAULT 600 CHECK (token_ttl_seconds BETWEEN 60 AND 3600),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.operations_alert_deliveries (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.operations_incidents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('opened', 'resolved')),
  delivery_mode TEXT NOT NULL DEFAULT 'email' CHECK (delivery_mode IN ('email', 'hosted_validation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'dispatched', 'processing', 'delivered', 'retry_wait', 'failed'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispatch_request_id BIGINT,
  token_hash TEXT,
  token_expires_at TIMESTAMPTZ,
  provider_message_id TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  UNIQUE (incident_id, event_type, delivery_mode),
  CONSTRAINT operations_alert_deliveries_error_length CHECK (
    last_error_message IS NULL OR char_length(last_error_message) <= 1000
  )
);

CREATE INDEX idx_operations_alert_deliveries_dispatch
  ON public.operations_alert_deliveries(status, next_attempt_at, created_at, id);
CREATE INDEX idx_operations_alert_deliveries_incident
  ON public.operations_alert_deliveries(incident_id, created_at DESC, id);

CREATE OR REPLACE FUNCTION private.reject_operations_monitor_run_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION '운영 감시 실행 원장은 수정하거나 삭제할 수 없습니다.' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER trg_operations_monitor_runs_immutable
BEFORE UPDATE OR DELETE ON public.operations_monitor_runs
FOR EACH ROW
EXECUTE FUNCTION private.reject_operations_monitor_run_mutation();

INSERT INTO public.operations_monitor_policies(
  job_key,
  expected_interval_minutes,
  stale_after_minutes,
  failure_threshold,
  saturation_threshold,
  lock_skip_threshold,
  lock_window_minutes,
  recovery_threshold,
  monitor_after
)
SELECT
  definition.job_key,
  CASE WHEN definition.job_key = 'expire_user_sanctions' THEN 15 ELSE 1440 END,
  CASE WHEN definition.job_key = 'expire_user_sanctions' THEN 35 ELSE 1560 END,
  2,
  3,
  3,
  CASE WHEN definition.job_key = 'expire_user_sanctions' THEN 30 ELSE 60 END,
  2,
  NOW() + CASE WHEN definition.job_key = 'expire_user_sanctions' THEN INTERVAL '40 minutes' ELSE INTERVAL '26 hours' END
FROM public.maintenance_job_definitions definition
ON CONFLICT (job_key) DO UPDATE SET
  expected_interval_minutes = EXCLUDED.expected_interval_minutes,
  stale_after_minutes = EXCLUDED.stale_after_minutes,
  failure_threshold = EXCLUDED.failure_threshold,
  saturation_threshold = EXCLUDED.saturation_threshold,
  lock_skip_threshold = EXCLUDED.lock_skip_threshold,
  lock_window_minutes = EXCLUDED.lock_window_minutes,
  recovery_threshold = EXCLUDED.recovery_threshold,
  updated_at = NOW();

INSERT INTO public.operations_alert_channels(
  channel_key,
  endpoint_url,
  enabled,
  max_attempts,
  token_ttl_seconds
) VALUES (
  'email',
  'https://yjdubukqkcvkymabskzd.supabase.co/functions/v1/operations-alert-email',
  TRUE,
  5,
  600
)
ON CONFLICT (channel_key) DO UPDATE SET
  endpoint_url = EXCLUDED.endpoint_url,
  enabled = EXCLUDED.enabled,
  max_attempts = EXCLUDED.max_attempts,
  token_ttl_seconds = EXCLUDED.token_ttl_seconds,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION private.sync_operations_incident(
  p_job_key TEXT,
  p_incident_type TEXT,
  p_is_active BOOLEAN,
  p_severity TEXT,
  p_summary TEXT,
  p_evidence JSONB,
  p_latest_run_id BIGINT,
  p_recovery_threshold INTEGER,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_incident public.operations_incidents%ROWTYPE;
  v_incident_id UUID;
  v_opened INTEGER := 0;
  v_resolved INTEGER := 0;
BEGIN
  SELECT * INTO v_incident
  FROM public.operations_incidents incident
  WHERE incident.job_key = p_job_key
    AND incident.incident_type = p_incident_type
    AND incident.status = 'open'
  FOR UPDATE;

  IF p_is_active THEN
    IF FOUND THEN
      UPDATE public.operations_incidents
      SET severity = p_severity,
          summary = LEFT(p_summary, 500),
          last_detected_at = p_now,
          occurrence_count = occurrence_count + 1,
          healthy_scan_count = 0,
          latest_run_id = p_latest_run_id,
          evidence = COALESCE(p_evidence, '{}'::JSONB),
          updated_at = p_now
      WHERE id = v_incident.id;
      v_incident_id := v_incident.id;
    ELSE
      INSERT INTO public.operations_incidents(
        job_key,
        incident_type,
        severity,
        status,
        summary,
        first_detected_at,
        last_detected_at,
        occurrence_count,
        healthy_scan_count,
        opened_run_id,
        latest_run_id,
        evidence,
        created_at,
        updated_at
      ) VALUES (
        p_job_key,
        p_incident_type,
        p_severity,
        'open',
        LEFT(p_summary, 500),
        p_now,
        p_now,
        1,
        0,
        p_latest_run_id,
        p_latest_run_id,
        COALESCE(p_evidence, '{}'::JSONB),
        p_now,
        p_now
      ) RETURNING id INTO v_incident_id;

      INSERT INTO public.operations_alert_deliveries(
        incident_id, event_type, delivery_mode, status, next_attempt_at
      ) VALUES (
        v_incident_id, 'opened', 'email', 'pending', p_now
      ) ON CONFLICT DO NOTHING;
      v_opened := 1;
    END IF;
  ELSIF FOUND THEN
    IF v_incident.healthy_scan_count + 1 >= GREATEST(COALESCE(p_recovery_threshold, 2), 1) THEN
      UPDATE public.operations_incidents
      SET status = 'resolved',
          healthy_scan_count = v_incident.healthy_scan_count + 1,
          resolved_at = p_now,
          updated_at = p_now
      WHERE id = v_incident.id;

      INSERT INTO public.operations_alert_deliveries(
        incident_id, event_type, delivery_mode, status, next_attempt_at
      ) VALUES (
        v_incident.id, 'resolved', 'email', 'pending', p_now
      ) ON CONFLICT DO NOTHING;
      v_incident_id := v_incident.id;
      v_resolved := 1;
    ELSE
      UPDATE public.operations_incidents
      SET healthy_scan_count = healthy_scan_count + 1,
          updated_at = p_now
      WHERE id = v_incident.id;
      v_incident_id := v_incident.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'incident_id', v_incident_id,
    'opened', v_opened,
    'resolved', v_resolved
  );
END;
$$;

ALTER TABLE public.operations_monitor_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations_monitor_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations_alert_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations_alert_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.operations_monitor_policies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.operations_incidents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.operations_monitor_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.operations_alert_channels FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.operations_alert_deliveries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reject_operations_monitor_run_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sync_operations_incident(TEXT, TEXT, BOOLEAN, TEXT, TEXT, JSONB, BIGINT, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

COMMIT;
