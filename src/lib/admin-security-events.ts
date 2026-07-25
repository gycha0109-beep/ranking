export const ADMIN_SECURITY_EVENT_KINDS = [
  'permission_denied',
  'validation_failed',
  'conflict',
  'command_failed',
  'suspicious_query',
] as const

export const ADMIN_SECURITY_RISK_LEVELS = ['low', 'medium', 'high'] as const

export type AdminSecurityEventKind = typeof ADMIN_SECURITY_EVENT_KINDS[number]
export type AdminSecurityRiskLevel = typeof ADMIN_SECURITY_RISK_LEVELS[number]

export type AdminSecurityEvent = {
  id: number
  bucketStartedAt: string
  actorId: string
  actorLabel: string
  actorRoleLevel: string
  eventKind: AdminSecurityEventKind
  actionKey: string
  resourceKey: string
  failureCode: string
  routeKey: string
  subjectType: string
  sampleSubjectRef: string
  lastSubjectRef: string
  sourceTrust: string
  firstSeenAt: string
  lastSeenAt: string
  occurrenceCount: number
  riskLevel: AdminSecurityRiskLevel
  isRepeated: boolean
}

export type AdminSecurityEventCursor = { lastSeenAt: string; id: number }

export type AdminSecurityEventFilters = {
  eventKinds?: string[]
  riskLevels?: string[]
  actorId?: string | null
  actionKey?: string | null
  from?: string | null
  to?: string | null
  minOccurrence?: number
  cursor?: AdminSecurityEventCursor | null
  limit?: number
}

export type AdminSecurityOverview = {
  hours: number
  totalOccurrences: number
  totalBuckets: number
  highBuckets: number
  mediumBuckets: number
  lowBuckets: number
  repeatedBuckets: number
  byEventKind: Record<string, number>
}
