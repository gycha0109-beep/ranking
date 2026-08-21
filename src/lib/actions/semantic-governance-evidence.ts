'use server'

import { requireAdminCapability } from '@/lib/actions/admin-access'
import {
  SEMANTIC_GOVERNANCE_MINIMUM_SAMPLE,
  semanticGovernanceRate,
  semanticGovernanceReadiness,
  type SemanticGovernanceReadiness,
} from '@/lib/semantic-governance-evidence'
import {
  rankRankingSubjectSuggestions,
  type RankingSubjectAlias,
  type RankingSubjectOption,
} from '@/lib/ranking-subject-suggestions'
import { createAdminClient } from '@/lib/supabase/admin'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000
const EVENT_READ_LIMIT = 5000
const PROJECTION_READ_LIMIT = 5000
const ALIAS_READ_LIMIT = 1000
const RETROSPECTIVE_PAIR_LIMIT = 12

type GovernanceEventRow = {
  event_type: string
  resolution_kind: string | null
  suggestion_keys: string[] | null
  selected_rank: number | null
  same_version_advisory_count: number | null
  created_at: string
}

type ProjectionRow = {
  subject_key: string | null
  version_signature: string | null
  classification_state: string | null
}

export type SemanticGovernanceEvidence = {
  period: {
    from: string
    to: string
    event_window_truncated: boolean
  }
  authority: {
    event_table: 'ranking_semantic_governance_events'
    product_usage_events_reused: false
    evidence_mode: 'retrospective_snapshot_plus_organic_decisions'
  }
  readiness: SemanticGovernanceReadiness
  minimum_sample: typeof SEMANTIC_GOVERNANCE_MINIMUM_SAMPLE
  snapshot: {
    projections: number
    subjects: number
    singleton_subjects: number
    singleton_ratio: number
    reused_subjects: number
    rankings_on_reused_subjects: number
    aliases: number
    duplicate_version_groups: number
    classification_states: Record<string, number>
    top_subjects: Array<{ subject_key: string; usage_count: number }>
  }
  organic: {
    subject_decisions: number
    suggestion_exposures: number
    suggestion_acceptances: number
    top1_suggestion_acceptances: number
    new_subject_decisions: number
    existing_subject_reuse: number
    alias_resolutions: number
    alias_created: number
    alias_deleted: number
    projections_cleared: number
    same_version_advisory_decisions: number
  }
  rates: {
    subject_reuse_rate: number
    suggestion_acceptance_rate: number
    top1_acceptance_rate: number
    alias_resolution_rate: number
  }
  retrospective: {
    interpretation: 'CONTROLLED_REPLAY_CANDIDATES_NOT_SAME_CONCEPT_LABELS'
    potential_subject_pairs: Array<{
      left_subject_key: string
      right_subject_key: string
      score: number
      matched_by: 'canonical' | 'alias'
      matched_key: string
    }>
  }
}

