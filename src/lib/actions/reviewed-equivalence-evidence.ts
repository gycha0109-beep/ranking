'use server'

import { requireAdminCapability } from '@/lib/actions/admin-access'
import {
  SEMANTIC_GOVERNANCE_MINIMUM_SAMPLE,
  semanticGovernanceReadiness,
} from '@/lib/semantic-governance-evidence'
import {
  REVIEWED_EQUIVALENCE_EVIDENCE_INTERPRETATION,
  classifyReviewedEquivalenceDecision,
  summarizeReviewedEquivalenceEvidence,
  type ReviewedEquivalenceGovernanceEvent,
} from '@/lib/reviewed-equivalence-evidence'
import { createAdminClient } from '@/lib/supabase/admin'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000
const EVENT_READ_LIMIT = 5000
const ALIAS_READ_LIMIT = 1000
const RECENT_DECISION_LIMIT = 20

type EventRow = ReviewedEquivalenceGovernanceEvent & {
  id: number
  ranking_id: string | null
  input_subject_key: string | null
  canonical_subject_key: string | null
  resolution_kind: string | null
  suggestion_keys: string[] | null
  selected_subject_key: string | null
  selected_rank: number | null
  created_at: string
}

function parsePeriod(from: string, to: string) {
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) return null
  const fromDate = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T00:00:00.000Z`)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) return null
  if ((toDate.getTime() - fromDate.getTime()) / DAY_MS > 366) return null
  return { fromDate, toExclusive: new Date(toDate.getTime() + DAY_MS) }
}

export async function getReviewedEquivalenceEvidence(from: string, to: string) {
  const period = parsePeriod(from, to)
  if (!period) return { data: null, error: 'IA-2L 측정 기간이 올바르지 않습니다.' }

  try {
    await requireAdminCapability('audit_view', {
      routeKey: '/admin/measure/equivalence',
      resourceKey: 'reviewed_equivalence_evidence',
      actionKey: 'get_reviewed_equivalence_evidence',
    })

    const admin = createAdminClient()
    const [eventResult, aliasResult] = await Promise.all([
      admin
        .from('ranking_semantic_governance_events')
        .select('id, event_type, ranking_id, input_subject_key, canonical_subject_key, resolution_kind, suggestion_keys, selected_subject_key, selected_rank, created_at')
        .gte('created_at', period.fromDate.toISOString())
        .lt('created_at', period.toExclusive.toISOString())
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(EVENT_READ_LIMIT),
      admin
        .from('ranking_semantic_subject_aliases')
        .select('alias_key, canonical_subject_key, created_at')
        .order('alias_key', { ascending: true })
        .limit(ALIAS_READ_LIMIT),
    ])

    const firstError = eventResult.error || aliasResult.error
    if (firstError) return { data: null, error: `IA-2L evidence 조회 실패: ${firstError.message}` }

    const events = (eventResult.data || []) as EventRow[]
    const summary = summarizeReviewedEquivalenceEvidence(events)
    const recentCandidateDecisions = events
      .map(event => ({ event, label: classifyReviewedEquivalenceDecision(event) }))
      .filter(row => row.label !== 'NOT_CANDIDATE_DECISION')
      .slice(0, RECENT_DECISION_LIMIT)
      .map(({ event, label }) => ({
        id: event.id,
        ranking_id: event.ranking_id,
        input_subject_key: event.input_subject_key,
        canonical_subject_key: event.canonical_subject_key,
        candidate_subject_keys: (event.suggestion_keys || []).slice(0, 5),
        selected_subject_key: event.selected_subject_key,
        selected_rank: event.selected_rank,
        label,
        created_at: event.created_at,
      }))

    const aliasAssertions = events
      .filter(event => event.event_type === 'subject_alias_created')
      .slice(0, RECENT_DECISION_LIMIT)
      .map(event => ({
        id: event.id,
        alias_key: event.input_subject_key,
        canonical_subject_key: event.canonical_subject_key,
        created_at: event.created_at,
      }))

    return {
      data: {
        authority: {
          event_table: 'ranking_semantic_governance_events' as const,
          product_usage_events_reused: false as const,
          interpretation: REVIEWED_EQUIVALENCE_EVIDENCE_INTERPRETATION,
          mutation_authority: 'NONE_READ_ONLY_READBACK' as const,
        },
        period: {
          from,
          to,
          event_window_truncated: events.length >= EVENT_READ_LIMIT,
        },
        readiness: semanticGovernanceReadiness({
          subject_decisions: summary.subject_decisions,
          suggestion_exposures: summary.candidate_available_decisions,
          new_subject_decisions: events.filter(event =>
            event.event_type === 'subject_decision_saved' && event.resolution_kind === 'new'
          ).length,
        }),
        minimum_sample: SEMANTIC_GOVERNANCE_MINIMUM_SAMPLE,
        summary,
        current_aliases: (aliasResult.data || []).map(row => ({
          alias_key: row.alias_key,
          canonical_subject_key: row.canonical_subject_key,
          created_at: row.created_at,
        })),
        recent_candidate_decisions: recentCandidateDecisions,
        recent_alias_assertions: aliasAssertions,
      },
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'IA-2L reviewed equivalence evidence를 불러오지 못했습니다.',
    }
  }
}
