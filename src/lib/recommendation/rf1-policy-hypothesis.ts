import {
  stableFingerprint,
  validateRf1PolicyBundle,
  type Rf1PolicyBundle,
} from './rf1-core'
import type { Rf1CalibrationFamily } from './rf1-calibration-evidence'

export const RF1_CALIBRATION_FAMILIES: Rf1CalibrationFamily[] = [
  'behavior_aggregation',
  'profile_maturity',
  'neighborhood_scoring',
  'component_scoring',
  'freshness',
  'popularity',
  'low_exposure',
  'diversity',
  'exploration',
]

export type Rf1ReviewedShadowPolicyHypothesis = {
  reviewStatus: 'REVIEWED_FOR_SHADOW_ONLY'
  productionActivationAuthorized: false
  reviewReference: string
  reviewedAt: string
  evidenceDocumentRefs: string[]
  rationaleByFamily: Record<Rf1CalibrationFamily, string>
  policy: Rf1PolicyBundle
}

export type Rf1ValidatedShadowPolicyHypothesis = Rf1ReviewedShadowPolicyHypothesis & {
  hypothesisFingerprint: string
}

function assertTrimmed(value: string, label: string) {
  if (!value || value.trim() !== value) {
    throw new Error(`${label} must be a non-empty trimmed string`)
  }
}

export function validateRf1ReviewedShadowPolicyHypothesis(
  hypothesis: Rf1ReviewedShadowPolicyHypothesis,
): Rf1ValidatedShadowPolicyHypothesis {
  if (!hypothesis || typeof hypothesis !== 'object') {
    throw new Error('RF-1H reviewed SHADOW policy hypothesis is required')
  }
  if (hypothesis.reviewStatus !== 'REVIEWED_FOR_SHADOW_ONLY') {
    throw new Error('RF-1H policy hypothesis must be reviewed for SHADOW only')
  }
  if (hypothesis.productionActivationAuthorized !== false) {
    throw new Error('RF-1H policy hypothesis cannot authorize production activation')
  }

  assertTrimmed(hypothesis.reviewReference, 'reviewReference')
  if (!Number.isFinite(Date.parse(hypothesis.reviewedAt))) {
    throw new Error('reviewedAt must be an ISO-compatible timestamp')
  }

  if (!Array.isArray(hypothesis.evidenceDocumentRefs) || hypothesis.evidenceDocumentRefs.length < 1) {
    throw new Error('RF-1H policy hypothesis requires at least one evidence document reference')
  }
  const evidenceDocumentRefs = hypothesis.evidenceDocumentRefs.map((reference, index) => {
    assertTrimmed(reference, `evidenceDocumentRefs[${index}]`)
    return reference
  })
  if (new Set(evidenceDocumentRefs).size !== evidenceDocumentRefs.length) {
    throw new Error('RF-1H evidence document references must be unique')
  }

  if (!hypothesis.rationaleByFamily || typeof hypothesis.rationaleByFamily !== 'object') {
    throw new Error('RF-1H policy hypothesis requires rationaleByFamily')
  }
  const rationaleByFamily = {} as Record<Rf1CalibrationFamily, string>
  for (const family of RF1_CALIBRATION_FAMILIES) {
    const rationale = hypothesis.rationaleByFamily[family]
    assertTrimmed(rationale, `rationaleByFamily.${family}`)
    rationaleByFamily[family] = rationale
  }

  const policy = validateRf1PolicyBundle(hypothesis.policy)
  const reviewedAt = new Date(hypothesis.reviewedAt).toISOString()
  const fingerprintPayload = {
    domain: 'rankingwiki:rf1-shadow-policy-hypothesis:v1',
    reviewStatus: 'REVIEWED_FOR_SHADOW_ONLY',
    productionActivationAuthorized: false,
    reviewReference: hypothesis.reviewReference,
    reviewedAt,
    evidenceDocumentRefs: [...evidenceDocumentRefs],
    rationaleByFamily,
    policy,
  }

  return {
    reviewStatus: 'REVIEWED_FOR_SHADOW_ONLY',
    productionActivationAuthorized: false,
    reviewReference: hypothesis.reviewReference,
    reviewedAt,
    evidenceDocumentRefs,
    rationaleByFamily,
    policy,
    hypothesisFingerprint: stableFingerprint(fingerprintPayload),
  }
}
