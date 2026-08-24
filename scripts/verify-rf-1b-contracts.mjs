import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const adapterPath = path.join(root, 'src/lib/recommendation/rf1-related-adapter.ts')
const serverPath = path.join(root, 'src/lib/recommendation/rf1-related-server.ts')
const migrationPath = path.join(root, 'supabase/migrations/20260824060000_rf_1b_recommendation_exposure_evidence.sql')
const publicQueryPath = path.join(root, 'src/lib/queries/public.ts')
const neighborhoodPath = path.join(root, 'src/lib/ranking-neighborhood.ts')

function fail(message) {
  console.error(`RF-1B contract failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function expectThrow(fn, message) {
  let threw = false
  try {
    fn()
  } catch {
    threw = true
  }
  assert(threw, message)
}

for (const requiredPath of [adapterPath, serverPath, migrationPath, publicQueryPath, neighborhoodPath]) {
  assert(fs.existsSync(requiredPath), `${path.relative(root, requiredPath)} must exist`)
}

const adapterSource = fs.readFileSync(adapterPath, 'utf8')
const serverSource = fs.readFileSync(serverPath, 'utf8')
const migration = fs.readFileSync(migrationPath, 'utf8')
const publicSource = fs.readFileSync(publicQueryPath, 'utf8')
const neighborhoodSource = fs.readFileSync(neighborhoodPath, 'utf8')

assert(adapterSource.includes("'IA2_PROTECTED' | 'RF1_RERANKED'"), 'adapter must distinguish protected IA-2 rows from RF-1 reranked rows')
assert(adapterSource.includes('contiguous prefix'), 'adapter must fail closed if IA-2 identity authority is not a source prefix')
assert(adapterSource.includes('contextual Neighborhood evidence'), 'non-identity candidates must retain contextual Neighborhood evidence')
assert(adapterSource.includes('sourceRank'), 'adapter must retain original source rank')
assert(adapterSource.includes('policyBundleVersion'), 'adapter exposure records must retain policy bundle version')
assert(adapterSource.includes('scoreBreakdown'), 'adapter exposure records must retain RF-1 score breakdown')
assert(adapterSource.includes("surface: 'related_rankings'"), 'RF-1B must bind evidence to the related-rankings surface')

assert(serverSource.includes('classifyRankingNeighbor'), 'server adapter must recompute contextual Neighborhood evidence from current governed logic')
assert(serverSource.includes("admin.rpc('get_rf1_candidate_signals'"), 'server adapter must hydrate candidate signals through the governed RF-1 read RPC')
assert(serverSource.includes("admin.rpc('record_rf1_recommendation_exposures'"), 'server adapter must persist exposure evidence through the governed RF-1 write RPC')
assert(serverSource.includes('missing RF-1 candidate signal row'), 'missing candidate signal evidence must fail closed')
assert(serverSource.includes('createAdminClient'), 'RF-1 persistence must remain server-only through the admin client')

assert(migration.includes('CREATE TABLE public.rf1_recommendation_exposures'), 'RF-1B exposure evidence table must exist')
assert(migration.includes('CREATE OR REPLACE FUNCTION public.record_rf1_recommendation_exposures'), 'RF-1B atomic exposure write RPC must exist')
assert(migration.includes('CREATE OR REPLACE FUNCTION public.get_rf1_candidate_signals'), 'RF-1B candidate signal read RPC must exist')
assert(migration.includes('content_view_totals'), 'candidate signals must reuse existing unique-view authority')
assert(migration.includes('content_likes'), 'candidate signals must reuse existing like authority')
assert(migration.includes('content_bookmarks'), 'candidate signals must reuse existing bookmark authority')
assert(migration.includes('rf1_recommendation_exposures x'), 'recent exposure must read back from the RF-1 evidence store')
assert(migration.includes("surface = 'related_rankings'"), 'RF-1B exposure surface must be explicitly bounded')
assert(migration.includes("ranking_mode IN ('IA2_PROTECTED', 'RF1_RERANKED')"), 'DB must preserve IA-2 protected versus RF-1 reranked provenance')
assert(migration.includes('conflicting RF-1 exposure replay'), 'idempotent replay must reject conflicting payloads')
assert(migration.includes("r.status = 'published'"), 'RF-1 exposure writes and signal reads must remain public-content bounded')
assert(migration.includes("r.moderation_status IN ('clean', 'suggestive')"), 'RF-1B must preserve moderation gates')
assert(migration.includes('REVOKE ALL ON TABLE public.rf1_recommendation_exposures FROM PUBLIC, anon, authenticated, service_role'), 'raw evidence table access must remain closed')
assert(migration.includes('GRANT EXECUTE ON FUNCTION public.record_rf1_recommendation_exposures(JSONB)\nTO service_role'), 'exposure writes must be service-role-only')
assert(migration.includes('GRANT EXECUTE ON FUNCTION public.get_rf1_candidate_signals(UUID[], TIMESTAMPTZ)\nTO service_role'), 'candidate signal reads must be service-role-only')
assert(!migration.includes('user_id UUID'), 'RF-1B exposure evidence must not create a second authenticated-user analytics authority')
assert(!migration.includes('viewer_key_hash'), 'RF-1B exposure evidence must not copy MEASURE-1 viewer identity')

assert(publicSource.includes('export async function getRelatedRankings'), 'existing getRelatedRankings candidate authority must remain present')
assert(publicSource.includes('compareRankingIdentityRelations'), 'existing IA-2 identity ordering must remain present')
assert(neighborhoodSource.includes("export type RankingNeighborTier = 'A' | 'B' | 'C' | 'D'"), 'existing A/B/C/D Neighborhood contract must remain unchanged')

const transpiled = ts.transpileModule(adapterSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    strict: true,
  },
  fileName: adapterPath,
}).outputText

assert(!transpiled.includes("from './rf1-core'"), 'adapter runtime must not depend on type-only core imports after transpilation')
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
const adapter = await import(moduleUrl)

const breakdown = {
  neighborhoodScore: 0.8,
  interestScore: 0.5,
  freshnessScore: 0.7,
  popularityScore: 0.4,
  lowExposureBoost: 0.1,
  baseScore: 0.6,
  finalScore: 0.7,
}

function evidence(overrides) {
  return {
    sourceRank: 1,
    rankingId: 'ranking-1',
    identityRelation: 'same_version',
    contextualNeighborhood: { tier: 'A', itemJaccard: 0.8, lexicalJaccard: 0.7 },
    categoryId: 'category-1',
    subcategoryId: 'subcategory-1',
    rankingType: 'editorial',
    itemIds: ['item-1', 'item-2'],
    publishedAt: '2026-08-24T00:00:00.000Z',
    uniqueViewCount: 10,
    likeCount: 2,
    bookmarkCount: 1,
    recentExposureCount: 0,
    ...overrides,
  }
}

const sourceEvidence = [
  evidence({ sourceRank: 1, rankingId: 'ranking-1', identityRelation: 'same_version' }),
  evidence({ sourceRank: 2, rankingId: 'ranking-2', identityRelation: 'same_subject', contextualNeighborhood: null }),
  evidence({ sourceRank: 3, rankingId: 'ranking-3', identityRelation: null, contextualNeighborhood: { tier: 'A', itemJaccard: 0.7, lexicalJaccard: 0.6 } }),
  evidence({ sourceRank: 4, rankingId: 'ranking-4', identityRelation: null, contextualNeighborhood: { tier: 'B', itemJaccard: 0.5, lexicalJaccard: 0.2 } }),
  evidence({ sourceRank: 5, rankingId: 'ranking-5', identityRelation: null, contextualNeighborhood: { tier: 'C', itemJaccard: 0.1, lexicalJaccard: 0.6 } }),
]

const plan = adapter.planRf1RelatedCandidates(sourceEvidence)
assert(plan.protectedIdentity.map((candidate) => candidate.rankingId).join(',') === 'ranking-1,ranking-2', 'IA-2 identity prefix must stay protected')
assert(plan.rerankable.map((candidate) => candidate.rankingId).join(',') === 'ranking-3,ranking-4,ranking-5', 'only contextual suffix may enter RF-1 reranking')

const feedCandidates = adapter.toRf1FeedCandidates(plan)
assert(feedCandidates.length === 3, 'all contextual candidates must be adapted')
assert(feedCandidates[0].neighborhood.tier === 'A', 'contextual tier must survive adaptation')
assert(feedCandidates[0].uniqueViewCount === 10 && feedCandidates[0].recentExposureCount === 0, 'engagement and exposure signals must survive adaptation')

expectThrow(() => adapter.planRf1RelatedCandidates([
  evidence({ sourceRank: 1, rankingId: 'context-first', identityRelation: null }),
  evidence({ sourceRank: 2, rankingId: 'late-identity', identityRelation: 'same_claim' }),
]), 'IA-2 identity after contextual suffix must fail closed')

expectThrow(() => adapter.planRf1RelatedCandidates([
  evidence({ sourceRank: 1, rankingId: 'missing-context', identityRelation: null, contextualNeighborhood: null }),
]), 'non-identity candidate without Neighborhood evidence must fail closed')

const rerankedResult = {
  policyBundleVersion: 'fixture-policy-bundle-v1',
  profileFingerprint: 'rf1-profile-fixture',
  sessionFingerprint: 'rf1-session-fixture',
  referenceTime: '2026-08-24T01:00:00.000Z',
  seed: 'fixture-seed',
  fingerprint: 'ranking-result-fixture',
  candidates: [
    {
      rankingId: 'ranking-5', baseRank: 3, finalRank: 1, explored: true,
      appliedRelaxations: ['subcategory'], breakdown,
      categoryId: 'category-1', subcategoryId: 'subcategory-1', rankingType: 'editorial',
    },
    {
      rankingId: 'ranking-3', baseRank: 1, finalRank: 2, explored: false,
      appliedRelaxations: [], breakdown,
      categoryId: 'category-1', subcategoryId: 'subcategory-1', rankingType: 'editorial',
    },
    {
      rankingId: 'ranking-4', baseRank: 2, finalRank: 3, explored: false,
      appliedRelaxations: ['category'], breakdown,
      categoryId: 'category-1', subcategoryId: 'subcategory-1', rankingType: 'editorial',
    },
  ],
}

const merged = adapter.mergeRf1RelatedRankingResult(plan, rerankedResult)
assert(merged.candidates.map((candidate) => candidate.rankingId).join(',') === 'ranking-1,ranking-2,ranking-5,ranking-3,ranking-4', 'IA-2 prefix must remain fixed while contextual suffix is reranked')
assert(merged.candidates[0].mode === 'IA2_PROTECTED' && merged.candidates[0].breakdown === null, 'protected IA-2 row must not fabricate RF-1 scores')
assert(merged.candidates[2].mode === 'RF1_RERANKED' && merged.candidates[2].explored === true, 'RF-1 exploration provenance must survive merge')
assert(merged.candidates[2].sourceRank === 5 && merged.candidates[2].finalRank === 3, 'source rank and final rank must both remain explicit')

const exposures = adapter.createRf1RelatedExposureRecords({
  recommendationRunId: 'run-fixture',
  profile: { profileVersion: 'profile-policy-v1', fingerprint: 'rf1-profile-fixture' },
  session: { fingerprint: 'rf1-session-fixture' },
  result: merged,
  exposedAt: '2026-08-24T01:00:01.000Z',
})

assert(exposures.length === 5, 'one exposure evidence row must be created per final candidate')
assert(exposures[0].exposureId === 'run-fixture:ranking-1', 'exposure ID must deterministically bind run and ranking')
assert(exposures[0].rankingMode === 'IA2_PROTECTED' && exposures[0].scoreBreakdown === null, 'IA-2 exposure must remain scoreless and explicit')
assert(exposures[2].rankingMode === 'RF1_RERANKED' && exposures[2].scoreBreakdown.finalScore === 0.7, 'RF-1 exposure must retain component breakdown')
assert(exposures[2].diversityRelaxations.join(',') === 'subcategory', 'diversity relaxation provenance must persist')

expectThrow(() => adapter.createRf1RelatedExposureRecords({
  recommendationRunId: 'run-fixture',
  profile: { profileVersion: 'profile-policy-v1', fingerprint: 'wrong-profile' },
  session: { fingerprint: 'rf1-session-fixture' },
  result: merged,
  exposedAt: '2026-08-24T01:00:01.000Z',
}), 'exposure creation must fail when profile fingerprint does not bind the ranking result')

console.log('RF-1B persistence and related-adapter contracts: PASS')
