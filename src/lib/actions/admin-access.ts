'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type AdminRoleLevel = 'none' | 'moderator' | 'admin' | 'super_admin'

export type AdminAccess = {
  roleLevel: AdminRoleLevel
  capabilities: string[]
}

const ADMIN_AUDIT_EVENT_KINDS = [
  'role_change',
  'moderation_review',
  'comment_report_decision',
  'sanction_event',
  'appeal_decision',
  'maintenance_job',
  'sponsorship_change',
] as const

export type AdminAuditEventKind = typeof ADMIN_AUDIT_EVENT_KINDS[number]

export type AdminAuditEvent = {
  eventKind: AdminAuditEventKind
  eventId: string
  sortKey: string
  correlationId: string
  groupId: string
  actorId: string | null
  actorLabel: string
  subjectType: string
  subjectId: string | null
  subjectLabel: string
  action: string
  reasonCode: string | null
  summary: string
  sourceHref: string
  createdAt: string
}

export type AdminAuditCursor = {
  createdAt: string
  sortKey: string
}

export type AdminAuditFilters = {
  eventKinds?: string[]
  actorId?: string | null
  subjectId?: string | null
  correlationId?: string | null
  from?: string | null
  to?: string | null
  cursor?: AdminAuditCursor | null
  limit?: number
}

export type AdminAuditDetail = {
  event: AdminAuditEvent
  evidence: Record<string, unknown>
  sensitiveEvidence: Record<string, unknown> | null
  relatedEvents: AdminAuditEvent[]
  canViewSensitive: boolean
}

export type AdminSecurityEventKind =
  | 'permission_denied'
  | 'validation_failed'
  | 'conflict'
  | 'command_failed'
  | 'suspicious_query'

export type AdminSecurityEventContext = {
  eventKind?: AdminSecurityEventKind
  actionKey?: string
  resourceKey?: string
  failureCode?: string
  routeKey?: string
  subjectType?: string
  subjectRef?: string | null
}

export type AdminRpcResult = {
  data: unknown
  error: { code?: string; message: string } | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CORRELATION_PATTERN = /^[a-z0-9_:-]{1,200}$/
const BIGINT_PATTERN = /^[0-9]{1,19}$/
const SECURITY_KEY_PATTERN = /[^a-z0-9_.-]+/g
const ROUTE_PATTERN = /^\/admin(?:\/[a-z0-9-]+){0,4}$/
const auditKindSet = new Set<string>(ADMIN_AUDIT_EVENT_KINDS)

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

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

function normalizeSecurityKey(value: string | undefined, fallback: string, maxLength = 80) {
  const normalized = (value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(SECURITY_KEY_PATTERN, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLength)
  return normalized || fallback
}

function normalizeSecurityRoute(value?: string) {
  const normalized = (value || '/admin').trim().toLowerCase()
  return ROUTE_PATTERN.test(normalized) && normalized.length <= 120 ? normalized : '/admin'
}

function normalizeSecuritySubjectRef(value?: string | null) {
  const normalized = (value || '').trim().toLowerCase()
  return UUID_PATTERN.test(normalized) || BIGINT_PATTERN.test(normalized) ? normalized : 'none'
}

function classifyRpcFailure(code?: string): AdminSecurityEventKind {
  const normalized = (code || '').toUpperCase()
  if (normalized === '42501') return 'permission_denied'
  if (['40001', '40P01', '55P03', '23505'].includes(normalized)) return 'conflict'
  if (normalized === 'P0002' || normalized.startsWith('22') || normalized.startsWith('23')) {
    return 'validation_failed'
  }
  return 'command_failed'
}

async function recordAdminSecurityEventWithClient(
  supabase: SupabaseServerClient,
  context: AdminSecurityEventContext,
) {
  try {
    await supabase.rpc('record_admin_security_event', {
      p_event_kind: context.eventKind || 'command_failed',
      p_action_key: normalizeSecurityKey(context.actionKey, 'unknown_action'),
      p_resource_key: normalizeSecurityKey(context.resourceKey, 'admin_console'),
      p_failure_code: normalizeSecurityKey(context.failureCode, 'unknown'),
      p_route_key: normalizeSecurityRoute(context.routeKey),
      p_subject_type: normalizeSecurityKey(context.subjectType, 'none', 40),
      p_subject_ref: normalizeSecuritySubjectRef(context.subjectRef),
    })
  } catch {
    // Security telemetry is best-effort and must not replace the original result.
  }
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

export async function reportAdminSecurityEvent(context: AdminSecurityEventContext) {
  const supabase = await createClient()
  await recordAdminSecurityEventWithClient(supabase, context)
}

export async function getMyAdminAccess(): Promise<AdminAccess> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { roleLevel: 'none', capabilities: [] }

  const { data, error } = await supabase.rpc('get_my_admin_access')
  if (error || !data || typeof data !== 'object') return { roleLevel: 'none', capabilities: [] }

  const value = data as { role_level?: unknown; capabilities?: unknown }
  const roleLevel = ['moderator', 'admin', 'super_admin'].includes(String(value.role_level))
    ? String(value.role_level) as AdminRoleLevel
    : 'none'
  const capabilities = Array.isArray(value.capabilities)
    ? value.capabilities.filter((item): item is string => typeof item === 'string')
    : []

  return { roleLevel, capabilities }
}

export async function requireAdminCapability(
  capability: string,
  context: AdminSecurityEventContext = {},
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase.rpc('has_admin_capability', { p_capability: capability })
  if (error || data !== true) {
    await recordAdminSecurityEventWithClient(supabase, {
      eventKind: 'permission_denied',
      actionKey: context.actionKey || 'capability_check',
      resourceKey: context.resourceKey || capability,
      failureCode: error?.code || 'capability_denied',
      routeKey: context.routeKey || '/admin',
      subjectType: context.subjectType || 'none',
      subjectRef: context.subjectRef,
    })
    throw new Error('이 운영 작업을 수행할 권한이 없습니다.')
  }
  return supabase
}

export async function runAdminRpc(
  capability: string,
  rpcName: string,
  args: Record<string, unknown> = {},
  context: AdminSecurityEventContext = {},
): Promise<AdminRpcResult> {
  const supabase = await requireAdminCapability(capability, {
    ...context,
    actionKey: context.actionKey || rpcName,
    resourceKey: context.resourceKey || capability,
  })
  const result = await supabase.rpc(rpcName, args)

  if (result.error) {
    await recordAdminSecurityEventWithClient(supabase, {
      eventKind: classifyRpcFailure(result.error.code),
      actionKey: context.actionKey || rpcName,
      resourceKey: context.resourceKey || capability,
      failureCode: result.error.code || 'unknown',
      routeKey: context.routeKey || '/admin',
      subjectType: context.subjectType || 'none',
      subjectRef: context.subjectRef,
    })
  }

  return {
    data: result.data,
    error: result.error ? { code: result.error.code, message: result.error.message } : null,
  }
}

export async function searchAdminRoleCandidates(query: string) {
  try {
    const normalized = query.normalize('NFKC').trim()
    if (normalized.length < 2) {
      await reportAdminSecurityEvent({
        eventKind: 'validation_failed',
        actionKey: 'search_admin_role_candidates',
        resourceKey: 'role_manage',
        failureCode: 'query_too_short',
        routeKey: '/admin/access-control',
      })
      return { data: [], error: '검색어는 2자 이상 입력해 주세요.' }
    }
    const { data, error } = await runAdminRpc('role_manage', 'search_admin_role_candidates', {
      p_query: normalized,
      p_limit: 30,
    }, {
      routeKey: '/admin/access-control',
      resourceKey: 'role_manage',
    })
    if (error) return { data: [], error: error.message }
    return { data: Array.isArray(data) ? data : [] }
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : '사용자를 검색하지 못했습니다.' }
  }
}

export async function listAdminRoleChangeEvents() {
  try {
    const { data, error } = await runAdminRpc('audit_view', 'list_admin_role_change_events', {
      p_limit: 100,
      p_offset: 0,
    }, {
      routeKey: '/admin/access-control',
      resourceKey: 'audit_view',
    })
    if (error) return { data: [], error: error.message }
    return { data: Array.isArray(data) ? data : [] }
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : '역할 변경 이력을 불러오지 못했습니다.' }
  }
}

