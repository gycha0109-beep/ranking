export const ADMIN_AUDIT_EVENT_KINDS = [
  'role_change',
  'moderation_review',
  'comment_report_decision',
  'sanction_event',
  'appeal_decision',
  'maintenance_job',
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
