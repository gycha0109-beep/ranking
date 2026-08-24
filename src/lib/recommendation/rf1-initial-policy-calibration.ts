import {
  stableFingerprint,
  validateRf1PolicyBundle,
  type Rf1PolicyBundle,
} from './rf1-core'
import type { Rf1CalibrationFamily } from './rf1-calibration-evidence'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const RF1J_CALIBRATION_STATUS = 'SYNTHETICALLY_VALIDATED_CANDIDATE' as const

export type Rf1InitialPolicyCalibration = {
  calibrationStatus: typeof RF1J_CALIBRATION_STATUS
  shadowExecutionAuthorized: false
  productionActivationAuthorized: false
  capturedAt: string
  evidenceDocumentRefs: string[]
  observedCorpus: {
    publishedRankingCount: number
    categoryCount: number
    subcategoryCount: number
    rankingTypeCount: number
    maximumNeighborhoodCandidateCount: number
    totalUniqueViews: number
    rankingsWithUniqueViews: number
    maximumUniqueViews: number
    liveLikeCount: number
    liveBookmarkCount: number
    rf1ExposureCount: number
    durableShadowRunCount: number
    rawRelatedVisibilityObservationCount: number
  }
  rationaleByFamily: Record<Rf1CalibrationFamily, string>
  policy: Rf1PolicyBundle
  candidateFingerprint: string
}

const ZERO_LONG_TERM_EVENTS = {
  FEED_IMPRESSION: 0,
  RANKING_VIEW: 0,
  QUICK_SKIP: 0,
  DWELL: 0,
  RANKING_EXPAND: 0,
  DETAIL_OPEN: 0,
  RELATED_OPEN: 0,
  SAVE: 1,
  UNSAVE: -1,
  SHARE: 0,
  HIDE: 0,
} as const

const INITIAL_SESSION_EVENTS = {
  FEED_IMPRESSION: 0,
  RANKING_VIEW: 0.2,
  QUICK_SKIP: 0,
  DWELL: 0,
  RANKING_EXPAND: 0,
  DETAIL_OPEN: 0.35,
  RELATED_OPEN: 0.5,
  SAVE: 0.8,
  UNSAVE: -0.8,
  SHARE: 0,
  HIDE: 0,
} as const

const LONG_TERM_HALF_LIVES = {
  FEED_IMPRESSION: 45 * DAY,
  RANKING_VIEW: 45 * DAY,
  QUICK_SKIP: 45 * DAY,
  DWELL: 45 * DAY,
  RANKING_EXPAND: 45 * DAY,
  DETAIL_OPEN: 45 * DAY,
  RELATED_OPEN: 45 * DAY,
  SAVE: 45 * DAY,
  UNSAVE: 45 * DAY,
  SHARE: 45 * DAY,
  HIDE: 45 * DAY,
} as const

const SESSION_HALF_LIVES = {
  FEED_IMPRESSION: 30 * MINUTE,
  RANKING_VIEW: 30 * MINUTE,
  QUICK_SKIP: 30 * MINUTE,
  DWELL: 30 * MINUTE,
  RANKING_EXPAND: 30 * MINUTE,
  DETAIL_OPEN: 45 * MINUTE,
  RELATED_OPEN: 45 * MINUTE,
  SAVE: 60 * MINUTE,
  UNSAVE: 60 * MINUTE,
  SHARE: 60 * MINUTE,
  HIDE: 60 * MINUTE,
} as const

export const RF1_INITIAL_POLICY_CANDIDATE_V1: Rf1PolicyBundle = {
  policyBundleVersion: 'rf1j-initial-shadow-candidate-v1',
  profilePolicyVersion: 'rf1j-profile-v1',
  sessionPolicyVersion: 'rf1j-session-v1',
  scorePolicyVersion: 'rf1j-score-v1',
  diversityPolicyVersion: 'rf1j-diversity-v1',
  explorationPolicyVersion: 'rf1j-exploration-v1',
  behavior: {
    policyVersion: 'rf1j-profile-v1',
    lookbackMs: 90 * DAY,
    eventWeights: { ...ZERO_LONG_TERM_EVENTS },
    eventHalfLifeMs: { ...LONG_TERM_HALF_LIVES },
    saturationScale: 1.5,
    minimumSignalStrength: 0.05,
    maximumEvents: 200,
  },
  sessionBehavior: {
    policyVersion: 'rf1j-session-v1',
    lookbackMs: 2 * HOUR,
    eventWeights: { ...INITIAL_SESSION_EVENTS },
    eventHalfLifeMs: { ...SESSION_HALF_LIVES },
    saturationScale: 1,
    minimumSignalStrength: 0.03,
    maximumEvents: 100,
  },
  maturity: {
    policyVersion: 'rf1j-maturity-v1',
    emergingAcceptedEventThreshold: 2,
    establishedAcceptedEventThreshold: 5,
    establishedAbsoluteWeightThreshold: 3,
  },
  neighborhood: {
    policyVersion: 'rf1j-neighborhood-v1',
    tierBase: { A: 0.82, B: 0.7, C: 0.56, D: 0.42 },
    itemJaccardWeight: 0.7,
    lexicalJaccardWeight: 0.3,
  },
  score: {
    policyVersion: 'rf1j-score-v1',
    componentWeightsByMaturity: {
      EMPTY: { neighborhood: 0.7, interest: 0.05, freshness: 0.2, popularity: 0.05 },
      EMERGING: { neighborhood: 0.6, interest: 0.15, freshness: 0.2, popularity: 0.05 },
      ESTABLISHED: { neighborhood: 0.5, interest: 0.25, freshness: 0.2, popularity: 0.05 },
    },
    userProfileInterestShare: 0.75,
    sessionInterestShare: 0.25,
    freshnessHalfLifeMs: 30 * DAY,
    popularityMetricWeights: { uniqueViews: 0.2, likes: 0.3, bookmarks: 0.5 },
    popularityCompressionExponent: 0.5,
    lowExposureWindowMs: 7 * DAY,
    lowExposureThreshold: 3,
    lowExposureMaximumBoost: 0,
    lowExposureMinimumNeighborhoodScore: 0.56,
  },
  diversity: {
    policyVersion: 'rf1j-diversity-v1',
    windowSize: 3,
    caps: { category: 3, subcategory: 2, rankingType: 3 },
    relaxationOrder: ['rankingType', 'category', 'subcategory'],
    maxPromotionDistance: 1,
    maxDemotionDistance: 1,
  },
  exploration: {
    policyVersion: 'rf1j-exploration-v1',
    slotIndexes: [],
    maximumPromotions: 0,
    maxPromotionDistance: 0,
    minimumNeighborhoodScore: 0.7,
    minimumBaseScore: 0.55,
    minimumFreshnessScore: 0.3,
    positiveInterestBoundary: 0.25,
  },
}

