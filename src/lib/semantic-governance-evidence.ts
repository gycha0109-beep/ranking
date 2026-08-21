export const SEMANTIC_GOVERNANCE_EVENT_TYPES = [
  'subject_decision_saved',
  'subject_alias_created',
  'subject_alias_deleted',
  'projection_cleared',
] as const

export type SemanticGovernanceEventType = typeof SEMANTIC_GOVERNANCE_EVENT_TYPES[number]

export const SEMANTIC_GOVERNANCE_RESOLUTION_KINDS = [
  'new',
  'existing',
  'alias',
  'suggestion',
] as const

export type SemanticGovernanceResolutionKind = typeof SEMANTIC_GOVERNANCE_RESOLUTION_KINDS[number]

export const SEMANTIC_GOVERNANCE_MINIMUM_SAMPLE = {
  subject_decisions: 50,
  suggestion_exposures: 30,
  new_subject_decisions: 10,
} as const

export type SemanticGovernanceReadiness =
  | 'INSUFFICIENT_OPERATIONAL_EVIDENCE'
  | 'MINIMUM_ORGANIC_SAMPLE_REACHED'

export function semanticGovernanceReadiness(input: {
  subject_decisions: number
  suggestion_exposures: number
  new_subject_decisions: number
}): SemanticGovernanceReadiness {
  return input.subject_decisions >= SEMANTIC_GOVERNANCE_MINIMUM_SAMPLE.subject_decisions
    && input.suggestion_exposures >= SEMANTIC_GOVERNANCE_MINIMUM_SAMPLE.suggestion_exposures
    && input.new_subject_decisions >= SEMANTIC_GOVERNANCE_MINIMUM_SAMPLE.new_subject_decisions
    ? 'MINIMUM_ORGANIC_SAMPLE_REACHED'
    : 'INSUFFICIENT_OPERATIONAL_EVIDENCE'
}

export function semanticGovernanceRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 10_000) / 10_000
}
