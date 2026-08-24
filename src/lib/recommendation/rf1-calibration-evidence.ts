export type Rf1ObservedTierCounts = {
  A: number
  B: number
  C: number
  D: number
}

export type Rf1ObservedIdentityCounts = {
  same_version: number
  same_view: number
  same_claim: number
  same_subject: number
}

export type Rf1CalibrationEvidenceSnapshot = {
  capturedAt: string
  publishedRankingCount: number
  categoryCount: number
  subcategoryCount: number
  rankingTypeCount: number
  publicationSpanHours: number
  oldestPublicationAgeHours: number
  newestPublicationAgeHours: number
  totalUniqueViews: number
  rankingsWithUniqueViews: number
  maximumUniqueViews: number
  topUniqueViewShare: number
  liveLikeCount: number
  liveBookmarkCount: number
  changedBookmarkEventCount: number
  changedBookmarkUserCount: number
  saveEventCount: number
  unsaveEventCount: number
  neighborhoodDirectedPairCount: number
  neighborhoodTierCounts: Rf1ObservedTierCounts
  sourcesWithNeighborhoodCandidate: number
  maximumNeighborhoodCandidateCount: number
  semanticEligibleProjectionCount: number
  semanticSharedSubjectCount: number
  identityDirectedPairCount: number
  identityRelationCounts: Rf1ObservedIdentityCounts
  productUsageEventCount: number
  relatedRankingClickCount: number
  rf1AttributedRelatedRankingClickCount: number
  rf1ExposureCount: number
  durableShadowRunCount: number
}

export type Rf1CalibrationFamily =
  | 'behavior_aggregation'
  | 'profile_maturity'
  | 'neighborhood_scoring'
  | 'component_scoring'
  | 'freshness'
  | 'popularity'
  | 'low_exposure'
  | 'diversity'
  | 'exploration'

export type Rf1CalibrationEvidenceState =
  | 'NO_DIRECT_EVIDENCE'
  | 'STRUCTURAL_EVIDENCE_ONLY'
  | 'LONGITUDINAL_EVIDENCE_REQUIRED'
  | 'OUTCOME_EVIDENCE_REQUIRED'

export type Rf1CalibrationFamilyAssessment = {
  family: Rf1CalibrationFamily
  state: Rf1CalibrationEvidenceState
  observedFacts: string[]
  unresolvedNumerics: string[]
}

export type Rf1CalibrationWorksheet = {
  capturedAt: string
  productionPolicyAuthorized: false
  automaticPolicyDerivation: 'FORBIDDEN'
  productionPolicyBundle: null
  directOutcomeEvidencePresent: boolean
  userVisibleExposureEvidencePresent: boolean
  durableShadowEvidencePresent: boolean
  observedNeighborhoodTiers: Array<keyof Rf1ObservedTierCounts>
  unobservedNeighborhoodTiers: Array<keyof Rf1ObservedTierCounts>
  observedPopularityChannels: Array<'uniqueViews' | 'likes' | 'bookmarks'>
  unobservedPopularityChannels: Array<'uniqueViews' | 'likes' | 'bookmarks'>
  structuralGaps: string[]
  assessments: Rf1CalibrationFamilyAssessment[]
}

function assertFiniteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number`)
  }
}

function assertCount(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`)
  }
}

