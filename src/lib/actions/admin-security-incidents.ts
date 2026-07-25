'use server'

import { revalidatePath } from 'next/cache'
import { reportAdminSecurityEvent, runAdminRpc } from '@/lib/actions/admin-access'
import {
  ADMIN_SECURITY_INCIDENT_EVENT_TYPES,
  ADMIN_SECURITY_INCIDENT_SEVERITIES,
  ADMIN_SECURITY_INCIDENT_STATUSES,
  type AdminSecurityIncident,
  type AdminSecurityIncidentAssignee,
  type AdminSecurityIncidentCursor,
  type AdminSecurityIncidentDetail,
  type AdminSecurityIncidentEvent,
  type AdminSecurityIncidentEventType,
  type AdminSecurityIncidentFilters,
  type AdminSecurityIncidentSeverity,
  type AdminSecurityIncidentSource,
  type AdminSecurityIncidentStatus,
  type AdminSecurityIncidentSummary,
} from '@/lib/admin-security-incidents'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/
const statusSet = new Set<string>(ADMIN_SECURITY_INCIDENT_STATUSES)
const severitySet = new Set<string>(ADMIN_SECURITY_INCIDENT_SEVERITIES)
const eventTypeSet = new Set<string>(ADMIN_SECURITY_INCIDENT_EVENT_TYPES)

function parseNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = parseNumber(value, Number.NaN)
  return Number.isFinite(parsed) ? parsed : null
}

