export type ContentType = 'FACT' | 'EDITORIAL_COMPOSITE' | 'COMMUNITY_VOTE'
export type RankingType = 'editor_pick' | 'popularity' | 'quality' | 'purpose' | 'metric' | 'user_vote'
export type TaxonomyStatus = 'EXISTING' | 'PROPOSED'

export type FactSeed = readonly [
  title: string,
  basis: string,
  dimensions: readonly string[],
  referencePeriod: string,
]

export type EditorialSeed = readonly [
  title: string,
  editorialQuestion: string,
  dimensions: readonly string[],
]

export type VoteSeed = readonly [title: string, voteQuestion: string]

export type ContentFamilySeed = {
  familyId: string
  worldKey: string
  label: string
  categorySlug: string
  subcategorySlug: string | null
  taxonomyStatus: TaxonomyStatus
  candidateUniverseStrategy: string
  sourceKeys: readonly string[]
  contentRationale: string
  facts: readonly FactSeed[]
  editorials: readonly EditorialSeed[]
  votes: readonly VoteSeed[]
}

export type ContentCorpus200Ranking = {
  manifestId: string
  familyId: string
  title: string
  slug: string
  contentType: ContentType
  rankingType: RankingType
  categorySlug: string
  subcategorySlug: string | null
  taxonomyStatus: TaxonomyStatus
  editorialQuestion: string | null
  candidateUniverseStrategy: string
  rankingBasis: string
  sourceKeys: string[]
  sourceExtractionMode: 'SOURCE_MATERIALIZATION_REQUIRED' | 'CANDIDATE_ELIGIBILITY_SOURCE_REQUIRED'
  referencePeriod: string
  updateCadence: 'PERIODIC_OR_EVENT_DRIVEN' | 'EDITORIAL_REVIEW' | 'LIVE_AFTER_PUBLICATION'
  factDimensions: string[]
  compositeDimensions: Array<{ name: string; weightStatus: 'UNASSIGNED_PRE_MATERIALIZATION' }>
  compositeFormula: 'WEIGHTS_NOT_ASSIGNED_PRE_MATERIALIZATION' | null
  voteQuestion: string | null
  contentRationale: string
  semanticPlan: {
    subjectKey: string
    viewKey: string
    versionKey: string
  }
  publicationStatus: 'DRAFT_ONLY'
  entryMaterializationStatus: 'NOT_STARTED'
  algorithmEvaluationStatus: 'NOT_RUN'
  existingOverlapReview: 'REVIEW_REQUIRED'
}

export type ContentCorpus200Manifest = {
  manifestVersion: 'content-corpus-200-manifest-v1'
  status: 'CURATED_DRAFT_MANIFEST_PRE_MATERIALIZATION'
  authorityBoundary: {
    productionDatabaseWritesAuthorized: false
    publicPublicationAuthorized: false
    recommendationEvaluationAuthorized: false
    taxonomyMutationAuthorized: false
  }
  contentMix: {
    FACT: 60
    EDITORIAL_COMPOSITE: 90
    COMMUNITY_VOTE: 50
  }
  rankings: ContentCorpus200Ranking[]
}