const rationaleByFamily: Record<Rf1CalibrationFamily, string> = {
  behavior_aggregation: 'Long-term profile admission is limited to authenticated SAVE/UNSAVE evidence already backed by the RF-1C authority. Unsupported or not-yet-classified event semantics remain weight zero.',
  profile_maturity: 'Two accepted events permit an emerging profile while five accepted events plus material signed weight are required before established personalization receives the highest interest share.',
  neighborhood_scoring: 'Neighborhood remains the dominant relevance authority. A/B/C/D bases are strictly ordered and item overlap receives more weight than lexical overlap without changing Neighborhood admission thresholds.',
  component_scoring: 'Neighborhood dominates every maturity state; interest rises only with profile maturity while freshness remains secondary and sparse popularity receives a small bounded share.',
  freshness: 'The current publication span is narrow, so a thirty-day half-life prevents a few hours of publication timing from overwhelming topical relevance during the initial corpus stage.',
  popularity: 'Production views are extremely concentrated and likes/bookmarks are absent, so popularity is capped at five percent of component weight and logarithmically/compressively normalized by the RF-1 core.',
  low_exposure: 'No real RF-1 exposure/outcome evidence exists. The low-exposure mechanism stays structurally configured but its maximum boost is zero until evidence exists.',
  diversity: 'Current candidate depth is shallow and rankingType has only one observed value. Diversity movement is therefore bounded to one position with permissive caps instead of forcing unsupported variety.',
  exploration: 'No user-visible RF-1 exposure or attributed outcome evidence exists. Controlled exploration is explicitly disabled with zero promotions and no configured slots.',
}

const observedCorpus = {
  publishedRankingCount: 16,
  categoryCount: 6,
  subcategoryCount: 9,
  rankingTypeCount: 1,
  maximumNeighborhoodCandidateCount: 2,
  totalUniqueViews: 90,
  rankingsWithUniqueViews: 4,
  maximumUniqueViews: 87,
  liveLikeCount: 0,
  liveBookmarkCount: 0,
  rf1ExposureCount: 0,
  durableShadowRunCount: 0,
  rawRelatedVisibilityObservationCount: 0,
}

function validateEvidenceDocumentRefs(refs: string[]) {
  if (refs.length < 1) throw new Error('RF-1J calibration requires evidence document references')
  for (const [index, ref] of refs.entries()) {
    if (!ref || ref.trim() !== ref) throw new Error(`RF-1J evidenceDocumentRefs[${index}] must be a non-empty trimmed string`)
  }
  if (new Set(refs).size !== refs.length) throw new Error('RF-1J evidence document references must be unique')
}

export function buildRf1InitialPolicyCalibration(): Rf1InitialPolicyCalibration {
  const policy = validateRf1PolicyBundle(RF1_INITIAL_POLICY_CANDIDATE_V1)
  const evidenceDocumentRefs = [
    'docs/RF-1G_POLICY_CALIBRATION_EVIDENCE.md',
    'docs/RF-1I_RAW_RELATED_VISIBILITY_INSTRUMENTATION.md',
    'docs/RF-1J_INITIAL_POLICY_CALIBRATION.md',
  ]
  validateEvidenceDocumentRefs(evidenceDocumentRefs)

  const capturedAt = '2026-08-24T08:41:00.000Z'
  const fingerprintPayload = {
    domain: 'rankingwiki:rf1-initial-policy-calibration:v1',
    calibrationStatus: RF1J_CALIBRATION_STATUS,
    shadowExecutionAuthorized: false,
    productionActivationAuthorized: false,
    capturedAt,
    evidenceDocumentRefs,
    observedCorpus,
    rationaleByFamily,
    policy,
  }

  return {
    calibrationStatus: RF1J_CALIBRATION_STATUS,
    shadowExecutionAuthorized: false,
    productionActivationAuthorized: false,
    capturedAt,
    evidenceDocumentRefs: [...evidenceDocumentRefs],
    observedCorpus: { ...observedCorpus },
    rationaleByFamily: { ...rationaleByFamily },
    policy,
    candidateFingerprint: stableFingerprint(fingerprintPayload),
  }
}

export const RF1_INITIAL_POLICY_CALIBRATION_V1 = buildRf1InitialPolicyCalibration()
