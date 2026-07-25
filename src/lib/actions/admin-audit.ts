'use server'

import { reportAdminSecurityEvent, runAdminRpc } from '@/lib/actions/admin-access'
import {
  ADMIN_AUDIT_EVENT_KINDS,
  type AdminAuditCursor,
  type AdminAuditDetail,
  type AdminAuditEvent,
  type AdminAuditEventKind,
  type AdminAuditFilters,
} from '@/lib/admin-audit'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CORRELATION_PATTERN = /^[a-z0-9_:-]{1,200}$/
const BIGINT_PATTERN = /^[0-9]{1,19}$/
const auditKindSet = new Set<string>(ADMIN_AUDIT_EVENT_KINDS)

function normalizeUuid(value?: string | null) {
  const normalized = (value || '').trim()
  if (!normalized) return null
  return UUID_PATTERN.test(normalized) ? normalized.toLowerCase() : undefined
}

function normalizeTimestamp(value?: string | null) {
  const normalized = (value || '').trim()
  if (!normalized) return null
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function parseAuditEvent(raw: unknown): AdminAuditEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const eventKind = typeof row.event_kind === 'string' && auditKindSet.has(row.event_kind)
    ? row.event_kind as AdminAuditEventKind
    : null

  if (
    !eventKind
    || typeof row.event_id !== 'string'
    || typeof row.sort_key !== 'string'
    || typeof row.correlation_id !== 'string'
    || typeof row.group_id !== 'string'
    || typeof row.actor_label !== 'string'
    || typeof row.subject_type !== 'string'
    || typeof row.subject_label !== 'string'
    || typeof row.action !== 'string'
    || typeof row.summary !== 'string'
    || typeof row.source_href !== 'string'
    || typeof row.created_at !== 'string'
  ) return null

  return {
    eventKind,
    eventId: row.event_id,
    sortKey: row.sort_key,
    correlationId: row.correlation_id,
    groupId: row.group_id,
    actorId: typeof row.actor_id === 'string' ? row.actor_id : null,
    actorLabel: row.actor_label,
    subjectType: row.subject_type,
    subjectId: typeof row.subject_id === 'string' ? row.subject_id : null,
    subjectLabel: row.subject_label,
    action: row.action,
    reasonCode: typeof row.reason_code === 'string' ? row.reason_code : null,
    summary: row.summary,
    sourceHref: row.source_href.startsWith('/admin/') ? row.source_href : '/admin/audit',
    createdAt: row.created_at,
  }
}

export async function listAdminAuditEvents(filters: AdminAuditFilters = {}): Promise<{
  data: AdminAuditEvent[]
  nextCursor: AdminAuditCursor | null
  error?: string
}> {
  try {
    const eventKinds = Array.from(new Set(filters.eventKinds || []))
      .filter((kind): kind is AdminAuditEventKind => auditKindSet.has(kind))
    const actorId = normalizeUuid(filters.actorId)
    const subjectId = normalizeUuid(filters.subjectId)
    const correlationId = (filters.correlationId || '').trim().toLowerCase() || null
    const from = normalizeTimestamp(filters.from)
    const to = normalizeTimestamp(filters.to)
    const cursorAt = normalizeTimestamp(filters.cursor?.createdAt)
    const cursorKey = filters.cursor?.sortKey?.trim() || null
    const limit = Math.min(Math.max(Math.trunc(filters.limit || 50), 1), 100)

    if (actorId === undefined || subjectId === undefined) {
      await reportAdminSecurityEvent({ eventKind: 'suspicious_query', actionKey: 'list_admin_audit_events_v2', resourceKey: 'audit_view', failureCode: 'invalid_uuid_filter', routeKey: '/admin/audit' })
      return { data: [], nextCursor: null, error: '행위자 또는 대상 UUID 형식이 올바르지 않습니다.' }
    }
    if (correlationId && !CORRELATION_PATTERN.test(correlationId)) {
      await reportAdminSecurityEvent({ eventKind: 'suspicious_query', actionKey: 'list_admin_audit_events_v2', resourceKey: 'audit_view', failureCode: 'invalid_correlation', routeKey: '/admin/audit' })
      return { data: [], nextCursor: null, error: '상관관계 ID 형식이 올바르지 않습니다.' }
    }
    if (from === undefined || to === undefined || cursorAt === undefined) {
      await reportAdminSecurityEvent({ eventKind: 'suspicious_query', actionKey: 'list_admin_audit_events_v2', resourceKey: 'audit_view', failureCode: 'invalid_timestamp', routeKey: '/admin/audit' })
      return { data: [], nextCursor: null, error: '감사 조회 시각 형식이 올바르지 않습니다.' }
    }
    if ((cursorAt === null) !== (cursorKey === null) || (cursorKey && cursorKey.length > 300)) {
      await reportAdminSecurityEvent({ eventKind: 'suspicious_query', actionKey: 'list_admin_audit_events_v2', resourceKey: 'audit_view', failureCode: 'invalid_cursor', routeKey: '/admin/audit' })
      return { data: [], nextCursor: null, error: '감사 조회 cursor 형식이 올바르지 않습니다.' }
    }
    if (from && to && from >= to) {
      await reportAdminSecurityEvent({ eventKind: 'validation_failed', actionKey: 'list_admin_audit_events_v2', resourceKey: 'audit_view', failureCode: 'invalid_time_range', routeKey: '/admin/audit' })
      return { data: [], nextCursor: null, error: '조회 시작 시각은 종료 시각보다 빨라야 합니다.' }
    }

    const { data, error } = await runAdminRpc('audit_view', 'list_admin_audit_events_v2', {
      p_event_kinds: eventKinds.length ? eventKinds : null,
      p_actor_id: actorId,
      p_subject_id: subjectId,
      p_correlation_id: correlationId,
      p_from: from,
      p_to: to,
      p_cursor_created_at: cursorAt,
      p_cursor_sort_key: cursorKey,
      p_limit: limit,
    }, {
      routeKey: '/admin/audit',
      resourceKey: 'audit_view',
    })

    if (error) return { data: [], nextCursor: null, error: error.message }
    const events = (Array.isArray(data) ? data : []).flatMap((row) => {
      const parsed = parseAuditEvent(row)
      return parsed ? [parsed] : []
    })
    const last = events.at(-1)
    return {
      data: events,
      nextCursor: events.length === limit && last
        ? { createdAt: last.createdAt, sortKey: last.sortKey }
        : null,
    }
  } catch (error) {
    return { data: [], nextCursor: null, error: error instanceof Error ? error.message : '운영 감사 기록을 불러오지 못했습니다.' }
  }
}

