export const REVIEWED_EQUIVALENCE_EVIDENCE_INTERPRETATION = 'CANDIDATE_AVAILABLE_AT_FINAL_SAVE_NOT_CONFIRMED_UI_EXPOSURE' as const

export type ReviewedEquivalenceGovernanceEvent = {
  event_type: string
  ranking_id?: string | null
  input_subject_key?: string | null
  canonical_subject_key?: string | null
  resolution_kind?: string | null
  suggestion_keys?: string[] | null
  selected_subject_key?: string | null
  selected_rank?: number | null
  created_at?: string | null
}

export type ReviewedEquivalenceSummary = {
  subject_decisions: number
  candidate_available_decisions: number
  candidate_reuse_positive_decisions: number
  candidate_new_negative_decisions: number
  candidate_unlabeled_decisions: number
  new_without_candidate_decisions: number
  alias_equivalence_assertions: number
  candidate_decision_labels: number
  candidate_label_coverage_rate: number
  candidate_reuse_acceptance_rate: number
}

function rate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 10_000) / 10_000
}

export function summarizeReviewedEquivalenceEvidence(
  events: ReviewedEquivalenceGovernanceEvent[]
): ReviewedEquivalenceSummary {
  const subjectDecisions = events.filter(event => event.event_type === 'subject_decision_saved')
  const candidateAvailable = subjectDecisions.filter(event => (event.suggestion_keys?.length || 0) > 0)
  const positive = candidateAvailable.filter(event => event.resolution_kind === 'suggestion')
  const negative = candidateAvailable.filter(event => event.resolution_kind === 'new')
  const unlabeled = candidateAvailable.length - positive.length - negative.length
  const newWithoutCandidate = subjectDecisions.filter(event =>
    event.resolution_kind === 'new' && (event.suggestion_keys?.length || 0) === 0
  )
  const aliasAssertions = events.filter(event => event.event_type === 'subject_alias_created')
  const candidateLabels = positive.length + negative.length

  return {
    subject_decisions: subjectDecisions.length,
    candidate_available_decisions: candidateAvailable.length,
    candidate_reuse_positive_decisions: positive.length,
    candidate_new_negative_decisions: negative.length,
    candidate_unlabeled_decisions: unlabeled,
    new_without_candidate_decisions: newWithoutCandidate.length,
    alias_equivalence_assertions: aliasAssertions.length,
    candidate_decision_labels: candidateLabels,
    candidate_label_coverage_rate: rate(candidateLabels, candidateAvailable.length),
    candidate_reuse_acceptance_rate: rate(positive.length, candidateLabels),
  }
}

export function classifyReviewedEquivalenceDecision(
  event: ReviewedEquivalenceGovernanceEvent
): 'POSITIVE_REUSE' | 'NEGATIVE_NEW_SUBJECT' | 'UNLABELED_CANDIDATE' | 'NOT_CANDIDATE_DECISION' {
  if (event.event_type !== 'subject_decision_saved' || (event.suggestion_keys?.length || 0) === 0) {
    return 'NOT_CANDIDATE_DECISION'
  }
  if (event.resolution_kind === 'suggestion') return 'POSITIVE_REUSE'
  if (event.resolution_kind === 'new') return 'NEGATIVE_NEW_SUBJECT'
  return 'UNLABELED_CANDIDATE'
}