function viewKey(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function editorialRankingType(title: string): RankingType {
  const purposeMarkers = ['좋은', '편한', '쉬운', '하기', '쓰기', '먹기', '고르기', '사람', '가족', '여행', '입문', '출퇴근', '사무실', '야식', '아침', '회사']
  return purposeMarkers.some((marker) => title.includes(marker)) ? 'purpose' : 'editor_pick'
}

export function materializeFamily(seed: ContentFamilySeed): ContentCorpus200Ranking[] {
  const rows: ContentCorpus200Ranking[] = []
  let sequence = 1

  for (const [title, basis, dimensions, referencePeriod] of seed.facts) {
    rows.push({
      manifestId: `cc200-${seed.familyId}-${String(sequence).padStart(2, '0')}`,
      familyId: seed.familyId,
      title,
      slug: `${seed.familyId}-${String(sequence).padStart(2, '0')}`,
      contentType: 'FACT',
      rankingType: 'metric',
      categorySlug: seed.categorySlug,
      subcategorySlug: seed.subcategorySlug,
      taxonomyStatus: seed.taxonomyStatus,
      editorialQuestion: null,
      candidateUniverseStrategy: seed.candidateUniverseStrategy,
      rankingBasis: basis,
      sourceKeys: [...seed.sourceKeys],
      sourceExtractionMode: 'SOURCE_MATERIALIZATION_REQUIRED',
      referencePeriod,
      updateCadence: 'PERIODIC_OR_EVENT_DRIVEN',
      factDimensions: [...dimensions],
      compositeDimensions: [],
      compositeFormula: null,
      voteQuestion: null,
      contentRationale: seed.contentRationale,
      semanticPlan: {
        subjectKey: seed.familyId,
        viewKey: viewKey(basis) || `fact-${sequence}`,
        versionKey: referencePeriod,
      },
      publicationStatus: 'DRAFT_ONLY',
      entryMaterializationStatus: 'NOT_STARTED',
      algorithmEvaluationStatus: 'NOT_RUN',
      existingOverlapReview: 'REVIEW_REQUIRED',
    })
    sequence += 1
  }

  for (const [title, editorialQuestion, dimensions] of seed.editorials) {
    rows.push({
      manifestId: `cc200-${seed.familyId}-${String(sequence).padStart(2, '0')}`,
      familyId: seed.familyId,
      title,
      slug: `${seed.familyId}-${String(sequence).padStart(2, '0')}`,
      contentType: 'EDITORIAL_COMPOSITE',
      rankingType: editorialRankingType(title),
      categorySlug: seed.categorySlug,
      subcategorySlug: seed.subcategorySlug,
      taxonomyStatus: seed.taxonomyStatus,
      editorialQuestion,
      candidateUniverseStrategy: seed.candidateUniverseStrategy,
      rankingBasis: 'Declared multi-dimension editorial composite; weights are authored and reviewed only after source materialization.',
      sourceKeys: [...seed.sourceKeys],
      sourceExtractionMode: 'SOURCE_MATERIALIZATION_REQUIRED',
      referencePeriod: 'CURRENT_FROZEN_AT_MATERIALIZATION',
      updateCadence: 'EDITORIAL_REVIEW',
      factDimensions: [],
      compositeDimensions: dimensions.map((name) => ({ name, weightStatus: 'UNASSIGNED_PRE_MATERIALIZATION' as const })),
      compositeFormula: 'WEIGHTS_NOT_ASSIGNED_PRE_MATERIALIZATION',
      voteQuestion: null,
      contentRationale: seed.contentRationale,
      semanticPlan: {
        subjectKey: seed.familyId,
        viewKey: `editorial-${String(sequence).padStart(2, '0')}`,
        versionKey: 'current',
      },
      publicationStatus: 'DRAFT_ONLY',
      entryMaterializationStatus: 'NOT_STARTED',
      algorithmEvaluationStatus: 'NOT_RUN',
      existingOverlapReview: 'REVIEW_REQUIRED',
    })
    sequence += 1
  }

  for (const [title, voteQuestion] of seed.votes) {
    rows.push({
      manifestId: `cc200-${seed.familyId}-${String(sequence).padStart(2, '0')}`,
      familyId: seed.familyId,
      title,
      slug: `${seed.familyId}-${String(sequence).padStart(2, '0')}`,
      contentType: 'COMMUNITY_VOTE',
      rankingType: 'user_vote',
      categorySlug: seed.categorySlug,
      subcategorySlug: seed.subcategorySlug,
      taxonomyStatus: seed.taxonomyStatus,
      editorialQuestion: voteQuestion,
      candidateUniverseStrategy: seed.candidateUniverseStrategy,
      rankingBasis: 'RankingWiki community vote; initial order must not fabricate vote counts.',
      sourceKeys: ['rankingwiki-community-vote', ...seed.sourceKeys.slice(0, 1)],
      sourceExtractionMode: 'CANDIDATE_ELIGIBILITY_SOURCE_REQUIRED',
      referencePeriod: 'OPEN_VOTE',
      updateCadence: 'LIVE_AFTER_PUBLICATION',
      factDimensions: [],
      compositeDimensions: [],
      compositeFormula: null,
      voteQuestion,
      contentRationale: seed.contentRationale,
      semanticPlan: {
        subjectKey: seed.familyId,
        viewKey: `vote-${String(sequence).padStart(2, '0')}`,
        versionKey: 'open',
      },
      publicationStatus: 'DRAFT_ONLY',
      entryMaterializationStatus: 'NOT_STARTED',
      algorithmEvaluationStatus: 'NOT_RUN',
      existingOverlapReview: 'REVIEW_REQUIRED',
    })
    sequence += 1
  }

  return rows
}
