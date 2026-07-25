export const ADMIN_SECURITY_INCIDENT_STATUSES = [
  'open',
  'acknowledged',
  'resolved',
  'false_positive',
] as const

export const ADMIN_SECURITY_INCIDENT_SEVERITIES = ['medium', 'high', 'critical'] as const

export const ADMIN_SECURITY_INCIDENT_EVENT_TYPES = [
  'created',
  'signal_updated',
  'severity_escalated',
  'alerted',
  'acknowledged',
  'assigned',
  'resolved',
  'reopened',
] as const

export type AdminSecurityIncidentStatus = typeof ADMIN_SECURITY_INCIDENT_STATUSES[number]
export type AdminSecurityIncidentSeverity = typeof ADMIN_SECURITY_INCIDENT_SEVERITIES[number]
export type AdminSecurityIncidentEventType = typeof ADMIN_SECURITY_INCIDENT_EVENT_TYPES[number]

export type AdminSecurityIncident = {
  id: string
  fingerprint: string
  status: AdminSecurityIncidentStatus
  severity: AdminSecurityIncidentSeverity
  sourceTrust: string
  telemetryActorId: string
  telemetryActorLabel: string
  eventKind: string
  actionKey: string
  resourceKey: string
  failureCode: string
  routeKey: string
  subjectType: string
  firstSubjectRef: string
  latestSubjectRef: string
  firstBucketId: number | null
  latestBucketId: number | null
  firstDetectedAt: string
  lastDetectedAt: string
  windowOccurrenceCount: number
  lifetimeOccurrenceCount: number
  workflowVersion: number
  assignedTo: string | null
  assigneeLabel: string | null
  acknowledgedAt: string | null
  acknowledgedBy: string | null
  resolvedAt: string | null
  resolvedBy: string | null
  resolutionCode: string | null
  alertedAt: string | null
  alertCooldownUntil: string | null
  createdAt: string
  updatedAt: string
}

export type AdminSecurityIncidentCursor = {
  lastDetectedAt: string
  id: string
}

export type AdminSecurityIncidentFilters = {
  statuses?: string[]
  severities?: string[]
  actorId?: string | null
  assigneeId?: string | null
  fingerprint?: string | null
  from?: string | null
  to?: string | null
  cursor?: AdminSecurityIncidentCursor | null
  limit?: number
}

export type AdminSecurityIncidentSummary = {
  openCount: number
  acknowledgedCount: number
  activeCount: number
  highCriticalActiveCount: number
  criticalActiveCount: number
  unassignedActiveCount: number
  newestActiveAt: string | null
}

export type AdminSecurityIncidentEvent = {
  id: number
  eventType: AdminSecurityIncidentEventType
  actorId: string | null
  actorLabel: string
  previousStatus: AdminSecurityIncidentStatus | null
  newStatus: AdminSecurityIncidentStatus | null
  previousAssigneeId: string | null
  newAssigneeId: string | null
  previousSeverity: AdminSecurityIncidentSeverity | null
  newSeverity: AdminSecurityIncidentSeverity | null
  reasonCode: string | null
  note: string | null
  sourceBucketId: number | null
  windowOccurrenceCount: number
  lifetimeOccurrenceCount: number
  createdAt: string
}

export type AdminSecurityIncidentSource = {
  bucketId: number
  bucketStartedAt: string
  eventKind: string
  actionKey: string
  resourceKey: string
  failureCode: string
  routeKey: string
  subjectType: string
  sampleSubjectRef: string
  lastSubjectRef: string
  firstSeenAt: string
  lastSeenAt: string
  occurrenceCount: number
  firstObservedCount: number
  lastObservedCount: number
  linkedAt: string
  updatedAt: string
}

export type AdminSecurityIncidentDetail = {
  incident: AdminSecurityIncident
  events: AdminSecurityIncidentEvent[]
  sources: AdminSecurityIncidentSource[]
  firstBucket: Record<string, unknown> | null
  latestBucket: Record<string, unknown> | null
  auditCorrelationId: string
  sourceTrust: string
}

export type AdminSecurityIncidentAssignee = {
  userId: string
  displayName: string
}
