import { createAdminClient } from '@/lib/supabase/admin'
import type { Rf1BehaviorEvent } from './rf1-core'
import {
  validateRf1ReviewedShadowPolicyHypothesis,
  type Rf1ReviewedShadowPolicyHypothesis,
} from './rf1-policy-hypothesis'
import { createRf1ShadowEvidenceRecord, type Rf1ShadowEvidenceRecord } from './rf1-shadow-evidence'
import { runRf1RelatedShadow, type Rf1ShadowResult } from './rf1-shadow'

export type Rf1CalibrationEvidenceSummary = {
  verdict: 'NOT_READY' | 'EVIDENCE_PRESENT_REVIEW_REQUIRED'
  production_policy_authorized: false
  automatic_authorization: 'FORBIDDEN'
  blockers: string[]
  dimensions: {
    shadow_order_evidence: 'MISSING' | 'PRESENT_REVIEW_REQUIRED'
    authenticated_profile_evidence: 'MISSING' | 'PRESENT_REVIEW_REQUIRED'
    related_outcome_evidence: 'MISSING' | 'PRESENT_REVIEW_REQUIRED'
    low_exposure_evidence: 'MISSING' | 'PRESENT_REVIEW_REQUIRED'
  }
  counts: {
    published_rankings: number
    changed_bookmark_events: number
    bookmark_users: number
    product_usage_events: number
    related_ranking_clicks: number
    rf1_attributed_related_ranking_clicks: number
    rf1_exposures: number
    shadow_runs: number
  }
}

export type Rf1ShadowCaptureResult = {
  policyHypothesisFingerprint: string
  shadow: Rf1ShadowResult
  evidence: Rf1ShadowEvidenceRecord
  persistence: unknown
  readiness: Rf1CalibrationEvidenceSummary
}

export async function recordRf1ShadowEvidence(record: Rf1ShadowEvidenceRecord) {
  if (record.candidateCount < 1) {
    throw new Error('RF-1F durable SHADOW evidence requires at least one candidate')
  }
  if (record.baselineRankingIds.includes(record.currentRankingId) || record.shadowRankingIds.includes(record.currentRankingId)) {
    throw new Error('RF-1F durable SHADOW evidence must exclude the source ranking from candidate orderings')
  }
  if (!record.policyHypothesisFingerprint || record.policyHypothesisFingerprint.trim() !== record.policyHypothesisFingerprint) {
    throw new Error('RF-1H durable SHADOW evidence requires a reviewed policy hypothesis fingerprint')
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('record_rf1_shadow_run', {
    p_record: {
      shadow_run_id: record.shadowRunId,
      current_ranking_id: record.currentRankingId,
      policy_bundle_version: record.policyBundleVersion,
      policy_hypothesis_fingerprint: record.policyHypothesisFingerprint,
      profile_maturity: record.profileMaturity,
      profile_fingerprint: record.profileFingerprint,
      session_fingerprint: record.sessionFingerprint,
      reference_time: record.referenceTime,
      seed: record.seed,
      baseline_ranking_ids: record.baselineRankingIds,
      shadow_ranking_ids: record.shadowRankingIds,
      candidate_count: record.candidateCount,
      changed_position_count: record.changedPositionCount,
      protected_identity_count: record.protectedIdentityCount,
    },
  })
  if (error) throw new Error(`failed to persist RF-1 shadow evidence: ${error.message}`)
  return data
}

export async function getRf1CalibrationEvidenceSummary(): Promise<Rf1CalibrationEvidenceSummary> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_rf1_calibration_evidence_summary')
  if (error) throw new Error(`failed to read RF-1 calibration evidence summary: ${error.message}`)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid RF-1 calibration evidence summary shape')
  return data as unknown as Rf1CalibrationEvidenceSummary
}

/**
 * Server-only evidence harness.
 *
 * Durable SHADOW evidence requires an explicitly reviewed SHADOW-only policy
 * hypothesis. The hypothesis contains the complete caller-supplied RF-1 policy,
 * per-family rationale, evidence-document references, and a deterministic
 * fingerprint of the actual numeric policy content. It cannot authorize public
 * activation. No default production tuning values are embedded here.
 */
export async function runAndRecordRf1RelatedShadowEvidence(input: {
  currentRanking: any
  referenceTime: string
  seed: string
  hypothesis: Rf1ReviewedShadowPolicyHypothesis
  sessionEvents?: Rf1BehaviorEvent[]
  profileEventLimit?: number
}): Promise<Rf1ShadowCaptureResult> {
  const reviewedHypothesis = validateRf1ReviewedShadowPolicyHypothesis(input.hypothesis)
  const shadow = await runRf1RelatedShadow({
    currentRanking: input.currentRanking,
    referenceTime: input.referenceTime,
    seed: input.seed,
    policy: reviewedHypothesis.policy,
    sessionEvents: input.sessionEvents,
    profileEventLimit: input.profileEventLimit,
  })
  if (shadow.candidateCount < 1) {
    throw new Error('RF-1F will not persist an empty SHADOW candidate ordering as evidence')
  }

  if (shadow.policyBundleVersion !== reviewedHypothesis.policy.policyBundleVersion) {
    throw new Error('RF-1H SHADOW result policy version must match the reviewed hypothesis')
  }

  const evidence = createRf1ShadowEvidenceRecord(
    shadow,
    reviewedHypothesis.hypothesisFingerprint,
  )
  const persistence = await recordRf1ShadowEvidence(evidence)
  const readiness = await getRf1CalibrationEvidenceSummary()

  return {
    policyHypothesisFingerprint: reviewedHypothesis.hypothesisFingerprint,
    shadow,
    evidence,
    persistence,
    readiness,
  }
}
