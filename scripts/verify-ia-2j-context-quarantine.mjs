import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const pagePath = path.join(root, 'src/app/admin/rankings/[id]/edit/page.tsx')
const lexicalPath = path.join(root, 'src/lib/ranking-subject-suggestions.ts')
const contextPath = path.join(root, 'src/lib/ranking-subject-context.ts')
const fixturePath = path.join(root, 'tests/ia-2i/holdout.json')
const ia2iDocPath = path.join(root, 'docs/ia-2i-context-independent-validation.md')
const docsPath = path.join(root, 'docs/ia-2j-context-fallback-quarantine.md')
const packagePath = path.join(root, 'package.json')
const ciPath = path.join(root, '.github/workflows/ci.yml')

const FROZEN_LEXICAL_BLOB_SHA = '49f8d8ea220d1ee1d4fa229f8f3a5a0aff048a47'
const REJECTED_CONTEXT_BLOB_SHA = 'ae6edc3086280324c7537f7afe14b1e08a2ef5c7'
const SEALED_IA2I_FIXTURE_BLOB_SHA = 'b748a118fa527c376f12db31ce43291270c8c13a'

function fail(message) {
  console.error(`IA-2J context quarantine verification failed: ${message}`)
  process.exit(1)
}

function expect(condition, message) {
  if (!condition) fail(message)
}

function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`missing ${path.relative(root, filePath)}`)
  return fs.readFileSync(filePath, 'utf8')
}

function gitBlobSha1(buffer) {
  return crypto
    .createHash('sha1')
    .update(`blob ${buffer.length}\0`)
    .update(buffer)
    .digest('hex')
}

const pageSource = read(pagePath)
const lexicalRaw = fs.readFileSync(lexicalPath)
const contextRaw = fs.readFileSync(contextPath)
const fixtureRaw = fs.readFileSync(fixturePath)
const ia2iDoc = read(ia2iDocPath)
const docs = read(docsPath)
const packageJson = JSON.parse(read(packagePath))
const ciSource = read(ciPath)

expect(gitBlobSha1(lexicalRaw) === FROZEN_LEXICAL_BLOB_SHA, 'lexical matcher changed during remediation')
expect(gitBlobSha1(contextRaw) === REJECTED_CONTEXT_BLOB_SHA, 'rejected IA-2H helper must remain frozen for evidence')
expect(gitBlobSha1(fixtureRaw) === SEALED_IA2I_FIXTURE_BLOB_SHA, 'sealed IA-2I holdout changed after observation')

expect(pageSource.includes('const IA_2H_CONTEXT_FALLBACK_QUARANTINED = true'), 'static quarantine flag must be true')
expect(
  /IA_2H_CONTEXT_FALLBACK_QUARANTINED\s*\?\s*Promise\.resolve\(\[\]\)\s*:\s*getRankingSubjectContextSuggestions\(id\)/s.test(pageSource),
  'quarantine must suppress context server action execution'
)
expect(
  pageSource.includes('!IA_2H_CONTEXT_FALLBACK_QUARANTINED && ('),
  'quarantine must suppress context UI mount'
)
expect(pageSource.includes('<SemanticProjectionPanel initialWorkspace={semanticWorkspace} />'), 'lexical semantic editor must remain mounted')
expect(pageSource.includes('SemanticContextFallbackPanel'), 'IA-2H component evidence reference should remain auditable')

expect(ia2iDoc.includes('novel_familiar_items exposure = 1.0') || ia2iDoc.includes('Novel suggestion exposure'), 'IA-2I rejection evidence missing')
expect(ia2iDoc.includes('IA-2H_STANDALONE_CONTEXT_SAFETY = REJECTED'), 'IA-2I rejection status missing')
expect(docs.includes('IA_2H_CONTEXT_FALLBACK_QUARANTINED = true'), 'quarantine contract not documented')
expect(docs.includes('same entity set can support multiple unrelated ranking questions'), 'architectural failure reason missing')
expect(docs.includes('NEW_SUBJECT_PATH = ACTIVE_UNCHANGED'), 'open-world new Subject path not frozen')
expect(docs.includes('PUBLICATION_SEMANTICS = UNCHANGED'), 'publication non-mutation contract missing')
expect(docs.includes('No automatic merge/remap'), 'forbidden automatic governance expansion not documented')

expect(packageJson.scripts?.['verify:ia-2j'] === 'node scripts/verify-ia-2j-context-quarantine.mjs', 'package verify:ia-2j wiring missing')
expect(ciSource.includes('npm run verify:ia-2j'), 'CI verify:ia-2j wiring missing')

console.log('IA-2J rejected context fallback quarantine: PASS')
console.log('ia_2h_operational_fallback=QUARANTINED')
console.log('lexical_matcher=UNCHANGED')
console.log('rejected_context_helper=PRESERVED_FOR_EVIDENCE')
console.log('sealed_ia_2i_holdout=UNCHANGED')
console.log('new_subject_path=ACTIVE')
console.log('publication_semantics=UNCHANGED')