function parseTimestamp(value?: string | null) {
  const normalized = (value || '').trim()
  if (!normalized) return null
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function parseIncident(raw: unknown): AdminSecurityIncident | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (
    typeof row.id !== 'string'
    || typeof row.fingerprint !== 'string'
    || typeof row.status !== 'string'
    || !statusSet.has(row.status)
    || typeof row.severity !== 'string'
    || !severitySet.has(row.severity)
    || typeof row.source_trust !== 'string'
    || typeof row.telemetry_actor_id !== 'string'
    || typeof row.telemetry_actor_label !== 'string'
    || typeof row.event_kind !== 'string'
    || typeof row.action_key !== 'string'
    || typeof row.resource_key !== 'string'
    || typeof row.failure_code !== 'string'
    || typeof row.route_key !== 'string'
    || typeof row.subject_type !== 'string'
    || typeof row.first_subject_ref !== 'string'
    || typeof row.latest_subject_ref !== 'string'
    || typeof row.first_detected_at !== 'string'
    || typeof row.last_detected_at !== 'string'
    || typeof row.created_at !== 'string'
    || typeof row.updated_at !== 'string'
  ) return null

  return {
    id: row.id,
    fingerprint: row.fingerprint,
    status: row.status as AdminSecurityIncidentStatus,
    severity: row.severity as AdminSecurityIncidentSeverity,
    sourceTrust: row.source_trust,
    telemetryActorId: row.telemetry_actor_id,
    telemetryActorLabel: row.telemetry_actor_label,
    eventKind: row.event_kind,
    actionKey: row.action_key,
    resourceKey: row.resource_key,
    failureCode: row.failure_code,
    routeKey: row.route_key,
    subjectType: row.subject_type,
    firstSubjectRef: row.first_subject_ref,
    latestSubjectRef: row.latest_subject_ref,
    firstBucketId: parseNullableNumber(row.first_bucket_id),
    latestBucketId: parseNullableNumber(row.latest_bucket_id),
    firstDetectedAt: row.first_detected_at,
    lastDetectedAt: row.last_detected_at,
    windowOccurrenceCount: parseNumber(row.window_occurrence_count),
    lifetimeOccurrenceCount: parseNumber(row.lifetime_occurrence_count),
    workflowVersion: parseNumber(row.workflow_version, 1),
    assignedTo: typeof row.assigned_to === 'string' ? row.assigned_to : null,
    assigneeLabel: typeof row.assignee_label === 'string' ? row.assignee_label : null,
    acknowledgedAt: typeof row.acknowledged_at === 'string' ? row.acknowledged_at : null,
    acknowledgedBy: typeof row.acknowledged_by === 'string' ? row.acknowledged_by : null,
    resolvedAt: typeof row.resolved_at === 'string' ? row.resolved_at : null,
    resolvedBy: typeof row.resolved_by === 'string' ? row.resolved_by : null,
    resolutionCode: typeof row.resolution_code === 'string' ? row.resolution_code : null,
    alertedAt: typeof row.alerted_at === 'string' ? row.alerted_at : null,
    alertCooldownUntil: typeof row.alert_cooldown_until === 'string' ? row.alert_cooldown_until : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function parseIncidentEvent(raw: unknown): AdminSecurityIncidentEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (
    typeof row.event_type !== 'string'
    || !eventTypeSet.has(row.event_type)
    || typeof row.actor_label !== 'string'
    || typeof row.created_at !== 'string'
  ) return null

  const previousStatus = typeof row.previous_status === 'string' && statusSet.has(row.previous_status)
    ? row.previous_status as AdminSecurityIncidentStatus
    : null
  const newStatus = typeof row.new_status === 'string' && statusSet.has(row.new_status)
    ? row.new_status as AdminSecurityIncidentStatus
    : null
  const previousSeverity = typeof row.previous_severity === 'string' && severitySet.has(row.previous_severity)
    ? row.previous_severity as AdminSecurityIncidentSeverity
    : null
  const newSeverity = typeof row.new_severity === 'string' && severitySet.has(row.new_severity)
    ? row.new_severity as AdminSecurityIncidentSeverity
    : null

  return {
    id: parseNumber(row.id),
    eventType: row.event_type as AdminSecurityIncidentEventType,
    actorId: typeof row.actor_id === 'string' ? row.actor_id : null,
    actorLabel: row.actor_label,
    previousStatus,
    newStatus,
    previousAssigneeId: typeof row.previous_assignee_id === 'string' ? row.previous_assignee_id : null,
    newAssigneeId: typeof row.new_assignee_id === 'string' ? row.new_assignee_id : null,
    previousSeverity,
    newSeverity,
    reasonCode: typeof row.reason_code === 'string' ? row.reason_code : null,
    note: typeof row.note === 'string' ? row.note : null,
    sourceBucketId: parseNullableNumber(row.source_bucket_id),
    windowOccurrenceCount: parseNumber(row.window_occurrence_count),
    lifetimeOccurrenceCount: parseNumber(row.lifetime_occurrence_count),
    createdAt: row.created_at,
  }
}

function parseIncidentSource(raw: unknown): AdminSecurityIncidentSource | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (
    typeof row.bucket_started_at !== 'string'
    || typeof row.event_kind !== 'string'
    || typeof row.action_key !== 'string'
    || typeof row.resource_key !== 'string'
    || typeof row.failure_code !== 'string'
    || typeof row.route_key !== 'string'
    || typeof row.subject_type !== 'string'
    || typeof row.sample_subject_ref !== 'string'
    || typeof row.last_subject_ref !== 'string'
    || typeof row.first_seen_at !== 'string'
    || typeof row.last_seen_at !== 'string'
    || typeof row.linked_at !== 'string'
    || typeof row.updated_at !== 'string'
  ) return null

  return {
    bucketId: parseNumber(row.bucket_id),
    bucketStartedAt: row.bucket_started_at,
    eventKind: row.event_kind,
    actionKey: row.action_key,
    resourceKey: row.resource_key,
    failureCode: row.failure_code,
    routeKey: row.route_key,
    subjectType: row.subject_type,
    sampleSubjectRef: row.sample_subject_ref,
    lastSubjectRef: row.last_subject_ref,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    occurrenceCount: parseNumber(row.occurrence_count),
    firstObservedCount: parseNumber(row.first_observed_count),
    lastObservedCount: parseNumber(row.last_observed_count),
    linkedAt: row.linked_at,
    updatedAt: row.updated_at,
  }
}

