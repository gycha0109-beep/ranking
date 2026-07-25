BEGIN;

CREATE TABLE public.admin_security_event_buckets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket_started_at TIMESTAMPTZ NOT NULL,
  actor_id UUID NOT NULL,
  actor_role_level TEXT NOT NULL CHECK (actor_role_level IN ('none', 'moderator', 'admin', 'super_admin')),
  event_kind TEXT NOT NULL CHECK (event_kind IN ('permission_denied', 'validation_failed', 'conflict', 'command_failed', 'suspicious_query')),
  action_key TEXT NOT NULL,
  resource_key TEXT NOT NULL,
  failure_code TEXT NOT NULL,
  route_key TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  sample_subject_ref TEXT NOT NULL,
  last_subject_ref TEXT NOT NULL,
  source_trust TEXT NOT NULL DEFAULT 'authenticated_self_report' CHECK (source_trust = 'authenticated_self_report'),
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_count BETWEEN 1 AND 2147483647),
  CONSTRAINT admin_security_event_buckets_time_order CHECK (
    first_seen_at >= bucket_started_at
    AND first_seen_at < bucket_started_at + INTERVAL '5 minutes'
    AND last_seen_at >= first_seen_at
  ),
  CONSTRAINT admin_security_event_buckets_action_shape CHECK (action_key ~ '^[a-z0-9_.-]{1,80}$'),
  CONSTRAINT admin_security_event_buckets_resource_shape CHECK (resource_key ~ '^[a-z0-9_.-]{1,80}$'),
  CONSTRAINT admin_security_event_buckets_failure_shape CHECK (failure_code ~ '^[a-z0-9_.-]{1,80}$'),
  CONSTRAINT admin_security_event_buckets_route_shape CHECK (route_key ~ '^/admin(?:/[a-z0-9-]+){0,4}$'),
  CONSTRAINT admin_security_event_buckets_subject_type_shape CHECK (subject_type ~ '^[a-z0-9_.-]{1,40}$'),
  CONSTRAINT admin_security_event_buckets_sample_ref_shape CHECK (
    sample_subject_ref = 'none'
    OR sample_subject_ref ~ '^[0-9]{1,19}$'
    OR sample_subject_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT admin_security_event_buckets_last_ref_shape CHECK (
    last_subject_ref = 'none'
    OR last_subject_ref ~ '^[0-9]{1,19}$'
    OR last_subject_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT admin_security_event_buckets_aggregate_key UNIQUE (
    bucket_started_at,
    actor_id,
    event_kind,
    action_key,
    resource_key,
    failure_code,
    route_key,
    subject_type
  )
);

CREATE INDEX idx_admin_security_events_last_seen
  ON public.admin_security_event_buckets(last_seen_at DESC, id DESC);
CREATE INDEX idx_admin_security_events_kind_last_seen
  ON public.admin_security_event_buckets(event_kind, last_seen_at DESC, id DESC);
CREATE INDEX idx_admin_security_events_actor_last_seen
  ON public.admin_security_event_buckets(actor_id, last_seen_at DESC, id DESC);
CREATE INDEX idx_admin_security_events_action_last_seen
  ON public.admin_security_event_buckets(action_key, last_seen_at DESC, id DESC);

ALTER TABLE public.admin_security_event_buckets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_security_event_buckets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.admin_security_event_buckets_id_seq FROM PUBLIC, anon, authenticated;

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
    'audit_sensitive_view',
    'security_event_view'
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
      (14, 'audit_sensitive_view'),
      (15, 'security_event_view')
  ) AS capabilities(ord, capability)
  WHERE private.has_admin_capability(v_user_id, capability);

  RETURN jsonb_build_object(
    'role_level', v_level,
    'capabilities', v_capabilities
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.classify_admin_security_event(
  p_event_kind TEXT,
  p_action_key TEXT,
  p_failure_code TEXT,
  p_occurrence_count INTEGER
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT CASE
    WHEN p_action_key = 'event_overflow' OR p_failure_code = 'distinct_bucket_limit' THEN 'high'
    WHEN p_event_kind = 'permission_denied' AND p_occurrence_count >= 10 THEN 'high'
    WHEN p_event_kind = 'suspicious_query' AND p_occurrence_count >= 10 THEN 'high'
    WHEN p_event_kind = 'command_failed' AND p_occurrence_count >= 20 THEN 'high'
    WHEN p_occurrence_count >= 5 THEN 'medium'
    WHEN p_event_kind IN ('permission_denied', 'conflict', 'command_failed') THEN 'medium'
    ELSE 'low'
  END;
$$;

CREATE OR REPLACE FUNCTION private.record_admin_security_event(
  p_actor_id UUID,
  p_event_kind TEXT,
  p_action_key TEXT,
  p_resource_key TEXT,
  p_failure_code TEXT,
  p_route_key TEXT,
  p_subject_type TEXT DEFAULT 'none',
  p_subject_ref TEXT DEFAULT 'none'
)
RETURNS BIGINT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_hour_started_at TIMESTAMPTZ;
  v_bucket_started_at TIMESTAMPTZ;
  v_event_kind TEXT := LOWER(BTRIM(COALESCE(p_event_kind, '')));
  v_action_key TEXT := LOWER(BTRIM(COALESCE(p_action_key, '')));
  v_resource_key TEXT := LOWER(BTRIM(COALESCE(p_resource_key, '')));
  v_failure_code TEXT := LOWER(BTRIM(COALESCE(p_failure_code, '')));
  v_route_key TEXT := LOWER(BTRIM(COALESCE(p_route_key, '')));
  v_subject_type TEXT := LOWER(BTRIM(COALESCE(NULLIF(p_subject_type, ''), 'none')));
  v_subject_ref TEXT := LOWER(BTRIM(COALESCE(NULLIF(p_subject_ref, ''), 'none')));
  v_actor_role_level TEXT;
  v_existing_id BIGINT;
  v_distinct_count INTEGER;
  v_id BIGINT;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION '인증된 사용자만 보안 이벤트를 기록할 수 있습니다.' USING ERRCODE = '42501';
  END IF;

  IF v_event_kind NOT IN ('permission_denied', 'validation_failed', 'conflict', 'command_failed', 'suspicious_query') THEN
    RAISE EXCEPTION '지원하지 않는 보안 이벤트 종류입니다.' USING ERRCODE = '22023';
  END IF;
  IF v_action_key !~ '^[a-z0-9_.-]{1,80}$' THEN
    RAISE EXCEPTION '보안 이벤트 action key 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;
  IF v_resource_key !~ '^[a-z0-9_.-]{1,80}$' THEN
    RAISE EXCEPTION '보안 이벤트 resource key 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;
  IF v_failure_code !~ '^[a-z0-9_.-]{1,80}$' THEN
    RAISE EXCEPTION '보안 이벤트 failure code 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;
  IF v_route_key !~ '^/admin(?:/[a-z0-9-]+){0,4}$' OR LENGTH(v_route_key) > 120 THEN
    RAISE EXCEPTION '보안 이벤트 route key 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;
  IF v_subject_type !~ '^[a-z0-9_.-]{1,40}$' THEN
    RAISE EXCEPTION '보안 이벤트 subject type 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;
  IF v_subject_ref <> 'none'
     AND v_subject_ref !~ '^[0-9]{1,19}$'
     AND v_subject_ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION '보안 이벤트 subject ref 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  v_hour_started_at := date_trunc('hour', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_bucket_started_at := date_bin(
    INTERVAL '5 minutes',
    v_now,
    TIMESTAMPTZ '2000-01-01 00:00:00+00'
  );
  v_actor_role_level := private.get_admin_role_level(p_actor_id);

  PERFORM pg_advisory_xact_lock(
    hashtextextended('admin-security:' || p_actor_id::TEXT || ':' || v_hour_started_at::TEXT, 0)
  );

  SELECT bucket.id
  INTO v_existing_id
  FROM public.admin_security_event_buckets bucket
  WHERE bucket.bucket_started_at = v_bucket_started_at
    AND bucket.actor_id = p_actor_id
    AND bucket.event_kind = v_event_kind
    AND bucket.action_key = v_action_key
    AND bucket.resource_key = v_resource_key
    AND bucket.failure_code = v_failure_code
    AND bucket.route_key = v_route_key
    AND bucket.subject_type = v_subject_type;

  IF v_existing_id IS NULL THEN
    SELECT COUNT(*)::INTEGER
    INTO v_distinct_count
    FROM public.admin_security_event_buckets bucket
    WHERE bucket.actor_id = p_actor_id
      AND bucket.bucket_started_at >= v_hour_started_at
      AND bucket.bucket_started_at < v_hour_started_at + INTERVAL '1 hour';

    IF v_distinct_count >= 60 THEN
      v_event_kind := 'suspicious_query';
      v_action_key := 'event_overflow';
      v_resource_key := 'security_event_reporter';
      v_failure_code := 'distinct_bucket_limit';
      v_route_key := '/admin/security-events';
      v_subject_type := 'none';
      v_subject_ref := 'none';
    END IF;
  END IF;

  INSERT INTO public.admin_security_event_buckets(
    bucket_started_at,
    actor_id,
    actor_role_level,
    event_kind,
    action_key,
    resource_key,
    failure_code,
    route_key,
    subject_type,
    sample_subject_ref,
    last_subject_ref,
    first_seen_at,
    last_seen_at,
    occurrence_count
  ) VALUES (
    v_bucket_started_at,
    p_actor_id,
    v_actor_role_level,
    v_event_kind,
    v_action_key,
    v_resource_key,
    v_failure_code,
    v_route_key,
    v_subject_type,
    v_subject_ref,
    v_subject_ref,
    v_now,
    v_now,
    1
  )
  ON CONFLICT ON CONSTRAINT admin_security_event_buckets_aggregate_key
  DO UPDATE SET
    last_seen_at = EXCLUDED.last_seen_at,
    last_subject_ref = EXCLUDED.last_subject_ref,
    occurrence_count = LEAST(public.admin_security_event_buckets.occurrence_count + 1, 2147483647)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_admin_security_event(
  p_event_kind TEXT,
  p_action_key TEXT,
  p_resource_key TEXT,
  p_failure_code TEXT,
  p_route_key TEXT,
  p_subject_type TEXT DEFAULT 'none',
  p_subject_ref TEXT DEFAULT 'none'
)
RETURNS BIGINT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = auth, private, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  RETURN private.record_admin_security_event(
    v_actor_id,
    p_event_kind,
    p_action_key,
    p_resource_key,
    p_failure_code,
    p_route_key,
    p_subject_type,
    p_subject_ref
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.list_admin_security_event_stream(
  p_event_kinds TEXT[] DEFAULT NULL,
  p_risk_levels TEXT[] DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_action_key TEXT DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_min_occurrence INTEGER DEFAULT 1,
  p_cursor_last_seen_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id BIGINT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  id BIGINT,
  bucket_started_at TIMESTAMPTZ,
  actor_id UUID,
  actor_label TEXT,
  actor_role_level TEXT,
  event_kind TEXT,
  action_key TEXT,
  resource_key TEXT,
  failure_code TEXT,
  route_key TEXT,
  subject_type TEXT,
  sample_subject_ref TEXT,
  last_subject_ref TEXT,
  source_trust TEXT,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  occurrence_count INTEGER,
  risk_level TEXT,
  is_repeated BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  WITH base AS (
    SELECT
      bucket.*,
      COALESCE(profile.display_name, bucket.actor_id::TEXT) AS actor_label,
      private.classify_admin_security_event(
        bucket.event_kind,
        bucket.action_key,
        bucket.failure_code,
        bucket.occurrence_count
      ) AS risk_level
    FROM public.admin_security_event_buckets bucket
    LEFT JOIN public.profiles profile ON profile.id = bucket.actor_id
    WHERE (p_event_kinds IS NULL OR bucket.event_kind = ANY(p_event_kinds))
      AND (p_actor_id IS NULL OR bucket.actor_id = p_actor_id)
      AND (p_action_key IS NULL OR bucket.action_key = p_action_key)
      AND (p_from IS NULL OR bucket.last_seen_at >= p_from)
      AND (p_to IS NULL OR bucket.last_seen_at < p_to)
      AND bucket.occurrence_count >= p_min_occurrence
      AND (
        p_cursor_last_seen_at IS NULL
        OR (bucket.last_seen_at, bucket.id) < (p_cursor_last_seen_at, p_cursor_id)
      )
  ), classified AS (
    SELECT *
    FROM base
    WHERE p_risk_levels IS NULL OR base.risk_level = ANY(p_risk_levels)
  )
  SELECT
    classified.id,
    classified.bucket_started_at,
    classified.actor_id,
    classified.actor_label,
    classified.actor_role_level,
    classified.event_kind,
    classified.action_key,
    classified.resource_key,
    classified.failure_code,
    classified.route_key,
    classified.subject_type,
    classified.sample_subject_ref,
    classified.last_subject_ref,
    classified.source_trust,
    classified.first_seen_at,
    classified.last_seen_at,
    classified.occurrence_count,
    classified.risk_level,
    classified.occurrence_count >= 5 AS is_repeated
  FROM classified
  ORDER BY classified.last_seen_at DESC, classified.id DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.list_admin_security_events(
  p_event_kinds TEXT[] DEFAULT NULL,
  p_risk_levels TEXT[] DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_action_key TEXT DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_min_occurrence INTEGER DEFAULT 1,
  p_cursor_last_seen_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id BIGINT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  id BIGINT,
  bucket_started_at TIMESTAMPTZ,
  actor_id UUID,
  actor_label TEXT,
  actor_role_level TEXT,
  event_kind TEXT,
  action_key TEXT,
  resource_key TEXT,
  failure_code TEXT,
  route_key TEXT,
  subject_type TEXT,
  sample_subject_ref TEXT,
  last_subject_ref TEXT,
  source_trust TEXT,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  occurrence_count INTEGER,
  risk_level TEXT,
  is_repeated BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = auth, private, pg_temp
AS $$
DECLARE
  v_action_key TEXT := NULLIF(LOWER(BTRIM(COALESCE(p_action_key, ''))), '');
  v_min_occurrence INTEGER := COALESCE(p_min_occurrence, 1);
  v_limit INTEGER := COALESCE(p_limit, 50);
BEGIN
  PERFORM private.assert_admin_capability('security_event_view');

  IF p_event_kinds IS NOT NULL THEN
    IF COALESCE(array_length(p_event_kinds, 1), 0) = 0 OR array_length(p_event_kinds, 1) > 5 THEN
      RAISE EXCEPTION '보안 이벤트 종류 필터 개수가 올바르지 않습니다.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(p_event_kinds) kind
      WHERE kind NOT IN ('permission_denied', 'validation_failed', 'conflict', 'command_failed', 'suspicious_query')
    ) THEN
      RAISE EXCEPTION '지원하지 않는 보안 이벤트 종류입니다.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_risk_levels IS NOT NULL THEN
    IF COALESCE(array_length(p_risk_levels, 1), 0) = 0 OR array_length(p_risk_levels, 1) > 3 THEN
      RAISE EXCEPTION '위험도 필터 개수가 올바르지 않습니다.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(p_risk_levels) risk
      WHERE risk NOT IN ('low', 'medium', 'high')
    ) THEN
      RAISE EXCEPTION '지원하지 않는 위험도입니다.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_action_key IS NOT NULL AND v_action_key !~ '^[a-z0-9_.-]{1,80}$' THEN
    RAISE EXCEPTION 'action key 필터 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from >= p_to THEN
    RAISE EXCEPTION '조회 시작 시각은 종료 시각보다 빨라야 합니다.' USING ERRCODE = '22023';
  END IF;
  IF (p_cursor_last_seen_at IS NULL) <> (p_cursor_id IS NULL) OR COALESCE(p_cursor_id, 1) < 1 THEN
    RAISE EXCEPTION '보안 이벤트 cursor 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;
  IF v_min_occurrence < 1 OR v_min_occurrence > 1000000 THEN
    RAISE EXCEPTION '최소 발생 횟수는 1~1,000,000이어야 합니다.' USING ERRCODE = '22023';
  END IF;
  IF v_limit < 1 OR v_limit > 100 THEN
    RAISE EXCEPTION '조회 개수는 1~100이어야 합니다.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT *
  FROM private.list_admin_security_event_stream(
    p_event_kinds,
    p_risk_levels,
    p_actor_id,
    v_action_key,
    p_from,
    p_to,
    v_min_occurrence,
    p_cursor_last_seen_at,
    p_cursor_id,
    v_limit
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_security_event_overview(p_hours INTEGER DEFAULT 24)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = auth, public, private, pg_temp
AS $$
DECLARE
  v_hours INTEGER := COALESCE(p_hours, 24);
  v_result JSONB;
BEGIN
  PERFORM private.assert_admin_capability('security_event_view');

  IF v_hours < 1 OR v_hours > 168 THEN
    RAISE EXCEPTION 'overview 시간 범위는 1~168시간이어야 합니다.' USING ERRCODE = '22023';
  END IF;

  WITH classified AS (
    SELECT
      bucket.event_kind,
      bucket.occurrence_count,
      private.classify_admin_security_event(
        bucket.event_kind,
        bucket.action_key,
        bucket.failure_code,
        bucket.occurrence_count
      ) AS risk_level
    FROM public.admin_security_event_buckets bucket
    WHERE bucket.last_seen_at >= clock_timestamp() - make_interval(hours => v_hours)
  ), totals AS (
    SELECT
      COALESCE(SUM(occurrence_count), 0)::BIGINT AS total_occurrences,
      COUNT(*)::BIGINT AS total_buckets,
      COUNT(*) FILTER (WHERE risk_level = 'high')::BIGINT AS high_buckets,
      COUNT(*) FILTER (WHERE risk_level = 'medium')::BIGINT AS medium_buckets,
      COUNT(*) FILTER (WHERE risk_level = 'low')::BIGINT AS low_buckets,
      COUNT(*) FILTER (WHERE occurrence_count >= 5)::BIGINT AS repeated_buckets
    FROM classified
  ), kinds AS (
    SELECT COALESCE(jsonb_object_agg(event_kind, occurrences ORDER BY event_kind), '{}'::JSONB) AS by_event_kind
    FROM (
      SELECT event_kind, SUM(occurrence_count)::BIGINT AS occurrences
      FROM classified
      GROUP BY event_kind
    ) grouped
  )
  SELECT jsonb_build_object(
    'hours', v_hours,
    'total_occurrences', totals.total_occurrences,
    'total_buckets', totals.total_buckets,
    'high_buckets', totals.high_buckets,
    'medium_buckets', totals.medium_buckets,
    'low_buckets', totals.low_buckets,
    'repeated_buckets', totals.repeated_buckets,
    'by_event_kind', kinds.by_event_kind
  )
  INTO v_result
  FROM totals CROSS JOIN kinds;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION private.prune_admin_security_event_buckets_batch(p_batch_size INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
  v_batch_size INTEGER := LEAST(GREATEST(COALESCE(p_batch_size, 5000), 1), 10000);
BEGIN
  WITH expired AS (
    SELECT bucket.id
    FROM public.admin_security_event_buckets bucket
    WHERE bucket.last_seen_at < clock_timestamp() - INTERVAL '90 days'
    ORDER BY bucket.last_seen_at, bucket.id
    LIMIT v_batch_size
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.admin_security_event_buckets bucket
  USING expired
  WHERE bucket.id = expired.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

INSERT INTO public.maintenance_job_definitions(
  job_key,
  cron_job_name,
  description,
  schedule,
  batch_size,
  max_batches,
  timeout_ms,
  retention_policy,
  enabled
) VALUES (
  'prune_admin_security_events',
  'ranking-maint-prune-admin-security-events',
  '90일이 지난 운영 보안 이벤트 집계 버킷을 삭제합니다.',
  '0 4 * * *',
  5000,
  10,
  30000,
  'last_seen_at 기준 90일',
  TRUE
)
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
        WHEN 'prune_admin_security_events' THEN
          v_batch_rows := private.prune_admin_security_event_buckets_batch(v_job.batch_size);
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

DO $do$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'ranking-maint-prune-admin-security-events';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'ranking-maint-prune-admin-security-events',
    '0 4 * * *',
    $cmd$SELECT private.run_maintenance_job('prune_admin_security_events', 'cron');$cmd$
  );
END;
$do$;

REVOKE ALL ON FUNCTION private.classify_admin_security_event(TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.record_admin_security_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.list_admin_security_event_stream(TEXT[], TEXT[], UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TIMESTAMPTZ, BIGINT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prune_admin_security_event_buckets_batch(INTEGER) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.record_admin_security_event(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_admin_security_event(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.list_admin_security_events(TEXT[], TEXT[], UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TIMESTAMPTZ, BIGINT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_security_events(TEXT[], TEXT[], UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TIMESTAMPTZ, BIGINT, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.get_admin_security_event_overview(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_security_event_overview(INTEGER) TO authenticated;

COMMIT;