import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const fixtureRoot = path.join(root, 'tests/ia-2g')
const matcherPath = path.join(root, 'src/lib/ranking-subject-suggestions.ts')

const FROZEN_MATCHER_MAIN_SHA = '5d8a3c9fd2b32591c965338ad0e6a2acbd0bc4d9'
const FROZEN_MATCHER_BLOB_SHA = '49f8d8ea220d1ee1d4fa229f8f3a5a0aff048a47'
const EXPECTED = {
  'options.json': '4dd8e2c631d72802bf77118c4bd38a67dc52f726bab633ce4331b5699437e3ba',
  'reuse.json': 'c06ae0a9663176ce4afba540087c823d3a06c647197fa3517e0b707f1145cd71',
  'new.json': '810fa155f81d9ea2616408313ffa03c5f7609eabe0d2e1ac45ae6b7c9ba3a6f1',
  'abstain.json': '99a676961a337bed9e60b06246b7e9c7018993931d943627fe7a9a6acdb8ccdf',
}

const EXPECTED_CLASS_COUNTS = {
  exact_canonical: 50,
  exact_reviewed_alias: 25,
  single_edit_typo: 50,
  token_reorder: 25,
  semantic_surface_variant: 50,
}

function fail(message) {
  console.error(`IA-2G holdout integrity failed: ${message}`)
  process.exit(1)
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function gitBlobSha1(buffer) {
  return crypto
    .createHash('sha1')
    .update(`blob ${buffer.length}\0`)
    .update(buffer)
    .digest('hex')
}

function readSealedJson(name) {
  const filePath = path.join(fixtureRoot, name)
  if (!fs.existsSync(filePath)) fail(`${name} is missing`)
  const raw = fs.readFileSync(filePath)
  const actual = sha256(raw)
  if (actual !== EXPECTED[name]) fail(`${name} hash changed: ${actual}`)
  return JSON.parse(raw.toString('utf8'))
}

// Integrity is checked before matcher code is loaded or executed.
const optionsRaw = readSealedJson('options.json')
const reuseCases = readSealedJson('reuse.json')
const newCases = readSealedJson('new.json')
const abstainCases = readSealedJson('abstain.json')

if (optionsRaw.length !== 50) fail(`expected 50 subject options, got ${optionsRaw.length}`)
if (reuseCases.length !== 200) fail(`expected 200 reuse cases, got ${reuseCases.length}`)
if (newCases.length !== 100) fail(`expected 100 novel cases, got ${newCases.length}`)
if (abstainCases.length !== 25) fail(`expected 25 abstention cases, got ${abstainCases.length}`)

const observedClassCounts = Object.fromEntries(Object.keys(EXPECTED_CLASS_COUNTS).map(key => [key, 0]))
for (const row of reuseCases) {
  if (!Array.isArray(row) || row.length !== 3) fail('reuse row shape is invalid')
  const [query, expectedSubject, caseClass] = row
  if (typeof query !== 'string' || typeof expectedSubject !== 'string') fail('reuse strings are invalid')
  if (!(caseClass in EXPECTED_CLASS_COUNTS)) fail(`unexpected reuse class: ${caseClass}`)
  observedClassCounts[caseClass] += 1
}
for (const [name, expectedCount] of Object.entries(EXPECTED_CLASS_COUNTS)) {
  if (observedClassCounts[name] !== expectedCount) {
    fail(`expected ${expectedCount} ${name} cases, got ${observedClassCounts[name]}`)
  }
}

if (!fs.existsSync(matcherPath)) fail('matcher source is missing')
const matcherRaw = fs.readFileSync(matcherPath)
const matcherBlobSha = gitBlobSha1(matcherRaw)
if (matcherBlobSha !== FROZEN_MATCHER_BLOB_SHA) {
  fail(`matcher changed after freeze: ${matcherBlobSha}`)
}

const options = optionsRaw.map(row => {
  if (!Array.isArray(row) || row.length !== 3) fail('option row shape is invalid')
  const [subject_key, usage_count, aliases] = row
  if (typeof subject_key !== 'string' || !Number.isFinite(usage_count) || !Array.isArray(aliases)) {
    fail(`invalid option row for ${subject_key}`)
  }
  return { subject_key, usage_count, aliases }
})

const optionKeys = new Set(options.map(option => option.subject_key))
if (optionKeys.size !== options.length) fail('duplicate canonical subject option')
for (const [, expectedSubject] of reuseCases) {
  if (!optionKeys.has(expectedSubject)) fail(`reuse target not found in options: ${expectedSubject}`)
}

const transpiled = ts.transpileModule(matcherRaw.toString('utf8'), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
  fileName: matcherPath,
}).outputText
const matcherModule = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)
const { rankRankingSubjectSuggestions } = matcherModule
if (typeof rankRankingSubjectSuggestions !== 'function') {
  fail('rankRankingSubjectSuggestions export is unavailable')
}