function revalidateIncidentPaths(incidentId: string) {
  revalidatePath('/admin')
  revalidatePath('/admin/security-incidents')
  revalidatePath(`/admin/security-incidents/${incidentId}`)
  revalidatePath('/admin/audit')
}

export async function listAdminSecurityIncidents(filters: AdminSecurityIncidentFilters = {}): Promise<{
  data: AdminSecurityIncident[]
  nextCursor: AdminSecurityIncidentCursor | null
  error?: string
}> {
  try {
    const statuses = Array.from(new Set(filters.statuses || []))
      .filter((status): status is AdminSecurityIncidentStatus => statusSet.has(status))
    const severities = Array.from(new Set(filters.severities || []))
      .filter((severity): severity is AdminSecurityIncidentSeverity => severitySet.has(severity))
    const actorId = (filters.actorId || '').trim().toLowerCase() || null
    const assigneeId = (filters.assigneeId || '').trim().toLowerCase() || null
    const fingerprint = (filters.fingerprint || '').trim().toLowerCase() || null
    const from = parseTimestamp(filters.from)
    const to = parseTimestamp(filters.to)
    const cursorAt = parseTimestamp(filters.cursor?.lastDetectedAt)
    const cursorId = filters.cursor?.id?.trim().toLowerCase() || null
    const limit = Math.min(Math.max(Math.trunc(filters.limit || 50), 1), 100)

    if ((actorId && !UUID_PATTERN.test(actorId)) || (assigneeId && !UUID_PATTERN.test(assigneeId))) {
      await reportAdminSecurityEvent({ eventKind: 'suspicious_query', actionKey: 'list_admin_security_incidents', resourceKey: 'security_incident_view', failureCode: 'invalid_uuid_filter', routeKey: '/admin/security-incidents' })
      return { data: [], nextCursor: null, error: '행위자 또는 담당자 UUID 형식이 올바르지 않습니다.' }
    }
    if (fingerprint && !FINGERPRINT_PATTERN.test(fingerprint)) {
      await reportAdminSecurityEvent({ eventKind: 'suspicious_query', actionKey: 'list_admin_security_incidents', resourceKey: 'security_incident_view', failureCode: 'invalid_fingerprint', routeKey: '/admin/security-incidents' })
      return { data: [], nextCursor: null, error: 'Fingerprint 형식이 올바르지 않습니다.' }
    }
    if (from === undefined || to === undefined || cursorAt === undefined) {
      return { data: [], nextCursor: null, error: '조회 시각 형식이 올바르지 않습니다.' }
    }
    if ((cursorAt === null) !== (cursorId === null) || (cursorId && !UUID_PATTERN.test(cursorId))) {
      return { data: [], nextCursor: null, error: '보안 사건 cursor 형식이 올바르지 않습니다.' }
    }
    if (from && to && from >= to) return { data: [], nextCursor: null, error: '조회 시작 시각은 종료 시각보다 빨라야 합니다.' }

    const { data, error } = await runAdminRpc('security_incident_view', 'list_admin_security_incidents', {
      p_statuses: statuses.length ? statuses : null,
      p_severities: severities.length ? severities : null,
      p_actor_id: actorId,
      p_assignee_id: assigneeId,
      p_fingerprint: fingerprint,
      p_from: from,
      p_to: to,
      p_cursor_last_detected_at: cursorAt,
      p_cursor_id: cursorId,
      p_limit: limit,
    }, {
      routeKey: '/admin/security-incidents',
      resourceKey: 'admin_security_incidents',
    })

    if (error) return { data: [], nextCursor: null, error: error.message }
    const incidents = (Array.isArray(data) ? data : []).flatMap((row) => {
      const incident = parseIncident(row)
      return incident ? [incident] : []
    })
    const last = incidents.at(-1)
    return {
      data: incidents,
      nextCursor: incidents.length === limit && last ? { lastDetectedAt: last.lastDetectedAt, id: last.id } : null,
    }
  } catch (error) {
    return { data: [], nextCursor: null, error: error instanceof Error ? error.message : '보안 사건을 불러오지 못했습니다.' }
  }
}

