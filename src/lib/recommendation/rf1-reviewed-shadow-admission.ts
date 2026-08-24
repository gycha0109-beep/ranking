import { stableFingerprint } from './rf1-core'
import { RF1_INITIAL_POLICY_CALIBRATION_V1 } from './rf1-initial-policy-calibration'
import {
  validateRf1ReviewedShadowPolicyHypothesis,
  type Rf1ValidatedShadowPolicyHypothesis,
} from './rf1-policy-hypothesis'

export const RF1K_ADMISSION_STATUS = 'APPROVED_FOR_DURABLE_SHADOW' as const

export type Rf1ReviewedShadowAdmission = {
  admissionStatus: typeof RF1K_ADMISSION_STATUS
  shadowExecutionAuthorized: true
  productionActivationAuthorized: false
  sourceCalibrationFingerprint: string
  reviewReference: string
  reviewedAt: string
  hypothesis: Rf1ValidatedShadowPolicyHypothesis
  admissionFingerprint: string
}

export function buildRf1ReviewedShadowAdmission(): Rf1ReviewedShadowAdmission {
  const calibration = RF1_INITIAL_POLICY_CALIBRATION_V1

  if (calibration.calibrationStatus !== 'SYNTHETICALLY_VALIDATED_CANDIDATE') {
    throw new Error('RF-1K requires the RF-1J synthetically validated policy candidate')
  }
  if (calibration.shadowExecutionAuthorized !== false) {
    throw new Error('RF-1K source calibration must remain non-authorizing')
  }
  if (calibration.productionActivationAuthorized !== false) {
    throw new Error('RF-1K source calibration cannot authorize production activation')
  }

  const reviewReference = 'rf1k-explicit-project-review-v1'
  const reviewedAt = '2026-08-24T08:54:00.000Z'
  const evidenceDocumentRefs = [
    ...calibration.evidenceDocumentRefs,
    'docs/RF-1K_REVIEWED_SHADOW_ADMISSION.md',
  ]

  const hypothesis = validateRf1ReviewedShadowPolicyHypothesis({
    reviewStatus: 'REVIEWED_FOR_SHADOW_ONLY',
    productionActivationAuthorized: false,
    reviewReference,
    reviewedAt,
    evidenceDocumentRefs,
    rationaleByFamily: { ...calibration.rationaleByFamily },
    policy: calibration.policy,
  })

  if (hypothesis.policy.policyBundleVersion !== calibration.policy.policyBundleVersion) {
    throw new Error('RF-1K reviewed policy must exactly retain the RF-1J policy bundle version')
  }

  const fingerprintPayload = {
    domain: 'rankingwiki:rf1-shadow-admission:v1',
    admissionStatus: RF1K_ADMISSION_STATUS,
    shadowExecutionAuthorized: true,
    productionActivationAuthorized: false,
    sourceCalibrationFingerprint: calibration.candidateFingerprint,
    reviewReference,
    reviewedAt: hypothesis.reviewedAt,
    hypothesisFingerprint: hypothesis.hypothesisFingerprint,
  }

  return {
    admissionStatus: RF1K_ADMISSION_STATUS,
    shadowExecutionAuthorized: true,
    productionActivationAuthorized: false,
    sourceCalibrationFingerprint: calibration.candidateFingerprint,
    reviewReference,
    reviewedAt: hypothesis.reviewedAt,
    hypothesis,
    admissionFingerprint: stableFingerprint(fingerprintPayload),
  }
}

export const RF1_REVIEWED_SHADOW_ADMISSION_V1 = buildRf1ReviewedShadowAdmission()