function parsePeriod(from: string, to: string) {
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) return null
  const fromDate = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T00:00:00.000Z`)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) return null
  if ((toDate.getTime() - fromDate.getTime()) / DAY_MS > 366) return null
  const toExclusive = new Date(toDate.getTime() + DAY_MS)
  return { fromDate, toExclusive }
}

function buildSubjectOptions(projections: ProjectionRow[], aliases: RankingSubjectAlias[]) {
  const usageCounts = new Map<string, number>()
  for (const projection of projections) {
    if (!projection.subject_key) continue
    usageCounts.set(projection.subject_key, (usageCounts.get(projection.subject_key) || 0) + 1)
  }

  const aliasesByCanonical = new Map<string, string[]>()
  for (const alias of aliases) {
    if (!alias.alias_key || !alias.canonical_subject_key) continue
    const values = aliasesByCanonical.get(alias.canonical_subject_key) || []
    values.push(alias.alias_key)
    aliasesByCanonical.set(alias.canonical_subject_key, values)
    if (!usageCounts.has(alias.canonical_subject_key)) usageCounts.set(alias.canonical_subject_key, 0)
  }

  return [...usageCounts.entries()]
    .map(([subject_key, usage_count]): RankingSubjectOption => ({
      subject_key,
      usage_count,
      aliases: (aliasesByCanonical.get(subject_key) || []).sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => {
      if (left.usage_count !== right.usage_count) return right.usage_count - left.usage_count
      return left.subject_key.localeCompare(right.subject_key)
    })
}

function buildRetrospectivePairs(options: RankingSubjectOption[]) {
  const pairs = new Map<string, SemanticGovernanceEvidence['retrospective']['potential_subject_pairs'][number]>()

  for (const option of options) {
    const candidates = rankRankingSubjectSuggestions(
      option.subject_key,
      options.filter(candidate => candidate.subject_key !== option.subject_key)
    )

    for (const candidate of candidates) {
      const [left, right] = [option.subject_key, candidate.subject_key].sort((a, b) => a.localeCompare(b))
      const key = `${left}\u0000${right}`
      const next = {
        left_subject_key: left,
        right_subject_key: right,
        score: candidate.score,
        matched_by: candidate.matched_by,
        matched_key: candidate.matched_key,
      }
      const current = pairs.get(key)
      if (!current || next.score > current.score) pairs.set(key, next)
    }
  }

  return [...pairs.values()]
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score
      const leftKey = `${left.left_subject_key}:${left.right_subject_key}`
      const rightKey = `${right.left_subject_key}:${right.right_subject_key}`
      return leftKey.localeCompare(rightKey)
    })
    .slice(0, RETROSPECTIVE_PAIR_LIMIT)
}

export async function getSemanticGovernanceEvidence(from: string, to: string): Promise<{
  data: SemanticGovernanceEvidence | null
  error?: string
}> {
  const period = parsePeriod(from, to)
  if (!period) return { data: null, error: 'IA-2D 측정 기간이 올바르지 않습니다.' }

  try {
    await requireAdminCapability('audit_view', {
      routeKey: '/admin/measure',
      resourceKey: 'semantic_governance_evidence',
      actionKey: 'get_semantic_governance_evidence',
    })

    const admin = createAdminClient()
    const [projectionResult, aliasResult, eventResult] = await Promise.all([
      admin
        .from('ranking_semantic_projections')
        .select('subject_key, version_signature, classification_state')
        .order('ranking_id', { ascending: true })
        .limit(PROJECTION_READ_LIMIT),
      admin
        .from('ranking_semantic_subject_aliases')
        .select('alias_key, canonical_subject_key, created_at')
        .order('alias_key', { ascending: true })
        .limit(ALIAS_READ_LIMIT),
      admin
        .from('ranking_semantic_governance_events')
        .select('event_type, resolution_kind, suggestion_keys, selected_rank, same_version_advisory_count, created_at')
        .gte('created_at', period.fromDate.toISOString())
        .lt('created_at', period.toExclusive.toISOString())
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(EVENT_READ_LIMIT),
    ])

    const firstError = projectionResult.error || aliasResult.error || eventResult.error
    if (firstError) return { data: null, error: `IA-2D evidence 조회 실패: ${firstError.message}` }

    const projections = (projectionResult.data || []) as ProjectionRow[]
    const aliases = (aliasResult.data || []) as RankingSubjectAlias[]
    const events = (eventResult.data || []) as GovernanceEventRow[]
    const options = buildSubjectOptions(projections, aliases)

    const subjectUsage = options.filter(option => option.usage_count > 0)
    const singletonSubjects = subjectUsage.filter(option => option.usage_count === 1).length
    const reusedSubjects = subjectUsage.filter(option => option.usage_count > 1)
    const rankingsOnReusedSubjects = reusedSubjects.reduce((sum, option) => sum + option.usage_count, 0)

    const versionCounts = new Map<string, number>()
    const classificationStates: Record<string, number> = {}
    for (const projection of projections) {
      if (projection.version_signature) {
        versionCounts.set(projection.version_signature, (versionCounts.get(projection.version_signature) || 0) + 1)
      }
      const state = projection.classification_state || 'unknown'
      classificationStates[state] = (classificationStates[state] || 0) + 1
    }

    const decisions = events.filter(event => event.event_type === 'subject_decision_saved')
    const suggestionExposures = decisions.filter(event => Array.isArray(event.suggestion_keys) && event.suggestion_keys.length > 0).length
    const suggestionAcceptances = decisions.filter(event => event.resolution_kind === 'suggestion').length
    const top1Acceptances = decisions.filter(event => event.resolution_kind === 'suggestion' && event.selected_rank === 1).length
    const newSubjectDecisions = decisions.filter(event => event.resolution_kind === 'new').length
    const existingSubjectReuse = decisions.filter(event => event.resolution_kind === 'existing').length
    const aliasResolutions = decisions.filter(event => event.resolution_kind === 'alias').length
    const reusedDecisions = existingSubjectReuse + aliasResolutions + suggestionAcceptances
    const sameVersionAdvisoryDecisions = decisions.filter(event => Number(event.same_version_advisory_count || 0) > 0).length

    const organic = {
      subject_decisions: decisions.length,
      suggestion_exposures: suggestionExposures,
      suggestion_acceptances: suggestionAcceptances,
      top1_suggestion_acceptances: top1Acceptances,
      new_subject_decisions: newSubjectDecisions,
      existing_subject_reuse: existingSubjectReuse,
      alias_resolutions: aliasResolutions,
      alias_created: events.filter(event => event.event_type === 'subject_alias_created').length,
      alias_deleted: events.filter(event => event.event_type === 'subject_alias_deleted').length,
      projections_cleared: events.filter(event => event.event_type === 'projection_cleared').length,
      same_version_advisory_decisions: sameVersionAdvisoryDecisions,
    }

    return {
      data: {
        period: {
          from,
          to,
          event_window_truncated: events.length >= EVENT_READ_LIMIT,
        },
        authority: {
          event_table: 'ranking_semantic_governance_events',
          product_usage_events_reused: false,
          evidence_mode: 'retrospective_snapshot_plus_organic_decisions',
        },
        readiness: semanticGovernanceReadiness(organic),
        minimum_sample: SEMANTIC_GOVERNANCE_MINIMUM_SAMPLE,
        snapshot: {
          projections: projections.length,
          subjects: subjectUsage.length,
          singleton_subjects: singletonSubjects,
          singleton_ratio: semanticGovernanceRate(singletonSubjects, subjectUsage.length),
          reused_subjects: reusedSubjects.length,
          rankings_on_reused_subjects: rankingsOnReusedSubjects,
          aliases: aliases.length,
          duplicate_version_groups: [...versionCounts.values()].filter(count => count > 1).length,
          classification_states: classificationStates,
          top_subjects: subjectUsage.slice(0, 10).map(option => ({
            subject_key: option.subject_key,
            usage_count: option.usage_count,
          })),
        },
        organic,
        rates: {
          subject_reuse_rate: semanticGovernanceRate(reusedDecisions, decisions.length),
          suggestion_acceptance_rate: semanticGovernanceRate(suggestionAcceptances, suggestionExposures),
          top1_acceptance_rate: semanticGovernanceRate(top1Acceptances, suggestionAcceptances),
          alias_resolution_rate: semanticGovernanceRate(aliasResolutions, decisions.length),
        },
        retrospective: {
          interpretation: 'CONTROLLED_REPLAY_CANDIDATES_NOT_SAME_CONCEPT_LABELS',
          potential_subject_pairs: buildRetrospectivePairs(subjectUsage),
        },
      },
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'IA-2D semantic governance evidence를 불러오지 못했습니다.',
    }
  }
}
