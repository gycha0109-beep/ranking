import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const inputPath = path.join(root, 'src/lib/ranking-semantic-input.ts')
const actionPath = path.join(root, 'src/lib/actions/ranking-semantic.ts')
const panelPath = path.join(root, 'src/app/admin/rankings/[id]/edit/SemanticProjectionPanel.tsx')
const editPagePath = path.join(root, 'src/app/admin/rankings/[id]/edit/page.tsx')
const identityPath = path.join(root, 'src/lib/ranking-identity.ts')
const ia2MigrationPath = path.join(root, 'supabase/migrations/20260821023200_ia_2_ranking_identity_projection.sql')
const docPath = path.join(root, 'docs/ia-2b-semantic-projection-ingestion-duplicate-advisory.md')

function fail(message) {
  console.error(`IA-2B contract failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

for (const filePath of [inputPath, actionPath, panelPath, editPagePath, identityPath, ia2MigrationPath, docPath]) {
  assert(fs.existsSync(filePath), `${path.relative(root, filePath)} must exist`)
}

const inputSource = fs.readFileSync(inputPath, 'utf8')
const actionSource = fs.readFileSync(actionPath, 'utf8')
const panelSource = fs.readFileSync(panelPath, 'utf8')
const editPageSource = fs.readFileSync(editPagePath, 'utf8')
const identitySource = fs.readFileSync(identityPath, 'utf8')
const migration = fs.readFileSync(ia2MigrationPath, 'utf8')
const doc = fs.readFileSync(docPath, 'utf8')
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8')
const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')

const transpiled = ts.transpileModule(inputSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
  fileName: inputPath,
}).outputText

const inputModule = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)
const { parseRankingSemanticProjectionForm, SEMANTIC_PROJECTION_JSON_MAX_CHARS } = inputModule

assert(SEMANTIC_PROJECTION_JSON_MAX_CHARS === 8000, 'semantic JSON input must remain bounded')

const valid = parseRankingSemanticProjectionForm({
  subject_key: ' Mens-Fragrance ',
  intent_key: ' Recommendation ',
  method_key: ' Editorial ',
  coordinates_json: '{"season":"summer","audience":"20s"}',
  version_coordinates_json: '{"as_of":"2026-08"}',
})
assert(valid.ok, 'valid open-world projection input must parse')
assert(valid.value.subject_key === 'mens-fragrance', 'subject key must normalize to lower case')
assert(valid.value.intent_key === 'recommendation', 'intent key must normalize to lower case')
assert(valid.value.method_key === 'editorial', 'method key must normalize to lower case')
assert(valid.value.coordinates.season === 'summer', 'coordinates must preserve open-world values')

const missingSubject = parseRankingSemanticProjectionForm({
  subject_key: '',
  coordinates_json: '{}',
  version_coordinates_json: '{}',
})
assert(!missingSubject.ok, 'subject key must be required only when a projection is explicitly saved')

const arrayCoordinates = parseRankingSemanticProjectionForm({
  subject_key: 'mens-fragrance',
  coordinates_json: '[]',
  version_coordinates_json: '{}',
})
assert(!arrayCoordinates.ok, 'coordinates root must remain a JSON object')

const badKey = parseRankingSemanticProjectionForm({
  subject_key: '남자 향수',
  coordinates_json: '{}',
  version_coordinates_json: '{}',
})
assert(!badKey.ok, 'canonical semantic keys must reject arbitrary raw labels')

assert(actionSource.includes("'use server'"), 'semantic ingestion must run as a server action')
assert(actionSource.includes('await ensureAdmin()'), 'every public semantic action must verify admin authorization')
assert(actionSource.includes('createAdminClient()'), 'semantic writes must use a server-only admin client after authorization')
assert(actionSource.includes(".from('ranking_semantic_projections')"), 'semantic actions must reuse the IA-2 projection table')
assert(actionSource.includes('.upsert({'), 'reviewed projection ingestion must support create/update')
assert(actionSource.includes("classification_state: 'reviewed'"), 'manual ingestion must be explicitly reviewed')
assert(actionSource.includes('confidence: 1'), 'manual reviewed ingestion must not masquerade as probabilistic inference')
assert(actionSource.includes("projection_version: 'ia-2b-admin-manual-v1'"), 'manual ingestion provenance version must be explicit')
assert(actionSource.includes(".delete()\n    .eq('ranking_id', rankingId)"), 'projection must be removable back to unclassified')
assert(actionSource.includes('SEMANTIC_SUBJECT_CANDIDATE_LIMIT'), 'advisory candidate source must remain bounded')
assert(actionSource.includes(".eq('subject_key', currentProjection.subject_key)"), 'advisory candidates must remain within the same Subject')
assert(actionSource.includes('classifyRankingIdentity'), 'IA-2 identity classifier must own advisory relation semantics')
assert(actionSource.includes('advisories.slice(0, 12)'), 'admin advisory rendering must remain bounded')
assert(!actionSource.includes("status: 'published'"), 'semantic ingestion must never publish a ranking')
assert(!actionSource.includes('published_at:'), 'semantic ingestion must never mutate publication timestamps')

assert(panelSource.includes('분류하지 않거나 projection을 삭제해도 랭킹 저장·발행은 차단되지 않습니다.'), 'UI must state non-blocking publication semantics')
assert(panelSource.includes('Projection 해제'), 'UI must expose return to unclassified')
assert(panelSource.includes('경고 전용 · 저장/발행 hard block 없음'), 'duplicate advisory must be warning-only')
assert(panelSource.includes('AI/embedding 없이'), 'current ingestion path must remain AI-independent')
assert(editPageSource.includes('<SemanticProjectionPanel initialWorkspace={semanticWorkspace} />'), 'ranking editor must mount the IA-2B workspace')

assert(identitySource.includes("'same_version'"), 'IA-2 exact-version identity must remain available')
assert(migration.includes('version_signature text NOT NULL'), 'duplicate advisory must reuse DB-derived version signatures')
assert(!/UNIQUE\s*\([^)]*version_signature/i.test(migration), 'duplicate identity must remain advisory, not a uniqueness block')
assert(doc.includes('`분류 실패 = 게시 실패`는 여전히 금지된다.'), 'stage documentation must preserve free publication')
assert(doc.includes('중복 게시 hard block'), 'stage documentation must explicitly reject duplicate hard blocking')
assert(packageJson.includes('"verify:ia-2b"'), 'package verifier script must be wired')
assert(ci.includes('npm run verify:ia-2b'), 'CI must run the IA-2B verifier')

console.log('IA-2B semantic projection ingestion & duplicate advisory contracts: PASS')
