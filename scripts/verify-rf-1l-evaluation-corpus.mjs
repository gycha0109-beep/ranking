import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const corpusPath = path.join(root, 'src/lib/recommendation/rf1-evaluation-corpus.ts')
const corePath = path.join(root, 'src/lib/recommendation/rf1-core.ts')
const neighborhoodPath = path.join(root, 'src/lib/ranking-neighborhood.ts')
const identityPath = path.join(root, 'src/lib/ranking-identity.ts')
const policyPath = path.join(root, 'src/lib/recommendation/rf1-initial-policy-calibration.ts')
const pagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')

const EXPECTED_BLIND_CORPUS_SHA256 = 'TO_BE_FROZEN_AFTER_FIRST_EXECUTION'

function fail(message) {
  console.error(`RF-1L contract failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

for (const requiredPath of [corpusPath, corePath, neighborhoodPath, identityPath, policyPath, pagePath]) {
  assert(fs.existsSync(requiredPath), `${path.relative(root, requiredPath)} must exist`)
}

const corpusSource = fs.readFileSync(corpusPath, 'utf8')
const coreSource = fs.readFileSync(corePath, 'utf8')
const neighborhoodSource = fs.readFileSync(neighborhoodPath, 'utf8')
const identityModuleSource = fs.readFileSync(identityPath, 'utf8')
const policySource = fs.readFileSync(policyPath, 'utf8')
const pageSource = fs.readFileSync(pagePath, 'utf8')

assert(!/from\s+['"][^'"]*(rf1-core|ranking-neighborhood|ranking-identity|rf1-initial-policy-calibration)[^'"]*['"]/.test(corpusSource), 'corpus generator must not import ranking/recommendation implementation modules')
assert(!/import\s*\([^)]*(rf1-core|ranking-neighborhood|ranking-identity|rf1-initial-policy-calibration)/.test(corpusSource), 'corpus generator must not dynamically import ranking/recommendation implementation modules')
assert(!corpusSource.includes('expectedRank'), 'blind corpus source must not encode expected final ranks')
assert(!corpusSource.includes('expectedTier'), 'blind corpus source must not encode expected Neighborhood tiers')
assert(!pageSource.includes('RF1_EVALUATION_CORPUS_V1'), 'public ranking page must not consume the evaluation corpus')
assert(!pageSource.includes('rf1-evaluation-corpus'), 'evaluation corpus must stay outside public runtime')

function transpile(source, fileName) {
  return ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, strict: true },
    fileName,
  }).outputText
}

function dataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}

const coreUrl = dataUrl(transpile(coreSource, corePath))
const neighborhoodUrl = dataUrl(transpile(neighborhoodSource, neighborhoodPath))
const identityUrl = dataUrl(transpile(identityModuleSource, identityPath))
const corpusUrl = dataUrl(transpile(corpusSource, corpusPath))

let policyJs = transpile(policySource, policyPath)
policyJs = policyJs.replace("from './rf1-core'", `from '${coreUrl}'`)
const policyUrl = dataUrl(policyJs)

const [coreModule, neighborhoodModule, identityModule, corpusModule, policyModule] = await Promise.all([
  import(coreUrl),
  import(neighborhoodUrl),
  import(identityUrl),
  import(corpusUrl),
  import(policyUrl),
])

const corpus = corpusModule.buildRf1EvaluationCorpus()
const repeatedCorpus = corpusModule.buildRf1EvaluationCorpus()
const policy = coreModule.validateRf1PolicyBundle(policyModule.RF1_INITIAL_POLICY_CANDIDATE_V1)

assert(JSON.stringify(corpus) === JSON.stringify(repeatedCorpus), 'evaluation corpus generation must be deterministic')
assert(corpus.corpusId === 'rf1-evaluation-corpus-v1', 'corpus ID must remain versioned and explicit')
assert(corpus.coverage.length === 56, 'coverage slice must contain exactly 56 rankings')
assert(corpus.blind.length === 112, 'blind naturalistic slice must contain exactly 112 rankings')
assert(corpus.adversarial.length === 32, 'adversarial slice must contain exactly 32 rankings')
assert(corpus.all.length === 200, 'evaluation corpus must contain exactly 200 rankings')
assert(corpus.blind.every((row) => row.testTag === null), 'blind rankings must not carry answer/test labels')
assert(new Set(corpus.blind.map((row) => row.scenarioId)).size === 14, 'blind slice must span 14 independent domain worlds')
assert(new Set(corpus.all.map((row) => row.id)).size === corpus.all.length, 'all evaluation ranking IDs must be unique')
assert(corpus.all.every((row) => row.itemIds.length >= 3 && new Set(row.itemIds).size === row.itemIds.length), 'every evaluation ranking must contain unique item evidence')
assert(policy.score.lowExposureMaximumBoost === 0, 'RF-1L must evaluate the admitted policy without inventing low-exposure authority')
assert(policy.exploration.maximumPromotions === 0, 'RF-1L must evaluate the admitted policy without inventing exploration authority')

const blindSha256 = crypto.createHash('sha256').update(JSON.stringify(corpus.blind)).digest('hex')

function currentNode(row) {
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
  const rows = []
  const sourceNode = currentNode(source)
  for (const candidate of universe) {
    if (candidate.id === source.id) continue
    const relation = neighborhoodModule.classifyRankingNeighbor(sourceNode, currentNode(candidate))
    const identityRelation = identityModule.classifyRankingIdentity(source.semanticProjection, candidate.semanticProjection)
    if (!relation && !identityRelation) continue
    rows.push({ candidate, relation, identityRelation })
  }

  return rows
    .sort((left, right) => {
      if (left.identityRelation && right.identityRelation) {
        const identityOrder = identityModule.compareRankingIdentityRelations(left.identityRelation, right.identityRelation)
        if (identityOrder !== 0) return identityOrder
      } else if (left.identityRelation) {
        return -1
      } else if (right.identityRelation) {
        return 1
      }

      if (left.relation && right.relation) {
        return neighborhoodModule.compareRankingNeighbors(left.relation, right.relation)
      }
      if (left.relation) return -1
      if (right.relation) return 1
      return left.candidate.id.localeCompare(right.candidate.id)
    })
    .slice(0, neighborhoodModule.RELATED_RANKING_LIMIT)
}

const emptyProfile = coreModule.buildRf1BehaviorProfile([], corpus.referenceTime, policy.behavior, policy.maturity)
assert(emptyProfile.maturity === 'EMPTY', 'default corpus replay must use an explicit EMPTY profile')

function rankSource(source, universe, options = {}) {
  const related = relatedRows(source, universe)
  const baselineIds = related.map((row) => row.candidate.id)
  const protectedRows = related.filter((row) => row.identityRelation)
  const contextualRows = related.filter((row) => !row.identityRelation)

  assert(related.slice(0, protectedRows.length).every((row) => row.identityRelation), 'IA-2 candidates must form a protected prefix')
  assert(related.slice(protectedRows.length).every((row) => !row.identityRelation), 'contextual candidates must follow the IA-2 prefix')
  assert(contextualRows.every((row) => row.relation), 'every contextual candidate must carry real Neighborhood evidence')

  if (contextualRows.length === 0) {
    return {
      source,
      related,
      protectedRows,
      contextualRows,
      baselineIds,
      finalIds: [...baselineIds],
      changedPositionCount: 0,
      rankedContextual: [],
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
    profile: options.profile || emptyProfile,
    session: options.session || null,
    referenceTime: corpus.referenceTime,
    seed: options.seed || `rf1l:${source.corpusKind}:${source.id}`,
    policy,
  })
  const finalIds = [
    ...protectedRows.map((row) => row.candidate.id),
    ...ranked.candidates.map((row) => row.rankingId),
  ]

  assert(finalIds.length === baselineIds.length, 'RF-1 replay must preserve candidate count')
  assert([...finalIds].sort().join('|') === [...baselineIds].sort().join('|'), 'RF-1 replay must preserve the complete candidate set')
  assert(protectedRows.every((row, index) => finalIds[index] === row.candidate.id), 'RF-1 replay must never move an IA-2 protected prefix')
  assert(ranked.candidates.every((row) => row.breakdown.lowExposureBoost === 0), 'RF-1L must not fabricate low-exposure boosts')
  assert(ranked.candidates.every((row) => row.explored === false), 'RF-1L must not fabricate exploration')

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
      assert(Number.isFinite(value) && value >= 0 && value <= 1, 'RF-1 score components must remain finite unit values')
    }
  }

  const changedPositionCount = baselineIds.reduce((count, rankingId, index) => (
    count + (finalIds[index] === rankingId ? 0 : 1)
  ), 0)

  return {
    source,
    related,
    protectedRows,
    contextualRows,
    baselineIds,
    finalIds,
    changedPositionCount,
    rankedContextual: ranked.candidates,
  }
}

function quantile(values, ratio) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1))
  return sorted[index]
}

function round(value, digits = 4) {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function evaluateSlice(rows) {
  const runs = rows.map((source) => rankSource(source, rows))
  const depths = runs.map((run) => run.related.length)
  const contextualDepths = runs.map((run) => run.contextualRows.length)
  const movements = []
  const tierCounts = { A: 0, B: 0, C: 0, D: 0 }
  let protectedPositions = 0
  let contextualPositions = 0
  let changedPositions = 0
  let diversityRelaxations = 0

  for (const run of runs) {
    protectedPositions += run.protectedRows.length
    contextualPositions += run.contextualRows.length
    changedPositions += run.changedPositionCount
    for (const row of run.contextualRows) tierCounts[row.relation.tier] += 1
    run.rankedContextual.forEach((candidate) => {
      diversityRelaxations += candidate.appliedRelaxations.length
      const before = run.baselineIds.indexOf(candidate.rankingId)
      const after = run.finalIds.indexOf(candidate.rankingId)
      movements.push(Math.abs(after - before))
    })
  }

  return {
    sourceCount: rows.length,
    sourcesWithRelatedCandidates: runs.filter((run) => run.related.length > 0).length,
    sourcesWithAtLeast3ContextualCandidates: runs.filter((run) => run.contextualRows.length >= 3).length,
    sourcesWithAtLeast5ContextualCandidates: runs.filter((run) => run.contextualRows.length >= 5).length,
    sourcesWithReorder: runs.filter((run) => run.changedPositionCount > 0).length,
    candidatePositions: depths.reduce((sum, value) => sum + value, 0),
    protectedPositions,
    contextualPositions,
    changedPositions,
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
    tierCounts,
    movement: {
      averageAbsolute: movements.length ? round(movements.reduce((sum, value) => sum + value, 0) / movements.length) : 0,
      p90Absolute: quantile(movements, 0.9),
      maxAbsolute: movements.length ? Math.max(...movements) : 0,
    },
    diversityRelaxations,
  }
}

const coverageResult = evaluateSlice(corpus.coverage)
const blindResult = evaluateSlice(corpus.blind)
const adversarialResult = evaluateSlice(corpus.adversarial)

// Blind holdout behavior is observed, not answered in advance. Only structural
// independence and deterministic replay are hard gates here.
for (const source of corpus.blind) {
  const normal = rankSource(source, corpus.blind)
  const reversed = rankSource(source, [...corpus.blind].reverse())
  assert(normal.baselineIds.join('|') === reversed.baselineIds.join('|'), `blind related discovery must be input-order independent for ${source.id}`)
  assert(normal.finalIds.join('|') === reversed.finalIds.join('|'), `blind RF-1 replay must be input-order independent for ${source.id}`)
}

// Coverage probes intentionally carry known invariants.
const identitySource = corpus.coverage.find((row) => row.id === 'rf1l-coverage-identity-prefix-1')
assert(identitySource, 'identity coverage source must exist')
const identityRun = rankSource(identitySource, corpus.coverage.filter((row) => row.scenarioId === 'identity-prefix'))
assert(identityRun.protectedRows.length >= 3, 'identity coverage must exercise a non-trivial IA-2 protected prefix')
assert(identityRun.protectedRows.every((row, index) => identityRun.finalIds[index] === row.candidate.id), 'identity coverage prefix must remain fixed')

const profileRows = corpus.coverage.filter((row) => row.scenarioId === 'profile-affinity')
const profileSource = profileRows.find((row) => row.id === 'rf1l-coverage-profile-affinity-4')
const profileTarget = profileRows.find((row) => row.id === 'rf1l-coverage-profile-affinity-8')
assert(profileSource && profileTarget, 'profile affinity coverage rows must exist')
const coldProfileRun = rankSource(profileSource, profileRows, { seed: 'rf1l-profile-cold' })
assert(coldProfileRun.finalIds.includes(profileTarget.id), 'profile affinity target must be admitted into the related candidate set')

const saveEvents = Array.from({ length: 5 }, (_, index) => ({
  eventId: `rf1l-save-${index + 1}`,
  eventType: 'SAVE',
  occurredAt: new Date(Date.parse(corpus.referenceTime) - index * 3_600_000).toISOString(),
  magnitude: 1,
  features: [{ kind: 'item', id: 'coverage:profile-affinity:anchor-item' }],
}))
const establishedProfile = coreModule.buildRf1BehaviorProfile(saveEvents, corpus.referenceTime, policy.behavior, policy.maturity)
assert(establishedProfile.maturity === 'ESTABLISHED', 'coverage SAVE probe must reach ESTABLISHED maturity')
const establishedProfileRun = rankSource(profileSource, profileRows, { profile: establishedProfile, seed: 'rf1l-profile-established' })
const coldTarget = coldProfileRun.rankedContextual.find((row) => row.rankingId === profileTarget.id)
const establishedTarget = establishedProfileRun.rankedContextual.find((row) => row.rankingId === profileTarget.id)
assert(coldTarget && establishedTarget, 'profile affinity target must remain contextual under both probes')
assert(establishedTarget.breakdown.interestScore > coldTarget.breakdown.interestScore, 'SAVE affinity must raise the target interest score')

const session = coreModule.buildRf1SessionInterest([{
  eventId: 'rf1l-related-open-1',
  eventType: 'RELATED_OPEN',
  occurredAt: new Date(Date.parse(corpus.referenceTime) - 5 * 60_000).toISOString(),
  magnitude: 1,
  features: [{ kind: 'item', id: 'coverage:profile-affinity:anchor-item' }],
}], corpus.referenceTime, policy.sessionBehavior)
const sessionRun = rankSource(profileSource, profileRows, { session, seed: 'rf1l-profile-session' })
const sessionTarget = sessionRun.rankedContextual.find((row) => row.rankingId === profileTarget.id)
assert(sessionTarget && sessionTarget.breakdown.interestScore > coldTarget.breakdown.interestScore, 'RELATED_OPEN session affinity must raise the target interest score')

const identityAdversarialRows = corpus.adversarial.filter((row) => row.scenarioId === 'identity-saturation')
for (const source of identityAdversarialRows) {
  const run = rankSource(source, identityAdversarialRows)
  assert(run.related.length === neighborhoodModule.RELATED_RANKING_LIMIT, 'identity saturation must fill the bounded related window')
  assert(run.contextualRows.length === 0, 'identity saturation must leave no RF-1-rerankable suffix inside the bounded window')
  assert(run.changedPositionCount === 0, 'identity saturation must preserve the protected order')
}

const tieRows = corpus.adversarial.filter((row) => row.scenarioId === 'duplicate-tie')
for (const source of tieRows) {
  const first = rankSource(source, tieRows, { seed: 'rf1l-adversarial-tie' })
  const second = rankSource(source, [...tieRows].reverse(), { seed: 'rf1l-adversarial-tie' })
  assert(first.finalIds.join('|') === second.finalIds.join('|'), 'exact-score ties must remain deterministic under reversed source order')
}

const report = {
  corpus: {
    corpusId: corpus.corpusId,
    generatorSeed: corpus.generatorSeed,
    totalRankings: corpus.all.length,
    coverageRankings: corpus.coverage.length,
    blindRankings: corpus.blind.length,
    adversarialRankings: corpus.adversarial.length,
    blindWorldCount: new Set(corpus.blind.map((row) => row.scenarioId)).size,
    blindSha256,
  },
  policy: {
    policyBundleVersion: policy.policyBundleVersion,
    profilePolicyVersion: policy.profilePolicyVersion,
    sessionPolicyVersion: policy.sessionPolicyVersion,
    scorePolicyVersion: policy.scorePolicyVersion,
    diversityPolicyVersion: policy.diversityPolicyVersion,
    explorationPolicyVersion: policy.explorationPolicyVersion,
  },
  coverage: coverageResult,
  blind: blindResult,
  adversarial: adversarialResult,
  affinityProbes: {
    coldTargetRank: coldProfileRun.finalIds.indexOf(profileTarget.id) + 1,
    establishedSaveTargetRank: establishedProfileRun.finalIds.indexOf(profileTarget.id) + 1,
    relatedOpenSessionTargetRank: sessionRun.finalIds.indexOf(profileTarget.id) + 1,
    coldInterestScore: round(coldTarget.breakdown.interestScore),
    establishedSaveInterestScore: round(establishedTarget.breakdown.interestScore),
    relatedOpenSessionInterestScore: round(sessionTarget.breakdown.interestScore),
  },
  interpretationBoundary: {
    blindExpectedOrderingEncoded: false,
    blindUsedForPolicyTuning: false,
    organicEvidenceClaimed: false,
    productionActivationAuthorized: false,
  },
}

console.log('RF-1L evaluation corpus replay result:')
console.log(JSON.stringify(report, null, 2))

assert(EXPECTED_BLIND_CORPUS_SHA256 !== 'TO_BE_FROZEN_AFTER_FIRST_EXECUTION', `blind corpus must be frozen after first execution; observed sha256=${blindSha256}`)
assert(blindSha256 === EXPECTED_BLIND_CORPUS_SHA256, `blind corpus freeze mismatch: expected ${EXPECTED_BLIND_CORPUS_SHA256}, observed ${blindSha256}`)

console.log(`RF-1L isolated evaluation corpus contracts: PASS (${blindSha256.slice(0, 16)})`)
