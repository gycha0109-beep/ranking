'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdminCapability } from '@/lib/actions/admin-access'
import {
  ADMIN_SECURITY_EVENT_KINDS,
  ADMIN_SECURITY_RISK_LEVELS,
  type AdminSecurityEvent,
  type AdminSecurityEventCursor,
  type AdminSecurityEventFilters,
  type AdminSecurityEventKind,
  type AdminSecurityOverview,
  type AdminSecurityRiskLevel,
} from '@/lib/admin-security-events'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const KEY_PATTERN = /^[a-z0-9_.-]{1,80}$/
const kindSet = new Set<string>(ADMIN_SECURITY_EVENT_KINDS)
const riskSet = new Set<string>(ADMIN_SECURITY_RISK_LEVELS)

function normalizeTimestamp(value?: string | null) {
  const normalized = (value || '').trim()
  if (!normalized) return null
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function parseEvent(raw: unknown): AdminSecurityEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (
    typeof row.id !== 'number'
    || typeof row.bucket_started_at !== 'string'
    || typeof row.actor_id !== 'string'
    || typeof row.actor_label !== 'string'
    || typeof row.actor_role_level !== 'string'
    || typeof row.event_kind !== 'string'
    || !kindSet.has(row.event_kind)
    || typeof row.action_key !== 'string'
    || typeof row.resource_key !== 'string'
    || typeof row.failure_code !== 'string'
    || typeof row.route_key !== 'string'
    || typeof row.subject_type !== 'string'
    || typeof row.sample_subject_ref !== 'string'
    || typeof row.last_subject_ref !== 'string'
    || typeof row.source_trust !== 'string'
    || typeof row.first_seen_at !== 'string'
    || typeof row.last_seen_at !== 'string'
    || typeof row.occurrence_count !== 'number'
    || typeof row.risk_level !== 'string'
    || !riskSet.has(row.risk_level)
  ) return null

  return {
    id: row.id,
    bucketStartedAt: row.bucket_started_at,
    actorId: row.actor_id,
    actorLabel: row.actor_label,
    actorRoleLevel: row.actor_role_level,
    eventKind: row.event_kind as AdminSecurityEventKind,
    actionKey: row.action_key,
    resourceKey: row.resource_key,
    failureCode: row.failure_code,
    routeKey: row.route_key,
    subjectType: row.subject_type,
    sampleSubjectRef: row.sample_subject_ref,
    lastSubjectRef: row.last_subject_ref,
    sourceTrust: row.source_trust,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    occurrenceCount: row.occurrence_count,
    riskLevel: row.risk_level as AdminSecurityRiskLevel,
    isRepeated: row.is_repeated === true,
  }
}

export async function recordAdminSecurityEvent(input: {
  eventKind: AdminSecurityEventKind
  actionKey: string
  resourceKey: string
  failureCode: string
  routeKey: string
  subjectType?: string
  subjectRef?: string
}) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.rpc('record_admin_security_event', {
      p_event_kind: input.eventKind,
      p_action_key: input.actionKey,
      p_resource_key: input.resourceKey,
      p_failure_code: input.failureCode,
      p_route_key: input.routeKey,
      p_subject_type: input.subjectType || 'none',
      p_subject_ref: input.subjectRef || 'none',
    })
  } catch {
    // Telemetry must never replace the original operator-facing error.
  }
}

