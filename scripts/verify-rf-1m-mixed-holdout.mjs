import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const corpusPath = path.join(root, 'src/lib/recommendation/rf1m-mixed-holdout-corpus.ts')
const corePath = path.join(root, 'src/lib/recommendation/rf1-core.ts')
const neighborhoodPath = path.join(root, 'src/lib/ranking-neighborhood.ts')
const identityPath = path.join(root, 'src/lib/ranking-identity.ts')
const policyPath = path.join(root, 'src/lib/recommendation/rf1-initial-policy-calibration.ts')
const publicPagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')

const EXPECTED_CORPUS_SHA256 = '90925ae61ff1978e5c8dd873fb4314d46b2e56faec2ceb7e8b9241fadf4edfda'

function fail(message) {
  console.error(`RF-1M evaluation contract failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

for (const requiredPath of [corpusPath, corePath, neighborhoodPath, identityPath, policyPath, publicPagePath]) {
  assert(fs.existsSync(requiredPath), `${path.relative(root, requiredPath)} must exist`)
}

const corpusSource = fs.readFileSync(corpusPath, 'utf8')
const coreSource = fs.readFileSync(corePath, 'utf8')
const neighborhoodSource = fs.readFileSync(neighborhoodPath, 'utf8')
const identitySourceText = fs.readFileSync(identityPath, 'utf8')
const policySource = fs.readFileSync(policyPath, 'utf8')
const publicPageSource = fs.readFileSync(publicPagePath, 'utf8')

assert(!publicPageSource.includes('rf1m-mixed-holdout-corpus'), 'public ranking page must not import RF-1M corpus')
assert(!publicPageSource.includes('verify-rf-1m-mixed-holdout'), 'public ranking page must not import RF-1M evaluator')
assert(!publicPageSource.includes('RF1M_MIXED_HOLDOUT_CORPUS_V1'), 'public ranking page must not consume RF-1M corpus')

function transpile(source, fileName) {
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      strict: true,
    },
    fileName,
  }).outputText
}

function dataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}

const corpusUrl = dataUrl(transpile(corpusSource, corpusPath))
const coreUrl = dataUrl(transpile(coreSource, corePath))
const neighborhoodUrl = dataUrl(transpile(neighborhoodSource, neighborhoodPath))
const identityUrl = dataUrl(transpile(identitySourceText, identityPath))
let policyJs = transpile(policySource, policyPath)
policyJs = policyJs.replace(/from\s+['"]\.\/rf1-core['"]/, `from '${coreUrl}'`)
const policyUrl = dataUrl(policyJs)

const [corpusModule, coreModule, neighborhoodModule, identityModule, policyModule] = await Promise.all([
  import(corpusUrl),
  import(coreUrl),
  import(neighborhoodUrl),
  import(identityUrl),
  import(policyUrl),
])

const corpus = corpusModule.buildRf1mMixedHoldoutCorpus()
const corpusSha256 = crypto.createHash('sha256').update(JSON.stringify(corpus.rankings)).digest('hex')
assert(corpusSha256 === EXPECTED_CORPUS_SHA256, `frozen corpus hash mismatch: expected ${EXPECTED_CORPUS_SHA256}, observed ${corpusSha256}`)
assert(corpus.rankings.length === 229, 'frozen corpus ranking count must remain 229')
assert(corpus.worldCount === 26, 'frozen corpus world count must remain 26')

const policy = coreModule.validateRf1PolicyBundle(policyModule.RF1_INITIAL_POLICY_CANDIDATE_V1)
assert(policy.policyBundleVersion === 'rf1j-initial-shadow-candidate-v1', 'RF-1M must replay the admitted RF-1J candidate policy')
assert(policy.score.lowExposureMaximumBoost === 0, 'RF-1M must not invent low-exposure authority')
assert(policy.exploration.maximumPromotions === 0, 'RF-1M must not invent exploration authority')

const emptyProfile = coreModule.buildRf1BehaviorProfile([], corpus.referenceTime, policy.behavior, policy.maturity)
assert(emptyProfile.maturity === 'EMPTY', 'first RF-1M distribution replay must use EMPTY profile')

function node(row) {
  return {
    id: row.id,
    categoryId: row.categoryId,
    subcategoryId: row.subcategoryId,
    title: row.title,
    itemIds: row.itemIds,
    publishedAt: row.publishedAt,
  }
}

function relatedRows(source, universe) {
  const sourceNode = node(source)
  const rows = []

  for (const candidate of universe) {
    if (candidate.id === source.id) continue
    const relation = neighborhoodModule.classifyRankingNeighbor(sourceNode, node(candidate))
    const identityRelation = identityModule.classifyRankingIdentity(source.semanticProjection, candidate.semanticProjection)
    if (!relation && !identityRelation) continue
    rows.push({ candidate, relation, identityRelation })
  }

  rows.sort((left, right) => {
    if (left.identityRelation && right.identityRelation) {
      const identityOrder = identityModule.compareRankingIdentityRelations(left.identityRelation, right.identityRelation)
      if (identityOrder !== 0) return identityOrder
      if (left.relation && right.relation) {
        const neighborOrder = neighborhoodModule.compareRankingNeighbors(left.relation, right.relation)
        if (neighborOrder !== 0) return neighborOrder
      } else if (left.relation) {
        return -1
      } else if (right.relation) {
        return 1
      }
      return left.candidate.id.localeCompare(right.candidate.id)
    }

    if (left.identityRelation) return -1
    if (right.identityRelation) return 1

    if (left.relation && right.relation) {
      const neighborOrder = neighborhoodModule.compareRankingNeighbors(left.relation, right.relation)
      if (neighborOrder !== 0) return neighborOrder
    } else if (left.relation) {
      return -1
    } else if (right.relation) {
      return 1
    }

    return left.candidate.id.localeCompare(right.candidate.id)
  })

  return rows.slice(0, neighborhoodModule.RELATED_RANKING_LIMIT)
}

function rankSource(source, universe) {
  const related = relatedRows(source, universe)
  const protectedRows = related.filter((row) => row.identityRelation)
  const contextualRows = related.filter((row) => !row.identityRelation)
  const baselineIds = related.map((row) => row.candidate.id)

  assert(related.slice(0, protectedRows.length).every((row) => row.identityRelation), `IA-2 protected prefix must be contiguous for ${source.id}`)
  assert(related.slice(protectedRows.length).every((row) => !row.identityRelation), `contextual suffix must follow protected prefix for ${source.id}`)
  assert(contextualRows.every((row) => row.relation), `contextual candidates must carry Neighborhood evidence for ${source.id}`)

  if (contextualRows.length === 0) {
    return {
      source,
      related,
      protectedRows,
      contextualRows,
      baselineIds,
      finalIds: [...baselineIds],
      rankedContextual: [],
      changedPositionCount: 0,
      top1Changed: false,
      contextualTop1Changed: false,
    }
  }

  const candidates = contextualRows.map(({ candidate, relation }) => ({
    rankingId: candidate.id,
    categoryId: candidate.categoryId,
    subcategoryId: candidate.subcategoryId,
    rankingType: candidate.rankingType,
    itemIds: candidate.itemIds,
    publishedAt: candidate.publishedAt,
    neighborhood: {
      tier: relation.tier,
      itemJaccard: relation.itemJaccard,
      lexicalJaccard: relation.lexicalJaccard,
    },
    uniqueViewCount: candidate.uniqueViewCount,
    likeCount: candidate.likeCount,
    bookmarkCount: candidate.bookmarkCount,
    recentExposureCount: candidate.recentExposureCount,
  }))

  const ranked = coreModule.rankRf1Feed({
    candidates,
    profile: emptyProfile,
    session: null,
    referenceTime: corpus.referenceTime,
    seed: `rf1m:${source.id}`,
    policy,
  })

  assert(ranked.policyBundleVersion === policy.policyBundleVersion, `policy version drift for ${source.id}`)
  assert(ranked.profileFingerprint === emptyProfile.fingerprint, `profile fingerprint drift for ${source.id}`)
  assert(ranked.sessionFingerprint === null, `first replay must not invent a session for ${source.id}`)
  assert(ranked.candidates.every((row) => row.explored === false), `exploration must remain disabled for ${source.id}`)
  assert(ranked.candidates.every((row) => row.breakdown.lowExposureBoost === 0), `low-exposure boost must remain disabled for ${source.id}`)

  for (const row of ranked.candidates) {
    for (const value of [
      row.breakdown.neighborhoodScore,
      row.breakdown.interestScore,
      row.breakdown.freshnessScore,
      row.breakdown.popularityScore,
      row.breakdown.lowExposureBoost,
      row.breakdown.baseScore,
      row.breakdown.finalScore,
    ]) {
      assert(Number.isFinite(value) && value >= 0 && value <= 1, `RF-1 score must remain finite in [0,1] for ${source.id}`)
    }
  }

  const finalIds = [
    ...protectedRows.map((row) => row.candidate.id),
    ...ranked.candidates.map((row) => row.rankingId),
  ]

  assert(finalIds.length === baselineIds.length, `candidate count must be preserved for ${source.id}`)
  assert([...finalIds].sort().join('|') === [...baselineIds].sort().join('|'), `candidate set must be preserved for ${source.id}`)
  assert(protectedRows.every((row, index) => finalIds[index] === row.candidate.id), `IA-2 prefix must not move for ${source.id}`)

  const changedPositionCount = baselineIds.reduce((count, id, index) => count + (finalIds[index] === id ? 0 : 1), 0)
  const contextualBaseline = contextualRows.map((row) => row.candidate.id)
  const contextualFinal = ranked.candidates.map((row) => row.rankingId)

  return {
    source,
    related,
    protectedRows,
    contextualRows,
    baselineIds,
    finalIds,
    rankedContextual: ranked.candidates,
    changedPositionCount,
    top1Changed: baselineIds[0] !== finalIds[0],
    contextualTop1Changed: contextualBaseline[0] !== contextualFinal[0],
  }
}

function quantile(values, ratio) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1))
  return sorted[index]
}

function round(value, digits = 4) {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

const runs = corpus.rankings.map((source) => rankSource(source, corpus.rankings))

// Input order is not authority. Reversing the frozen universe must preserve both
// discovery order and RF-1 output for every source.
for (const source of corpus.rankings) {
  const normal = rankSource(source, corpus.rankings)
  const reversed = rankSource(source, [...corpus.rankings].reverse())
  assert(normal.baselineIds.join('|') === reversed.baselineIds.join('|'), `related discovery must be input-order independent for ${source.id}`)
  assert(normal.finalIds.join('|') === reversed.finalIds.join('|'), `RF-1 output must be input-order independent for ${source.id}`)
}

const depths = runs.map((run) => run.related.length)
const contextualDepths = runs.map((run) => run.contextualRows.length)
const movements = []
const tierCounts = { A: 0, B: 0, C: 0, D: 0 }
const identityCounts = { same_version: 0, same_view: 0, same_claim: 0, same_subject: 0 }
const depthBuckets = { zero: 0, oneToTwo: 0, threeToFive: 0, six: 0 }
const admittedRankingTypes = { metric: 0, user_vote: 0 }
let protectedPositions = 0
let contextualPositions = 0
let changedPositions = 0
let diversityRelaxations = 0

for (const run of runs) {
  const depth = run.related.length
  if (depth === 0) depthBuckets.zero += 1
  else if (depth <= 2) depthBuckets.oneToTwo += 1
  else if (depth <= 5) depthBuckets.threeToFive += 1
  else depthBuckets.six += 1

  protectedPositions += run.protectedRows.length
  contextualPositions += run.contextualRows.length
  changedPositions += run.changedPositionCount

  for (const row of run.protectedRows) {
    identityCounts[row.identityRelation.kind] += 1
  }

  for (const row of run.contextualRows) {
    tierCounts[row.relation.tier] += 1
    admittedRankingTypes[row.candidate.rankingType] += 1
  }

  for (const candidate of run.rankedContextual) {
    diversityRelaxations += candidate.appliedRelaxations.length
    const before = run.baselineIds.indexOf(candidate.rankingId)
    const after = run.finalIds.indexOf(candidate.rankingId)
    movements.push(Math.abs(after - before))
  }
}

const worldObservations = [...new Set(corpus.rankings.map((row) => row.worldKey))]
  .sort()
  .map((worldKey) => {
    const worldRuns = runs.filter((run) => run.source.worldKey === worldKey)
    return {
      worldKey,
      sources: worldRuns.length,
      zeroCandidateSources: worldRuns.filter((run) => run.related.length === 0).length,
      candidatePositions: worldRuns.reduce((sum, run) => sum + run.related.length, 0),
      contextualPositions: worldRuns.reduce((sum, run) => sum + run.contextualRows.length, 0),
      sourcesWithReorder: worldRuns.filter((run) => run.changedPositionCount > 0).length,
    }
  })

const report = {
  stage: 'RF-1M_INDEPENDENT_MIXED_HOLDOUT_FIRST_OBSERVATION',
  corpus: {
    corpusId: corpus.corpusId,
    corpusSha256,
    totalRankings: corpus.rankings.length,
    worldCount: corpus.worldCount,
    generatorSeed: corpus.generatorSeed,
  },
  policy: {
    policyBundleVersion: policy.policyBundleVersion,
    profilePolicyVersion: policy.profilePolicyVersion,
    sessionPolicyVersion: policy.sessionPolicyVersion,
    scorePolicyVersion: policy.scorePolicyVersion,
    diversityPolicyVersion: policy.diversityPolicyVersion,
    explorationPolicyVersion: policy.explorationPolicyVersion,
    profileMaturity: emptyProfile.maturity,
    lowExposureMaximumBoost: policy.score.lowExposureMaximumBoost,
    explorationMaximumPromotions: policy.exploration.maximumPromotions,
  },
  discovery: {
    sourceCount: runs.length,
    sourcesWithCandidates: runs.filter((run) => run.related.length > 0).length,
    candidatePositions: depths.reduce((sum, value) => sum + value, 0),
    candidateDepthBuckets: depthBuckets,
    candidateDepth: {
      min: Math.min(...depths),
      p50: quantile(depths, 0.5),
      p90: quantile(depths, 0.9),
      max: Math.max(...depths),
    },
    contextualDepth: {
      min: Math.min(...contextualDepths),
      p50: quantile(contextualDepths, 0.5),
      p90: quantile(contextualDepths, 0.9),
      max: Math.max(...contextualDepths),
    },
    protectedPositions,
    contextualPositions,
    identityRelationCounts: identityCounts,
    contextualTierCounts: tierCounts,
    contextualRankingTypeCounts: admittedRankingTypes,
  },
  reranking: {
    sourcesWithReorder: runs.filter((run) => run.changedPositionCount > 0).length,
    changedPositions,
    wholeListTop1Changes: runs.filter((run) => run.top1Changed).length,
    contextualTop1Changes: runs.filter((run) => run.contextualTop1Changed).length,
    movement: {
      averageAbsolute: movements.length ? round(movements.reduce((sum, value) => sum + value, 0) / movements.length) : 0,
      p90Absolute: quantile(movements, 0.9),
      maxAbsolute: movements.length ? Math.max(...movements) : 0,
    },
    diversityRelaxations,
  },
  worldObservations,
  interpretationBoundary: {
    firstObservationPredeclaredPerformanceGate: 'NONE',
    corpusMutatedAfterObservation: false,
    policyTuningPerformed: false,
    organicEvidenceClaimed: false,
    productionActivationAuthorized: false,
  },
}

console.log('RF-1M independent mixed holdout first observation:')
console.log(JSON.stringify(report, null, 2))
console.log(`RF-1M frozen mixed holdout contracts: PASS (${corpusSha256.slice(0, 16)})`)