function assertShare(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be within [0, 1]`)
  }
}

function validateSnapshot(snapshot: Rf1CalibrationEvidenceSnapshot) {
  if (!Number.isFinite(Date.parse(snapshot.capturedAt))) {
    throw new Error('capturedAt must be an ISO-compatible timestamp')
  }

  const countFields: Array<[number, string]> = [
    [snapshot.publishedRankingCount, 'publishedRankingCount'],
    [snapshot.categoryCount, 'categoryCount'],
    [snapshot.subcategoryCount, 'subcategoryCount'],
    [snapshot.rankingTypeCount, 'rankingTypeCount'],
    [snapshot.totalUniqueViews, 'totalUniqueViews'],
    [snapshot.rankingsWithUniqueViews, 'rankingsWithUniqueViews'],
    [snapshot.maximumUniqueViews, 'maximumUniqueViews'],
    [snapshot.liveLikeCount, 'liveLikeCount'],
    [snapshot.liveBookmarkCount, 'liveBookmarkCount'],
    [snapshot.changedBookmarkEventCount, 'changedBookmarkEventCount'],
    [snapshot.changedBookmarkUserCount, 'changedBookmarkUserCount'],
    [snapshot.saveEventCount, 'saveEventCount'],
    [snapshot.unsaveEventCount, 'unsaveEventCount'],
    [snapshot.neighborhoodDirectedPairCount, 'neighborhoodDirectedPairCount'],
    [snapshot.sourcesWithNeighborhoodCandidate, 'sourcesWithNeighborhoodCandidate'],
    [snapshot.maximumNeighborhoodCandidateCount, 'maximumNeighborhoodCandidateCount'],
    [snapshot.semanticEligibleProjectionCount, 'semanticEligibleProjectionCount'],
    [snapshot.semanticSharedSubjectCount, 'semanticSharedSubjectCount'],
    [snapshot.identityDirectedPairCount, 'identityDirectedPairCount'],
    [snapshot.productUsageEventCount, 'productUsageEventCount'],
    [snapshot.relatedRankingClickCount, 'relatedRankingClickCount'],
    [snapshot.rf1AttributedRelatedRankingClickCount, 'rf1AttributedRelatedRankingClickCount'],
    [snapshot.rf1ExposureCount, 'rf1ExposureCount'],
    [snapshot.durableShadowRunCount, 'durableShadowRunCount'],
  ]

  for (const [value, label] of countFields) assertCount(value, label)
  for (const [tier, count] of Object.entries(snapshot.neighborhoodTierCounts)) {
    assertCount(count, `neighborhoodTierCounts.${tier}`)
  }
  for (const [kind, count] of Object.entries(snapshot.identityRelationCounts)) {
    assertCount(count, `identityRelationCounts.${kind}`)
  }

  assertFiniteNonNegative(snapshot.publicationSpanHours, 'publicationSpanHours')
  assertFiniteNonNegative(snapshot.oldestPublicationAgeHours, 'oldestPublicationAgeHours')
  assertFiniteNonNegative(snapshot.newestPublicationAgeHours, 'newestPublicationAgeHours')
  assertShare(snapshot.topUniqueViewShare, 'topUniqueViewShare')

  if (snapshot.rankingsWithUniqueViews > snapshot.publishedRankingCount) {
    throw new Error('rankingsWithUniqueViews cannot exceed publishedRankingCount')
  }
  if (snapshot.maximumUniqueViews > snapshot.totalUniqueViews) {
    throw new Error('maximumUniqueViews cannot exceed totalUniqueViews')
  }
  if (snapshot.saveEventCount + snapshot.unsaveEventCount !== snapshot.changedBookmarkEventCount) {
    throw new Error('SAVE/UNSAVE counts must equal changedBookmarkEventCount')
  }
  if (Object.values(snapshot.neighborhoodTierCounts).reduce((sum, count) => sum + count, 0) !== snapshot.neighborhoodDirectedPairCount) {
    throw new Error('Neighborhood tier counts must equal neighborhoodDirectedPairCount')
  }
  if (Object.values(snapshot.identityRelationCounts).reduce((sum, count) => sum + count, 0) !== snapshot.identityDirectedPairCount) {
    throw new Error('identity relation counts must equal identityDirectedPairCount')
  }
  if (snapshot.rf1AttributedRelatedRankingClickCount > snapshot.relatedRankingClickCount) {
    throw new Error('RF-1-attributed related clicks cannot exceed all related-ranking clicks')
  }
}

function assessment(
  family: Rf1CalibrationFamily,
  state: Rf1CalibrationEvidenceState,
  observedFacts: string[],
  unresolvedNumerics: string[],
): Rf1CalibrationFamilyAssessment {
  return { family, state, observedFacts, unresolvedNumerics }
}

export function buildRf1CalibrationWorksheet(
  snapshot: Rf1CalibrationEvidenceSnapshot,
): Rf1CalibrationWorksheet {
  validateSnapshot(snapshot)

  const tierEntries = Object.entries(snapshot.neighborhoodTierCounts) as Array<[
    keyof Rf1ObservedTierCounts,
    number,
  ]>
  const observedNeighborhoodTiers = tierEntries.filter(([, count]) => count > 0).map(([tier]) => tier)
  const unobservedNeighborhoodTiers = tierEntries.filter(([, count]) => count === 0).map(([tier]) => tier)

  const popularityEntries: Array<['uniqueViews' | 'likes' | 'bookmarks', number]> = [
    ['uniqueViews', snapshot.totalUniqueViews],
    ['likes', snapshot.liveLikeCount],
    ['bookmarks', snapshot.liveBookmarkCount],
  ]
  const observedPopularityChannels = popularityEntries.filter(([, count]) => count > 0).map(([channel]) => channel)
  const unobservedPopularityChannels = popularityEntries.filter(([, count]) => count === 0).map(([channel]) => channel)

  const directOutcomeEvidencePresent = snapshot.rf1AttributedRelatedRankingClickCount > 0
  const userVisibleExposureEvidencePresent = snapshot.rf1ExposureCount > 0
  const durableShadowEvidencePresent = snapshot.durableShadowRunCount > 0

  const structuralGaps: string[] = []
  if (snapshot.rankingTypeCount <= 1) structuralGaps.push('SINGLE_RANKING_TYPE_OBSERVED')
  if (snapshot.maximumNeighborhoodCandidateCount === 0) structuralGaps.push('NO_NEIGHBORHOOD_CANDIDATE_DEPTH')
  if (unobservedNeighborhoodTiers.length > 0) {
    structuralGaps.push(`UNOBSERVED_NEIGHBORHOOD_TIERS:${unobservedNeighborhoodTiers.join(',')}`)
  }
  if (unobservedPopularityChannels.length > 0) {
    structuralGaps.push(`UNOBSERVED_LIVE_POPULARITY_CHANNELS:${unobservedPopularityChannels.join(',')}`)
  }
  if (!userVisibleExposureEvidencePresent) structuralGaps.push('NO_RF1_USER_VISIBLE_EXPOSURE')
  if (!directOutcomeEvidencePresent) structuralGaps.push('NO_RF1_ATTRIBUTED_RELATED_OUTCOME')
  if (!durableShadowEvidencePresent) structuralGaps.push('NO_DURABLE_RF1_SHADOW_RUN')

  const assessments: Rf1CalibrationFamilyAssessment[] = [
    assessment(
      'behavior_aggregation',
      snapshot.changedBookmarkEventCount > 0
        ? 'LONGITUDINAL_EVIDENCE_REQUIRED'
        : 'NO_DIRECT_EVIDENCE',
      [
        `changed SAVE/UNSAVE events=${snapshot.changedBookmarkEventCount}`,
        `authenticated users with changed bookmark evidence=${snapshot.changedBookmarkUserCount}`,
      ],
      ['lookbackMs', 'eventWeights', 'eventHalfLifeMs', 'saturationScale', 'minimumSignalStrength', 'maximumEvents'],
    ),
    assessment(
      'profile_maturity',
      snapshot.changedBookmarkEventCount > 0
        ? 'LONGITUDINAL_EVIDENCE_REQUIRED'
        : 'NO_DIRECT_EVIDENCE',
      [
        `changed SAVE events=${snapshot.saveEventCount}`,
        `changed UNSAVE events=${snapshot.unsaveEventCount}`,
      ],
      ['emergingAcceptedEventThreshold', 'establishedAcceptedEventThreshold', 'establishedAbsoluteWeightThreshold'],
    ),
    assessment(
      'neighborhood_scoring',
      snapshot.neighborhoodDirectedPairCount > 0
        ? 'OUTCOME_EVIDENCE_REQUIRED'
        : 'NO_DIRECT_EVIDENCE',
      [
        `directed Neighborhood pairs=${snapshot.neighborhoodDirectedPairCount}`,
        `observed tiers=${observedNeighborhoodTiers.join(',') || 'none'}`,
        `maximum candidates from one source=${snapshot.maximumNeighborhoodCandidateCount}`,
      ],
      ['tierBase.A', 'tierBase.B', 'tierBase.C', 'tierBase.D', 'itemJaccardWeight', 'lexicalJaccardWeight'],
    ),
    assessment(
      'component_scoring',
      directOutcomeEvidencePresent
        ? 'OUTCOME_EVIDENCE_REQUIRED'
        : 'NO_DIRECT_EVIDENCE',
      [
        `RF-1-attributed related outcomes=${snapshot.rf1AttributedRelatedRankingClickCount}`,
        `RF-1 user-visible exposures=${snapshot.rf1ExposureCount}`,
      ],
      [
        'componentWeightsByMaturity.EMPTY',
        'componentWeightsByMaturity.EMERGING',
        'componentWeightsByMaturity.ESTABLISHED',
        'userProfileInterestShare',
        'sessionInterestShare',
      ],
    ),
    assessment(
      'freshness',
      directOutcomeEvidencePresent
        ? 'OUTCOME_EVIDENCE_REQUIRED'
        : 'STRUCTURAL_EVIDENCE_ONLY',
      [
        `publication span hours=${snapshot.publicationSpanHours}`,
        `oldest publication age hours=${snapshot.oldestPublicationAgeHours}`,
        `newest publication age hours=${snapshot.newestPublicationAgeHours}`,
      ],
      ['freshnessHalfLifeMs'],
    ),
    assessment(
      'popularity',
      directOutcomeEvidencePresent
        ? 'OUTCOME_EVIDENCE_REQUIRED'
        : 'STRUCTURAL_EVIDENCE_ONLY',
      [
        `total unique views=${snapshot.totalUniqueViews}`,
        `rankings with non-zero unique views=${snapshot.rankingsWithUniqueViews}`,
        `maximum unique views=${snapshot.maximumUniqueViews}`,
        `top unique-view share=${snapshot.topUniqueViewShare}`,
        `live likes=${snapshot.liveLikeCount}`,
        `live bookmarks=${snapshot.liveBookmarkCount}`,
      ],
      ['popularityMetricWeights.uniqueViews', 'popularityMetricWeights.likes', 'popularityMetricWeights.bookmarks', 'popularityCompressionExponent'],
    ),
    assessment(
      'low_exposure',
      userVisibleExposureEvidencePresent
        ? 'OUTCOME_EVIDENCE_REQUIRED'
        : 'NO_DIRECT_EVIDENCE',
      [
        `RF-1 user-visible exposures=${snapshot.rf1ExposureCount}`,
        `RF-1-attributed related outcomes=${snapshot.rf1AttributedRelatedRankingClickCount}`,
      ],
      ['lowExposureWindowMs', 'lowExposureThreshold', 'lowExposureMaximumBoost', 'lowExposureMinimumNeighborhoodScore'],
    ),
    assessment(
      'diversity',
      'STRUCTURAL_EVIDENCE_ONLY',
      [
        `distinct categories=${snapshot.categoryCount}`,
        `distinct subcategories=${snapshot.subcategoryCount}`,
        `distinct ranking types=${snapshot.rankingTypeCount}`,
        `maximum Neighborhood candidates from one source=${snapshot.maximumNeighborhoodCandidateCount}`,
      ],
      ['windowSize', 'caps.category', 'caps.subcategory', 'caps.rankingType', 'relaxationOrder', 'maxPromotionDistance', 'maxDemotionDistance'],
    ),
    assessment(
      'exploration',
      directOutcomeEvidencePresent && userVisibleExposureEvidencePresent
        ? 'OUTCOME_EVIDENCE_REQUIRED'
        : 'NO_DIRECT_EVIDENCE',
      [
        `maximum Neighborhood candidates from one source=${snapshot.maximumNeighborhoodCandidateCount}`,
        `RF-1 user-visible exposures=${snapshot.rf1ExposureCount}`,
        `RF-1-attributed related outcomes=${snapshot.rf1AttributedRelatedRankingClickCount}`,
      ],
      ['slotIndexes', 'maximumPromotions', 'maxPromotionDistance', 'minimumNeighborhoodScore', 'minimumBaseScore', 'minimumFreshnessScore', 'positiveInterestBoundary'],
    ),
  ]

  return {
    capturedAt: new Date(snapshot.capturedAt).toISOString(),
    productionPolicyAuthorized: false,
    automaticPolicyDerivation: 'FORBIDDEN',
    productionPolicyBundle: null,
    directOutcomeEvidencePresent,
    userVisibleExposureEvidencePresent,
    durableShadowEvidencePresent,
    observedNeighborhoodTiers,
    unobservedNeighborhoodTiers,
    observedPopularityChannels,
    unobservedPopularityChannels,
    structuralGaps,
    assessments,
  }
}
