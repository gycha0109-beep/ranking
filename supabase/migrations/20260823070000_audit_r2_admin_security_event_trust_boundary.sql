BEGIN;

ALTER TABLE public.admin_security_event_buckets
  DROP CONSTRAINT admin_security_event_buckets_source_trust_check;

ALTER TABLE public.admin_security_event_buckets
  ADD CONSTRAINT admin_security_event_buckets_source_trust_check
  CHECK (source_trust IN ('authenticated_self_report', 'trusted_server'));

ALTER TABLE public.admin_security_event_buckets
  DROP CONSTRAINT admin_security_event_buckets_aggregate_key;

ALTER TABLE public.admin_security_event_buckets
  ADD CONSTRAINT admin_security_event_buckets_aggregate_key UNIQUE (
    bucket_started_at,
    actor_id,
    event_kind,
    action_key,
    resource_key,
    failure_code,
    route_key,
    subject_type,
    source_trust
  );

CREATE INDEX idx_admin_security_events_trusted_last_seen
  ON public.admin_security_event_buckets(last_seen_at DESC, id DESC)
  WHERE source_trust = 'trusted_server';

CREATE OR REPLACE FUNCTION private.record_admin_security_event_core(
  p_actor_id UUID,
  p_event_kind TEXT,
  p_action_key TEXT,
  p_resource_key TEXT,
  p_failure_code TEXT,
  p_route_key TEXT,
  p_subject_type TEXT DEFAULT 'none',
  p_subject_ref TEXT DEFAULT 'none',
  p_source_trust TEXT DEFAULT 'authenticated_self_report'
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
  v_source_trust TEXT := LOWER(BTRIM(COALESCE(p_source_trust, '')));
  v_actor_role_level TEXT;
  v_existing_id BIGINT;
  v_distinct_count INTEGER;
  v_id BIGINT;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION '인증된 사용자만 보안 이벤트를 기록할 수 있습니다.' USING ERRCODE = '42501';
  END IF;

  IF v_source_trust NOT IN ('authenticated_self_report', 'trusted_server') THEN
    RAISE EXCEPTION '지원하지 않는 보안 이벤트 신뢰 출처입니다.' USING ERRCODE = '22023';
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
    hashtextextended(
      'admin-security:' || p_actor_id::TEXT || ':' || v_source_trust || ':' || v_hour_started_at::TEXT,
      0
    )
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
    AND bucket.subject_type = v_subject_type
    AND bucket.source_trust = v_source_trust;

  IF v_existing_id IS NULL THEN
    SELECT COUNT(*)::INTEGER
    INTO v_distinct_count
    FROM public.admin_security_event_buckets bucket
    WHERE bucket.actor_id = p_actor_id
      AND bucket.source_trust = v_source_trust
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
    source_trust,
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
    v_source_trust,
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
SET search_path = private, pg_temp
AS $$
BEGIN
  RETURN private.record_admin_security_event_core(
    p_actor_id,
    p_event_kind,
    p_action_key,
    p_resource_key,
    p_failure_code,
    p_route_key,
    p_subject_type,
    p_subject_ref,
    'authenticated_self_report'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_trusted_admin_security_event(
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
SET search_path = auth, private, pg_temp
AS $$
BEGIN
  IF session_user <> 'postgres' AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION '신뢰된 서버만 보안 이벤트를 기록할 수 있습니다.' USING ERRCODE = '42501';
  END IF;

  RETURN private.record_admin_security_event_core(
    p_actor_id,
    p_event_kind,
    p_action_key,
    p_resource_key,
    p_failure_code,
    p_route_key,
    p_subject_type,
    p_subject_ref,
    'trusted_server'
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
    WHERE bucket.source_trust = 'trusted_server'
      AND bucket.last_seen_at >= clock_timestamp() - make_interval(hours => v_hours)
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

REVOKE ALL ON FUNCTION private.record_admin_security_event_core(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.record_admin_security_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_trusted_admin_security_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_trusted_admin_security_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

COMMIT;