const byClass = new Map()
const firstFailures = []
let reuseTop1 = 0
let reuseTop5 = 0
let reuseExposure = 0
let novelExposure = 0
let abstainExposure = 0
let totalExposures = 0
let correctTop1AcrossAllExposures = 0

function suggestionsFor(query) {
  const suggestions = rankRankingSubjectSuggestions(query, options)
  if (!Array.isArray(suggestions)) fail(`matcher returned non-array for ${query}`)
  return suggestions
}

for (const [query, expectedSubject, caseClass] of reuseCases) {
  const suggestions = suggestionsFor(query)
  const topKeys = suggestions.map(item => item.subject_key)
  const exposed = topKeys.length > 0
  const top1Correct = topKeys[0] === expectedSubject
  const top5Correct = topKeys.includes(expectedSubject)

  if (exposed) {
    reuseExposure += 1
    totalExposures += 1
  }
  if (top1Correct) {
    reuseTop1 += 1
    correctTop1AcrossAllExposures += 1
  }
  if (top5Correct) reuseTop5 += 1

  const bucket = byClass.get(caseClass) || { total: 0, top1: 0, top5: 0, exposure: 0 }
  bucket.total += 1
  bucket.top1 += Number(top1Correct)
  bucket.top5 += Number(top5Correct)
  bucket.exposure += Number(exposed)
  byClass.set(caseClass, bucket)

  if (!top1Correct && firstFailures.length < 40) {
    firstFailures.push({
      kind: 'reuse',
      case_class: caseClass,
      query,
      expected: expectedSubject,
      suggested: topKeys.slice(0, 5),
    })
  }
}

for (const query of newCases) {
  const suggestions = suggestionsFor(query)
  if (suggestions.length > 0) {
    novelExposure += 1
    totalExposures += 1
    if (firstFailures.length < 40) {
      firstFailures.push({
        kind: 'new_false_exposure',
        query,
        suggested: suggestions.map(item => item.subject_key).slice(0, 5),
      })
    }
  }
}

for (const query of abstainCases) {
  const suggestions = suggestionsFor(query)
  if (suggestions.length > 0) {
    abstainExposure += 1
    totalExposures += 1
    if (firstFailures.length < 40) {
      firstFailures.push({
        kind: 'ambiguous_false_exposure',
        query,
        suggested: suggestions.map(item => item.subject_key).slice(0, 5),
      })
    }
  }
}

const ratio = (numerator, denominator) => denominator === 0 ? 0 : numerator / denominator
const classMetrics = Object.fromEntries([...byClass.entries()].map(([name, value]) => [name, {
  total: value.total,
  top1_accuracy: ratio(value.top1, value.total),
  top5_recall: ratio(value.top5, value.total),
  exposure_rate: ratio(value.exposure, value.total),
}]))

const totalCases = reuseCases.length + newCases.length + abstainCases.length
const result = {
  benchmark_id: 'ia-2g-independent-holdout-v2',
  provenance: 'CONTROLLED_SYNTHETIC_INDEPENDENT_HOLDOUT',
  frozen_matcher_main_sha: FROZEN_MATCHER_MAIN_SHA,
  frozen_matcher_blob_sha: FROZEN_MATCHER_BLOB_SHA,
  holdout_integrity: 'PASS',
  total_cases: totalCases,
  reuse_cases: reuseCases.length,
  novel_cases: newCases.length,
  ambiguous_cases: abstainCases.length,
  reuse_top1_accuracy: ratio(reuseTop1, reuseCases.length),
  reuse_top5_recall: ratio(reuseTop5, reuseCases.length),
  reuse_suggestion_coverage: ratio(reuseExposure, reuseCases.length),
  novel_suggestion_exposure_rate: ratio(novelExposure, newCases.length),
  ambiguous_suggestion_exposure_rate: ratio(abstainExposure, abstainCases.length),
  overall_suggestion_coverage: ratio(totalExposures, totalCases),
  selective_top1_precision: ratio(correctTop1AcrossAllExposures, totalExposures),
  by_case_class: classMetrics,
  first_failure_samples: firstFailures,
  performance_gate: 'NONE_FIRST_RUN_RESULT_MUST_BE_RECORDED_AS_OBSERVED',
  matcher_mutation_after_observation: 'FORBIDDEN_IN_IA_2G',
  organic_evidence_rows_written: 0,
}

console.log('IA-2G independent holdout v2 execution completed.')
console.log(JSON.stringify(result, null, 2))
