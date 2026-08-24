import { createAdminClient } from '@/lib/supabase/admin'
import type { Rf1ShadowEvidenceRecord } from './rf1-shadow-evidence'

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
    rf1_exposures: number
    shadow_runs: number
  }
}

export async function recordRf1ShadowEvidence(record: Rf1ShadowEvidenceRecord) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('record_rf1_shadow_run', {
    p_record: {
      shadow_run_id: record.shadowRunId,
      current_ranking_id: record.currentRankingId,
      policy_bundle_version: record.policyBundleVersion,
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