export async function getAdminSecurityIncidentSummary(): Promise<{
  data: AdminSecurityIncidentSummary | null
  error?: string
}> {
  try {
    const { data, error } = await runAdminRpc('security_incident_view', 'get_admin_security_incident_summary', {}, {
      routeKey: '/admin/security-incidents',
      resourceKey: 'admin_security_incidents',
    })
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
      return { data: null, error: error?.message || '보안 사건 요약 응답이 올바르지 않습니다.' }
    }
    const row = data as Record<string, unknown>
    return {
      data: {
        openCount: parseNumber(row.open_count),
        acknowledgedCount: parseNumber(row.acknowledged_count),
        activeCount: parseNumber(row.active_count),
        highCriticalActiveCount: parseNumber(row.high_critical_active_count),
        criticalActiveCount: parseNumber(row.critical_active_count),
        unassignedActiveCount: parseNumber(row.unassigned_active_count),
        newestActiveAt: typeof row.newest_active_at === 'string' ? row.newest_active_at : null,
      },
    }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : '보안 사건 요약을 불러오지 못했습니다.' }
  }
}

export async function listSecurityIncidentAssignees(): Promise<{
  data: AdminSecurityIncidentAssignee[]
  error?: string
}> {
  try {
    const { data, error } = await runAdminRpc('security_incident_view', 'list_security_incident_assignees', {}, {
      routeKey: '/admin/security-incidents',
      resourceKey: 'admin_security_incidents',
    })
    if (error) return { data: [], error: error.message }
    const assignees = (Array.isArray(data) ? data : []).flatMap((raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
      const row = raw as Record<string, unknown>
      if (typeof row.user_id !== 'string' || typeof row.display_name !== 'string') return []
      return [{ userId: row.user_id, displayName: row.display_name }]
    })
    return { data: assignees }
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : '담당자 후보를 불러오지 못했습니다.' }
  }
}

export async function getAdminSecurityIncidentDetail(incidentId: string): Promise<{
  data: AdminSecurityIncidentDetail | null
  error?: string
}> {
  try {
    const normalizedId = incidentId.trim().toLowerCase()
    if (!UUID_PATTERN.test(normalizedId)) return { data: null, error: '보안 사건 ID 형식이 올바르지 않습니다.' }

    const { data, error } = await runAdminRpc('security_incident_view', 'get_admin_security_incident_detail', {
      p_incident_id: normalizedId,
    }, {
      routeKey: '/admin/security-incidents',
      resourceKey: 'admin_security_incidents',
      subjectType: 'security_incident',
      subjectRef: normalizedId,
    })
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
      return { data: null, error: error?.message || '보안 사건 상세 응답이 올바르지 않습니다.' }
    }

    const value = data as Record<string, unknown>
    const incident = parseIncident(value.incident)
    if (!incident) return { data: null, error: '보안 사건 상세 응답이 올바르지 않습니다.' }
    const events = (Array.isArray(value.events) ? value.events : []).flatMap((row) => {
      const event = parseIncidentEvent(row)
      return event ? [event] : []
    })
    const sources = (Array.isArray(value.sources) ? value.sources : []).flatMap((row) => {
      const source = parseIncidentSource(row)
      return source ? [source] : []
    })

    return {
      data: {
        incident,
        events,
        sources,
        firstBucket: value.first_bucket && typeof value.first_bucket === 'object' && !Array.isArray(value.first_bucket)
          ? value.first_bucket as Record<string, unknown>
          : null,
        latestBucket: value.latest_bucket && typeof value.latest_bucket === 'object' && !Array.isArray(value.latest_bucket)
          ? value.latest_bucket as Record<string, unknown>
          : null,
        auditCorrelationId: typeof value.audit_correlation_id === 'string' ? value.audit_correlation_id : `security-incident:${incident.id}`,
        sourceTrust: typeof value.source_trust === 'string' ? value.source_trust : incident.sourceTrust,
      },
    }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : '보안 사건 상세를 불러오지 못했습니다.' }
  }
}

