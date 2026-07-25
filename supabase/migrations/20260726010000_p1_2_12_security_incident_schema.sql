BEGIN;

CREATE TABLE public.admin_security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'false_positive')),
  severity TEXT NOT NULL CHECK (severity IN ('medium', 'high', 'critical')),
  source_trust TEXT NOT NULL DEFAULT 'authenticated_self_report' CHECK (source_trust = 'authenticated_self_report'),
  telemetry_actor_id UUID NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('permission_denied', 'validation_failed', 'conflict', 'command_failed', 'suspicious_query')),
  action_key TEXT NOT NULL,
  resource_key TEXT NOT NULL,
  failure_code TEXT NOT NULL,
  route_key TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  first_subject_ref TEXT NOT NULL,
  latest_subject_ref TEXT NOT NULL,
  first_bucket_id BIGINT REFERENCES public.admin_security_event_buckets(id) ON DELETE SET NULL,
  latest_bucket_id BIGINT REFERENCES public.admin_security_event_buckets(id) ON DELETE SET NULL,
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_detected_at TIMESTAMPTZ NOT NULL,
  window_occurrence_count BIGINT NOT NULL CHECK (window_occurrence_count >= 1),
  lifetime_occurrence_count BIGINT NOT NULL CHECK (lifetime_occurrence_count >= 1),
  workflow_version BIGINT NOT NULL DEFAULT 1 CHECK (workflow_version >= 1),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_code TEXT,
  alerted_at TIMESTAMPTZ,
  alert_cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT admin_security_incidents_fingerprint_shape CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT admin_security_incidents_key_shape CHECK (
    action_key ~ '^[a-z0-9_.-]{1,80}$'
    AND resource_key ~ '^[a-z0-9_.-]{1,80}$'
    AND failure_code ~ '^[a-z0-9_.-]{1,80}$'
    AND route_key ~ '^/admin(?:/[a-z0-9-]+){0,4}$'
    AND subject_type ~ '^[a-z0-9_.-]{1,40}$'
  ),
  CONSTRAINT admin_security_incidents_subject_shape CHECK (
    (first_subject_ref = 'none' OR first_subject_ref ~ '^[0-9]{1,19}$' OR first_subject_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
    AND
    (latest_subject_ref = 'none' OR latest_subject_ref ~ '^[0-9]{1,19}$' OR latest_subject_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  ),
  CONSTRAINT admin_security_incidents_time_order CHECK (
    last_detected_at >= first_detected_at
    AND updated_at >= created_at
    AND (alerted_at IS NULL OR alerted_at >= created_at)
    AND (alert_cooldown_until IS NULL OR (alerted_at IS NOT NULL AND alert_cooldown_until >= alerted_at))
  ),
  CONSTRAINT admin_security_incidents_resolution_shape CHECK (
    resolution_code IS NULL OR resolution_code ~ '^[a-z0-9_.-]{1,80}$'
  ),
  CONSTRAINT admin_security_incidents_state_shape CHECK (
    (status = 'open' AND acknowledged_at IS NULL AND acknowledged_by IS NULL AND resolved_at IS NULL AND resolved_by IS NULL AND resolution_code IS NULL)
    OR
    (status = 'acknowledged' AND acknowledged_at IS NOT NULL AND acknowledged_by IS NOT NULL AND resolved_at IS NULL AND resolved_by IS NULL AND resolution_code IS NULL)
    OR
    (status IN ('resolved', 'false_positive') AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL AND resolution_code IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_admin_security_incidents_active_fingerprint ON public.admin_security_incidents(fingerprint) WHERE status IN ('open', 'acknowledged');
CREATE INDEX idx_admin_security_incidents_last_detected ON public.admin_security_incidents(last_detected_at DESC, id DESC);
CREATE INDEX idx_admin_security_incidents_status_last_detected ON public.admin_security_incidents(status, last_detected_at DESC, id DESC);
CREATE INDEX idx_admin_security_incidents_severity_last_detected ON public.admin_security_incidents(severity, last_detected_at DESC, id DESC);
CREATE INDEX idx_admin_security_incidents_assignee_last_detected ON public.admin_security_incidents(assigned_to, last_detected_at DESC, id DESC);
CREATE INDEX idx_admin_security_incidents_actor_last_detected ON public.admin_security_incidents(telemetry_actor_id, last_detected_at DESC, id DESC);
CREATE INDEX idx_admin_security_events_incident_window ON public.admin_security_event_buckets(actor_id,event_kind,action_key,resource_key,failure_code,route_key,subject_type,bucket_started_at DESC);

CREATE TABLE public.admin_security_incident_sources (
  incident_id UUID NOT NULL REFERENCES public.admin_security_incidents(id) ON DELETE CASCADE,
  bucket_id BIGINT NOT NULL REFERENCES public.admin_security_event_buckets(id) ON DELETE CASCADE,
  first_observed_count INTEGER NOT NULL CHECK (first_observed_count >= 1),
  last_observed_count INTEGER NOT NULL CHECK (last_observed_count >= first_observed_count),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (incident_id, bucket_id),
  CONSTRAINT admin_security_incident_sources_time_order CHECK (updated_at >= linked_at)
);
CREATE INDEX idx_admin_security_incident_sources_bucket ON public.admin_security_incident_sources(bucket_id, incident_id);
CREATE INDEX idx_admin_security_incident_sources_incident_updated ON public.admin_security_incident_sources(incident_id, updated_at DESC, bucket_id DESC);

CREATE TABLE public.admin_security_incident_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES public.admin_security_incidents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','signal_updated','severity_escalated','alerted','acknowledged','assigned','resolved','reopened')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_status TEXT CHECK (previous_status IS NULL OR previous_status IN ('open','acknowledged','resolved','false_positive')),
  new_status TEXT CHECK (new_status IS NULL OR new_status IN ('open','acknowledged','resolved','false_positive')),
  previous_assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  new_assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_severity TEXT CHECK (previous_severity IS NULL OR previous_severity IN ('medium','high','critical')),
  new_severity TEXT CHECK (new_severity IS NULL OR new_severity IN ('medium','high','critical')),
  reason_code TEXT,
  note TEXT,
  source_bucket_id BIGINT REFERENCES public.admin_security_event_buckets(id) ON DELETE SET NULL,
  window_occurrence_count BIGINT NOT NULL CHECK (window_occurrence_count >= 1),
  lifetime_occurrence_count BIGINT NOT NULL CHECK (lifetime_occurrence_count >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT admin_security_incident_events_reason_shape CHECK (reason_code IS NULL OR reason_code ~ '^[a-z0-9_.-]{1,80}$'),
  CONSTRAINT admin_security_incident_events_note_length CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 2000)
);
CREATE INDEX idx_admin_security_incident_events_incident_created ON public.admin_security_incident_events(incident_id, created_at DESC, id DESC);
CREATE INDEX idx_admin_security_incident_events_created ON public.admin_security_incident_events(created_at DESC, id DESC);
CREATE INDEX idx_admin_security_incident_events_actor_created ON public.admin_security_incident_events(actor_id, created_at DESC, id DESC);

ALTER TABLE public.admin_security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_security_incident_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_security_incident_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_security_incidents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_security_incident_sources FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_security_incident_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.admin_security_incident_events_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.reject_admin_security_incident_event_mutation() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$ BEGIN RAISE EXCEPTION '보안 사건 이벤트 원장은 수정하거나 삭제할 수 없습니다.' USING ERRCODE = '42501'; END; $$;
CREATE TRIGGER trg_admin_security_incident_events_immutable BEFORE UPDATE OR DELETE ON public.admin_security_incident_events FOR EACH ROW EXECUTE FUNCTION private.reject_admin_security_incident_event_mutation();

CREATE OR REPLACE FUNCTION private.has_admin_capability(p_user_id UUID,p_capability TEXT) RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private, pg_temp AS $$ DECLARE v_level TEXT; v_capability TEXT := LOWER(BTRIM(COALESCE(p_capability, ''))); BEGIN IF p_user_id IS NULL THEN RETURN FALSE; END IF; v_level := private.get_admin_role_level(p_user_id); IF v_capability IN ('admin_console_access','moderation_review') THEN RETURN v_level IN ('moderator','admin','super_admin'); END IF; IF v_capability IN ('report_review','sanction_view','sanction_impose_warning','content_manage','sanction_impose_restriction','appeal_reject','audit_view') THEN RETURN v_level IN ('admin','super_admin'); END IF; IF v_capability IN ('sanction_impose_long_suspension','sanction_revoke','appeal_accept','role_manage','audit_sensitive_view','security_event_view','security_incident_view','security_incident_manage') THEN RETURN v_level = 'super_admin'; END IF; RETURN FALSE; END; $$;

CREATE OR REPLACE FUNCTION public.get_my_admin_access() RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = auth, private, pg_temp AS $$ DECLARE v_user_id UUID := auth.uid(); v_level TEXT; v_capabilities JSONB; BEGIN IF v_user_id IS NULL THEN RETURN jsonb_build_object('role_level','none','capabilities','[]'::JSONB); END IF; v_level := private.get_admin_role_level(v_user_id); SELECT COALESCE(jsonb_agg(capability ORDER BY ord),'[]'::JSONB) INTO v_capabilities FROM (VALUES (1,'admin_console_access'),(2,'moderation_review'),(3,'report_review'),(4,'sanction_view'),(5,'sanction_impose_warning'),(6,'content_manage'),(7,'sanction_impose_restriction'),(8,'appeal_reject'),(9,'audit_view'),(10,'sanction_impose_long_suspension'),(11,'sanction_revoke'),(12,'appeal_accept'),(13,'role_manage'),(14,'audit_sensitive_view'),(15,'security_event_view'),(16,'security_incident_view'),(17,'security_incident_manage')) AS capabilities(ord,capability) WHERE private.has_admin_capability(v_user_id,capability); RETURN jsonb_build_object('role_level',v_level,'capabilities',v_capabilities); END; $$;

CREATE OR REPLACE FUNCTION private.admin_security_incident_fingerprint(p_actor_id UUID,p_event_kind TEXT,p_action_key TEXT,p_resource_key TEXT,p_failure_code TEXT,p_route_key TEXT,p_subject_type TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = extensions, pg_catalog, pg_temp AS $$ SELECT encode(extensions.digest(concat_ws('|',p_actor_id::TEXT,p_event_kind,p_action_key,p_resource_key,p_failure_code,p_route_key,p_subject_type),'sha256'),'hex'); $$;
CREATE OR REPLACE FUNCTION private.admin_security_incident_severity(p_event_kind TEXT,p_action_key TEXT,p_failure_code TEXT,p_window_occurrence_count BIGINT) RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = private, pg_catalog, pg_temp AS $$ SELECT CASE WHEN p_action_key='event_overflow' OR p_failure_code='distinct_bucket_limit' THEN 'critical' WHEN p_event_kind='permission_denied' AND p_window_occurrence_count>=20 THEN 'critical' WHEN p_event_kind='suspicious_query' AND p_window_occurrence_count>=20 THEN 'critical' WHEN p_event_kind='permission_denied' AND p_window_occurrence_count>=10 THEN 'high' WHEN p_event_kind='suspicious_query' AND p_window_occurrence_count>=10 THEN 'high' WHEN p_event_kind='command_failed' AND p_window_occurrence_count>=20 THEN 'high' WHEN p_event_kind IN ('permission_denied','conflict','command_failed') AND p_window_occurrence_count>=5 THEN 'medium' WHEN p_window_occurrence_count>=10 THEN 'medium' ELSE NULL END; $$;
CREATE OR REPLACE FUNCTION private.admin_security_incident_severity_rank(p_severity TEXT) RETURNS INTEGER LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, pg_temp AS $$ SELECT CASE p_severity WHEN 'medium' THEN 1 WHEN 'high' THEN 2 WHEN 'critical' THEN 3 ELSE 0 END; $$;
CREATE OR REPLACE FUNCTION private.admin_security_incident_cooldown(p_severity TEXT) RETURNS INTERVAL LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, pg_temp AS $$ SELECT CASE p_severity WHEN 'critical' THEN INTERVAL '1 hour' WHEN 'high' THEN INTERVAL '6 hours' ELSE INTERVAL '24 hours' END; $$;

REVOKE ALL ON FUNCTION private.reject_admin_security_incident_event_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.admin_security_incident_fingerprint(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.admin_security_incident_severity(TEXT,TEXT,TEXT,BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.admin_security_incident_severity_rank(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.admin_security_incident_cooldown(TEXT) FROM PUBLIC, anon, authenticated;
COMMIT;