export async function setAdminRoleLevel(formData: FormData) {
  const targetUserId = String(formData.get('targetUserId') || '')
  const newLevel = String(formData.get('newLevel') || '')
  const reason = String(formData.get('reason') || '').normalize('NFKC').trim().replace(/\s+/gu, ' ')
  const { error } = await runAdminRpc('role_manage', 'set_admin_role_level', {
    p_target_user_id: targetUserId,
    p_new_level: newLevel,
    p_reason: reason,
  }, {
    routeKey: '/admin/access-control',
    resourceKey: 'admin_roles',
    subjectType: 'user',
    subjectRef: targetUserId,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/access-control')
  revalidatePath('/admin')
  revalidatePath('/', 'layout')
}

export async function listAdminAuditEvents() {
  try {
    const { data, error } = await runAdminRpc('audit_view', 'list_admin_audit_events', {
      p_limit: 150,
      p_offset: 0,
    }, {
      routeKey: '/admin/audit',
      resourceKey: 'audit_view',
    })
    if (error) return { data: [], error: error.message }
    return { data: Array.isArray(data) ? data : [] }
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : '운영 감사 기록을 불러오지 못했습니다.' }
  }
}

export async function listAdminAuditEventsV2(filters: AdminAuditFilters = {}): Promise<{
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
    const limit = Math.min(Math.max(filters.limit || 50, 1), 100)

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
      p_event_kinds: eventKinds.length > 0 ? eventKinds : null,
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
    return {
      data: [],
      nextCursor: null,
      error: error instanceof Error ? error.message : '운영 감사 기록을 불러오지 못했습니다.',
    }
  }
}

export async function getAdminAuditEventDetail(
  eventKind: string,
  eventId: string,
): Promise<{ data: AdminAuditDetail | null; error?: string }> {
  try {
    if (!auditKindSet.has(eventKind)) {
      await reportAdminSecurityEvent({ eventKind: 'suspicious_query', actionKey: 'get_admin_audit_event_detail', resourceKey: 'audit_view', failureCode: 'invalid_event_kind', routeKey: '/admin/audit' })
      return { data: null, error: '지원하지 않는 감사 이벤트 종류입니다.' }
    }
    const normalizedId = eventId.trim()
    const validId = eventKind === 'moderation_review' || eventKind === 'sponsorship_change'
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
    const sensitiveEvidence = value.sensitive_evidence
      && typeof value.sensitive_evidence === 'object'
      && !Array.isArray(value.sensitive_evidence)
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
    return {
      data: null,
      error: error instanceof Error ? error.message : '운영 감사 상세를 불러오지 못했습니다.',
    }
  }
}