export async function acknowledgeAdminSecurityIncident(formData: FormData) {
  const incidentId = String(formData.get('incidentId') || '').trim().toLowerCase()
  const workflowVersion = Number(formData.get('workflowVersion'))
  const { error } = await runAdminRpc('security_incident_manage', 'acknowledge_admin_security_incident', {
    p_incident_id: incidentId,
    p_expected_workflow_version: workflowVersion,
  }, {
    routeKey: '/admin/security-incidents',
    resourceKey: 'admin_security_incidents',
    subjectType: 'security_incident',
    subjectRef: incidentId,
  })
  if (error) throw new Error(error.message)
  revalidateIncidentPaths(incidentId)
}

export async function assignAdminSecurityIncident(formData: FormData) {
  const incidentId = String(formData.get('incidentId') || '').trim().toLowerCase()
  const assigneeId = String(formData.get('assigneeId') || '').trim().toLowerCase() || null
  const workflowVersion = Number(formData.get('workflowVersion'))
  const { error } = await runAdminRpc('security_incident_manage', 'assign_admin_security_incident', {
    p_incident_id: incidentId,
    p_assignee_id: assigneeId,
    p_expected_workflow_version: workflowVersion,
  }, {
    routeKey: '/admin/security-incidents',
    resourceKey: 'admin_security_incidents',
    subjectType: 'security_incident',
    subjectRef: incidentId,
  })
  if (error) throw new Error(error.message)
  revalidateIncidentPaths(incidentId)
}

export async function resolveAdminSecurityIncident(formData: FormData) {
  const incidentId = String(formData.get('incidentId') || '').trim().toLowerCase()
  const targetStatus = String(formData.get('targetStatus') || '').trim().toLowerCase()
  const resolutionCode = String(formData.get('resolutionCode') || '').trim().toLowerCase()
  const note = String(formData.get('note') || '').normalize('NFKC').trim().replace(/\s+/gu, ' ')
  const workflowVersion = Number(formData.get('workflowVersion'))
  const { error } = await runAdminRpc('security_incident_manage', 'resolve_admin_security_incident', {
    p_incident_id: incidentId,
    p_target_status: targetStatus,
    p_resolution_code: resolutionCode,
    p_note: note || null,
    p_expected_workflow_version: workflowVersion,
  }, {
    routeKey: '/admin/security-incidents',
    resourceKey: 'admin_security_incidents',
    subjectType: 'security_incident',
    subjectRef: incidentId,
  })
  if (error) throw new Error(error.message)
  revalidateIncidentPaths(incidentId)
}

export async function reopenAdminSecurityIncident(formData: FormData) {
  const incidentId = String(formData.get('incidentId') || '').trim().toLowerCase()
  const reasonCode = String(formData.get('reasonCode') || '').trim().toLowerCase()
  const note = String(formData.get('note') || '').normalize('NFKC').trim().replace(/\s+/gu, ' ')
  const workflowVersion = Number(formData.get('workflowVersion'))
  const { error } = await runAdminRpc('security_incident_manage', 'reopen_admin_security_incident', {
    p_incident_id: incidentId,
    p_reason_code: reasonCode,
    p_note: note || null,
    p_expected_workflow_version: workflowVersion,
  }, {
    routeKey: '/admin/security-incidents',
    resourceKey: 'admin_security_incidents',
    subjectType: 'security_incident',
    subjectRef: incidentId,
  })
  if (error) throw new Error(error.message)
  revalidateIncidentPaths(incidentId)
}