export async function getAdminAuditEventDetail(eventKind: string, eventId: string): Promise<{
  data: AdminAuditDetail | null
  error?: string
}> {
  try {
    if (!auditKindSet.has(eventKind)) {
      await reportAdminSecurityEvent({ eventKind: 'suspicious_query', actionKey: 'get_admin_audit_event_detail', resourceKey: 'audit_view', failureCode: 'invalid_event_kind', routeKey: '/admin/audit' })
      return { data: null, error: '지원하지 않는 감사 이벤트 종류입니다.' }
    }

    const normalizedId = eventId.trim()
    const validId = eventKind === 'moderation_review'
      ? UUID_PATTERN.test(normalizedId)
      : BIGINT_PATTERN.test(normalizedId)
    if (!validId) {
      await reportAdminSecurityEvent({ eventKind: 'suspicious_query', actionKey: 'get_admin_audit_event_detail', resourceKey: 'audit_view', failureCode: 'invalid_event_id', routeKey: '/admin/audit', subjectType: 'audit_event' })
      return { data: null, error: '감사 이벤트 ID 형식이 올바르지 않습니다.' }
    }

    const { data, error } = await runAdminRpc('audit_view', 'get_admin_audit_event_detail', {
      p_event_kind: eventKind,
      p_event_id: normalizedId,
    }, {
      routeKey: '/admin/audit',
      resourceKey: 'audit_view',
      subjectType: 'audit_event',
      subjectRef: normalizedId,
    })
    if (error) return { data: null, error: error.message }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { data: null, error: '감사 이벤트 상세 응답이 올바르지 않습니다.' }
    }

    const value = data as Record<string, unknown>
    const event = parseAuditEvent(value.event)
    if (!event) return { data: null, error: '감사 이벤트 상세 응답이 올바르지 않습니다.' }
    const evidence = value.evidence && typeof value.evidence === 'object' && !Array.isArray(value.evidence)
      ? value.evidence as Record<string, unknown>
      : {}
    const sensitiveEvidence = value.sensitive_evidence && typeof value.sensitive_evidence === 'object' && !Array.isArray(value.sensitive_evidence)
      ? value.sensitive_evidence as Record<string, unknown>
      : null
    const relatedEvents = (Array.isArray(value.related_events) ? value.related_events : []).flatMap((row) => {
      const parsed = parseAuditEvent(row)
      return parsed ? [parsed] : []
    })

    return {
      data: {
        event,
        evidence,
        sensitiveEvidence,
        relatedEvents,
        canViewSensitive: value.can_view_sensitive === true,
      },
    }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : '운영 감사 상세를 불러오지 못했습니다.' }
  }
}
