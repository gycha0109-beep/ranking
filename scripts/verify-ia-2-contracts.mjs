import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const helperPath = path.join(root, 'src/lib/ranking-identity.ts')
const publicQueryPath = path.join(root, 'src/lib/queries/public.ts')
const migrationPath = path.join(root, 'supabase/migrations/20260821023200_ia_2_ranking_identity_projection.sql')

function fail(message) {
  console.error(`IA-2 contract failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

for (const filePath of [helperPath, publicQueryPath, migrationPath]) {
  assert(fs.existsSync(filePath), `${path.relative(root, filePath)} must exist`)
}

const helperSource = fs.readFileSync(helperPath, 'utf8')
const publicSource = fs.readFileSync(publicQueryPath, 'utf8')
const migration = fs.readFileSync(migrationPath, 'utf8')
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8')
const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')

const transpiled = ts.transpileModule(helperSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
  fileName: helperPath,
}).outputText

const helperUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
const identity = await import(helperUrl)

const {
  SEMANTIC_DISCOVERY_CONFIDENCE_MIN,
  SEMANTIC_SUBJECT_CANDIDATE_LIMIT,
  classifyRankingIdentity,
  compareRankingIdentityRelations,
  explainRankingIdentity,
  isDiscoveryEligibleProjection,
} = identity

assert(SEMANTIC_DISCOVERY_CONFIDENCE_MIN === 0.90, 'discovery confidence gate must remain 0.90')
assert(SEMANTIC_SUBJECT_CANDIDATE_LIMIT === 40, 'semantic subject candidate source must remain bounded')

const projection = (overrides = {}) => ({
  subject_key: 'mens-fragrance',
  intent_key: 'recommendation',
  coordinates: { season: 'summer' },
  method_key: 'editorial',
  version_coordinates: { as_of: '2026-08' },
  classification_state: 'inferred',
  confidence: 0.99,
  projection_version: 'fixture-v1',
  claim_signature: 'claim-a',
  view_signature: 'view-a',
  version_signature: 'version-a',
  ...overrides,
})

assert(isDiscoveryEligibleProjection(projection()) === true, 'high-confidence inferred projection must be discovery eligible')
assert(isDiscoveryEligibleProjection(projection({ confidence: 0.65 })) === false, 'low-confidence inferred projection must not drive discovery')
assert(isDiscoveryEligibleProjection(projection({ classification_state: 'reviewed', confidence: 0.10 })) === true, 'reviewed projection must remain eligible even at low machine confidence')
assert(isDiscoveryEligibleProjection(null) === false, 'missing projection must remain unclassified')

const sameVersion = classifyRankingIdentity(projection(), projection())
const sameView = classifyRankingIdentity(projection(), projection({ version_signature: 'version-b' }))
const sameClaim = classifyRankingIdentity(projection(), projection({ view_signature: 'view-b', version_signature: 'version-b' }))
const sameSubject = classifyRankingIdentity(projection(), projection({ claim_signature: 'claim-b', view_signature: 'view-b', version_signature: 'version-b' }))
const otherSubject = classifyRankingIdentity(projection(), projection({ subject_key: 'nintendo-rpg' }))
const lowConfidence = classifyRankingIdentity(projection(), projection({ confidence: 0.65 }))

assert(sameVersion?.kind === 'same_version', 'same semantic instance must classify as same_version')
assert(sameView?.kind === 'same_view', 'same claim and method with another version must classify as same_view')
assert(sameClaim?.kind === 'same_claim', 'same claim with another method must classify as same_claim')
assert(sameSubject?.kind === 'same_subject', 'same subject with different coordinates must classify as same_subject')
assert(otherSubject === null, 'different subjects must not receive an IA-2 identity relation')
assert(lowConfidence === null, 'low-confidence projection must not receive an IA-2 identity relation')
assert(compareRankingIdentityRelations(sameVersion, sameView) < 0, 'same_version must outrank same_view')
assert(compareRankingIdentityRelations(sameView, sameClaim) < 0, 'same_view must outrank same_claim')
assert(compareRankingIdentityRelations(sameClaim, sameSubject) < 0, 'same_claim must outrank same_subject')
assert(explainRankingIdentity(sameView).includes('다른 시점'), 'same_view explanation must expose version semantics')

assert(migration.includes('CREATE TABLE IF NOT EXISTS public.ranking_semantic_projections'), 'optional projection table must exist')
assert(migration.includes('coordinates jsonb'), 'open-world non-version coordinates must be JSONB')
assert(migration.includes('version_coordinates jsonb'), 'version coordinates must be separate JSONB')
assert(migration.includes('claim_signature text NOT NULL'), 'claim signature must exist')
assert(migration.includes('view_signature text NOT NULL'), 'view signature must exist')
assert(migration.includes('version_signature text NOT NULL'), 'version signature must exist')
assert(migration.includes("classification_state IN ('inferred', 'reviewed')"), 'projection lifecycle must distinguish inferred and reviewed')
assert(migration.includes('confidence >= 0 AND confidence <= 1'), 'projection confidence must be bounded')
assert(migration.includes('BEFORE INSERT OR UPDATE ON public.ranking_semantic_projections'), 'all projection metadata updates must refresh signatures and updated_at')
assert(migration.includes('ENABLE ROW LEVEL SECURITY'), 'semantic projections must use RLS')
assert(migration.includes('ranking_semantic_projections_public_read'), 'public projection reads must be visibility-gated')
assert(migration.includes("r.status = 'published'"), 'public projection RLS must require published ranking visibility')
assert(migration.includes("r.moderation_status IN ('clean', 'suggestive')"), 'public projection RLS must preserve moderation visibility')
assert(migration.includes('intentionally non-unique'), 'version signatures must explicitly remain non-unique')
assert(!/UNIQUE\s*\([^)]*(claim_signature|view_signature|version_signature)/i.test(migration), 'identity signatures must never hard-block free publication')
assert(!/ALTER TABLE\s+public\.rankings\b/i.test(migration), 'IA-2 must not add mandatory authored columns to rankings')
assert(!/ON\s+public\.rankings\b[\s\S]*EXECUTE FUNCTION\s+private\.ia_2/i.test(migration), 'IA-2 must not attach a publication-blocking trigger to rankings')
assert(!migration.includes('scope_json'), 'authored scope_json must remain separate from semantic projection')
assert(migration.includes('Absence means unclassified and never blocks ranking creation/publication'), 'unclassified rankings must remain publishable by contract')
assert(migration.includes("'fifa-world-ranking'"), 'current FIFA seed must receive a semantic Subject')
assert(migration.includes("'pisa-country-performance'"), 'current PISA seed must receive a semantic Subject')
assert(migration.includes("'kbo-team-season-performance'"), 'current KBO seed must receive a semantic Subject')

const relatedStart = publicSource.indexOf('export async function getRelatedRankings')
const relatedEnd = publicSource.indexOf('/**\n * 관련 아이템', relatedStart)
assert(relatedStart >= 0 && relatedEnd > relatedStart, 'getRelatedRankings source boundary must be detectable')
const relatedSource = publicSource.slice(relatedStart, relatedEnd)

assert(publicSource.includes(".from('ranking_semantic_projections')"), 'published ranking query must be able to load optional semantic projection')
assert(publicSource.includes('semantic_projection: semanticProjection || null'), 'missing projection must be represented as null, not a failure')
assert(relatedSource.includes('SEMANTIC_SUBJECT_CANDIDATE_LIMIT'), 'semantic Subject candidate source must be bounded')
assert(relatedSource.includes(".eq('subject_key', currentProjection.subject_key)"), 'semantic candidates must stay within the inferred Subject')
assert(relatedSource.includes('classifyRankingIdentity'), 'identity helper must own semantic relation classification')
assert(relatedSource.includes('compareRankingIdentityRelations'), 'identity helper must own semantic relation ordering')
assert(relatedSource.includes('classifyRankingNeighbor'), 'IA-1 contextual fallback must remain available')
assert(relatedSource.includes('compareRankingNeighbors'), 'IA-1 deterministic fallback ordering must remain available')
assert(relatedSource.includes('if (!identityRelation && !relation) continue'), 'a weak semantic candidate must not bypass both IA-2 and IA-1 gates')
assert(relatedSource.includes('related_identity_relation'), 'public related-ranking result must expose relation provenance')
assert(packageJson.includes('"verify:ia-2"'), 'package verifier script must be wired')
assert(ci.includes('npm run verify:ia-2'), 'CI must run the IA-2 verifier')

console.log('IA-2 ranking identity & coordinate contracts: PASS')