export async function listAdminSecurityEvents(filters: AdminSecurityEventFilters = {}): Promise<{
  data: AdminSecurityEvent[]
  nextCursor: AdminSecurityEventCursor | null
  error?: string
}> {
  try {
    const eventKinds = Array.from(new Set(filters.eventKinds || []))
      .filter((kind): kind is AdminSecurityEventKind => kindSet.has(kind))
    const riskLevels = Array.from(new Set(filters.riskLevels || []))
      .filter((risk): risk is AdminSecurityRiskLevel => riskSet.has(risk))
    const actorId = (filters.actorId || '').trim().toLowerCase() || null
    const actionKey = (filters.actionKey || '').trim().toLowerCase() || null
    const from = normalizeTimestamp(filters.from)
    const to = normalizeTimestamp(filters.to)
    const cursorAt = normalizeTimestamp(filters.cursor?.lastSeenAt)
    const cursorId = filters.cursor?.id ?? null
    const minOccurrence = Math.min(Math.max(filters.minOccurrence || 1, 1), 1_000_000)
    const limit = Math.min(Math.max(filters.limit || 50, 1), 100)

    if (actorId && !UUID_PATTERN.test(actorId)) return { data: [], nextCursor: null, error: '행위자 UUID 형식이 올바르지 않습니다.' }
    if (actionKey && !KEY_PATTERN.test(actionKey)) return { data: [], nextCursor: null, error: 'Action key 형식이 올바르지 않습니다.' }
    if (from === undefined || to === undefined || cursorAt === undefined) return { data: [], nextCursor: null, error: '조회 시각 형식이 올바르지 않습니다.' }
    if ((cursorAt === null) !== (cursorId === null) || (cursorId !== null && (!Number.isSafeInteger(cursorId) || cursorId < 1))) {
      return { data: [], nextCursor: null, error: '보안 이벤트 cursor 형식이 올바르지 않습니다.' }
    }
    if (from && to && from >= to) return { data: [], nextCursor: null, error: '조회 시작 시각은 종료 시각보다 빨라야 합니다.' }

    const supabase = await requireAdminCapability('security_event_view', {
      actionKey: 'security_event_list',
      resourceKey: 'admin_security_events',
      routeKey: '/admin/security-events',
    })
    const { data, error } = await supabase.rpc('list_admin_security_events', {
      p_event_kinds: eventKinds.length ? eventKinds : null,
      p_risk_levels: riskLevels.length ? riskLevels : null,
      p_actor_id: actorId,
      p_action_key: actionKey,
      p_from: from,
      p_to: to,
      p_min_occurrence: minOccurrence,
      p_cursor_last_seen_at: cursorAt,
      p_cursor_id: cursorId,
      p_limit: limit,
    })

    if (error) return { data: [], nextCursor: null, error: error.message }
    const events = (Array.isArray(data) ? data : []).flatMap((row) => {
      const event = parseEvent(row)
      return event ? [event] : []
    })
    const last = events.at(-1)
    return {
      data: events,
      nextCursor: events.length === limit && last ? { lastSeenAt: last.lastSeenAt, id: last.id } : null,
    }
  } catch (error) {
    return { data: [], nextCursor: null, error: error instanceof Error ? error.message : '보안 이벤트를 불러오지 못했습니다.' }
  }
}

export async function getAdminSecurityEventOverview(hours = 24): Promise<{
  data: AdminSecurityOverview | null
  error?: string
}> {
  try {
    const safeHours = Math.min(Math.max(Math.trunc(hours), 1), 168)
    const supabase = await requireAdminCapability('security_event_view', {
      actionKey: 'security_event_overview',
      resourceKey: 'admin_security_events',
      routeKey: '/admin/security-events',
    })
    const { data, error } = await supabase.rpc('get_admin_security_event_overview', { p_hours: safeHours })
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
      return { data: null, error: error?.message || '보안 이벤트 요약 응답이 올바르지 않습니다.' }
    }
    const row = data as Record<string, unknown>
    return {
      data: {
        hours: Number(row.hours || safeHours),
        totalOccurrences: Number(row.total_occurrences || 0),
        totalBuckets: Number(row.total_buckets || 0),
        highBuckets: Number(row.high_buckets || 0),
        mediumBuckets: Number(row.medium_buckets || 0),
        lowBuckets: Number(row.low_buckets || 0),
        repeatedBuckets: Number(row.repeated_buckets || 0),
        byEventKind: row.by_event_kind && typeof row.by_event_kind === 'object' && !Array.isArray(row.by_event_kind)
          ? row.by_event_kind as Record<string, number>
          : {},
      },
    }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : '보안 이벤트 요약을 불러오지 못했습니다.' }
  }
}
