import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const fixtureRoot = path.join(root, 'tests/ia-2e')
const matcherPath = path.join(root, 'src/lib/ranking-subject-suggestions.ts')

const EXPECTED = {
  'options.json': '27e297eed22440fa5a043fbab335321c7cde793b3be90e37aa525a8f310156b5',
  'reuse.json': '9a0e6f9eeebd1d621e7e5560e658ab5482042d7742588291b3b57b6e3c19df6a',
  'new.json': '4d0a1819b600116a07dc737a4bb48fa5b8fabe6787c68c89b0292736c4f31ca0',
  'abstain.json': 'ecf7355a2c0fa61660b4c1b21f6bc4fe1d774f3639df9ae6557944804d05c44c',
}

const GATES = {
  reuse_top1_accuracy_min: 0.80,
  reuse_top5_recall_min: 0.80,
  selective_top1_precision_min: 0.95,
  novel_suggestion_exposure_max: 0.05,
  ambiguous_suggestion_exposure_max: 0.05,
  exact_canonical_top1_min: 1,
  exact_reviewed_alias_top1_min: 1,
  single_edit_typo_top5_min: 0.95,
  token_reorder_top5_min: 0.80,
}

function fail(message) {
  console.error(`IA-2F recall calibration failed: ${message}`)
  process.exit(1)
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function readSealedJson(name) {
  const filePath = path.join(fixtureRoot, name)
  if (!fs.existsSync(filePath)) fail(`${name} is missing`)
  const raw = fs.readFileSync(filePath)
  const actual = sha256(raw)
  if (actual !== EXPECTED[name]) fail(`${name} hash changed: ${actual}`)
  return JSON.parse(raw.toString('utf8'))
}

const optionsRaw = readSealedJson('options.json')
const reuseCases = readSealedJson('reuse.json')
const newCases = readSealedJson('new.json')
const abstainCases = readSealedJson('abstain.json')

if (optionsRaw.length !== 40) fail(`expected 40 options, got ${optionsRaw.length}`)
if (reuseCases.length !== 150) fail(`expected 150 reuse cases, got ${reuseCases.length}`)
if (newCases.length !== 90) fail(`expected 90 novel cases, got ${newCases.length}`)
if (abstainCases.length !== 20) fail(`expected 20 ambiguous cases, got ${abstainCases.length}`)
if (!fs.existsSync(matcherPath)) fail('matcher source is missing')

const matcherSource = fs.readFileSync(matcherPath, 'utf8')
for (const [query] of reuseCases) {
  if (matcherSource.includes(query)) fail(`matcher hardcodes holdout query: ${query}`)
}
for (const query of [...newCases, ...abstainCases]) {
  if (matcherSource.includes(query)) fail(`matcher hardcodes negative holdout query: ${query}`)
}

const options = optionsRaw.map(([subject_key, usage_count, aliases]) => ({
  subject_key,
  usage_count,
  aliases,
}))

const transpiled = ts.transpileModule(matcherSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
  fileName: matcherPath,
}).outputText
const matcherModule = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)
const { rankRankingSubjectSuggestions } = matcherModule
if (typeof rankRankingSubjectSuggestions !== 'function') fail('rankRankingSubjectSuggestions export is unavailable')

const byClass = new Map()
const failures = []
let reuseTop1 = 0
let reuseTop5 = 0
let reuseExposure = 0
let novelExposure = 0
let ambiguousExposure = 0
let totalExposures = 0
let correctTop1AcrossExposures = 0

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

  reuseExposure += Number(exposed)
  reuseTop1 += Number(top1Correct)
  reuseTop5 += Number(top5Correct)
  totalExposures += Number(exposed)
  correctTop1AcrossExposures += Number(top1Correct)

  const bucket = byClass.get(caseClass) || { total: 0, top1: 0, top5: 0, exposure: 0 }
  bucket.total += 1
  bucket.top1 += Number(top1Correct)
  bucket.top5 += Number(top5Correct)
  bucket.exposure += Number(exposed)
  byClass.set(caseClass, bucket)

  if (!top1Correct && failures.length < 20) {
    failures.push({ kind: 'reuse_miss', case_class: caseClass, query, expected: expectedSubject, suggested: topKeys.slice(0, 5) })
  }
}

for (const query of newCases) {
  const suggestions = suggestionsFor(query)
  if (suggestions.length > 0) {
    novelExposure += 1
    totalExposures += 1
    if (failures.length < 20) {
      failures.push({ kind: 'novel_false_exposure', query, suggested: suggestions.map(item => item.subject_key).slice(0, 5) })
    }
  }
}

for (const query of abstainCases) {
  const suggestions = suggestionsFor(query)
  if (suggestions.length > 0) {
    ambiguousExposure += 1
    totalExposures += 1
    if (failures.length < 20) {
      failures.push({ kind: 'ambiguous_false_exposure', query, suggested: suggestions.map(item => item.subject_key).slice(0, 5) })
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

const result = {
  benchmark_id: 'ia-2f-recall-recovery-calibration-v1',
  provenance: 'CONTROLLED_SYNTHETIC_CALIBRATION_CONSUMED_IA_2E',
  independent_validation_claim: 'FORBIDDEN',
  total_cases: reuseCases.length + newCases.length + abstainCases.length,
  reuse_cases: reuseCases.length,
  novel_cases: newCases.length,
  ambiguous_cases: abstainCases.length,
  reuse_top1_accuracy: ratio(reuseTop1, reuseCases.length),
  reuse_top5_recall: ratio(reuseTop5, reuseCases.length),
  reuse_suggestion_coverage: ratio(reuseExposure, reuseCases.length),
  novel_suggestion_exposure_rate: ratio(novelExposure, newCases.length),
  ambiguous_suggestion_exposure_rate: ratio(ambiguousExposure, abstainCases.length),
  selective_top1_precision: ratio(correctTop1AcrossExposures, totalExposures),
  by_case_class: classMetrics,
  failures,
  gates: GATES,
  organic_evidence_rows_written: 0,
}

const checks = [
  ['reuse_top1_accuracy', result.reuse_top1_accuracy >= GATES.reuse_top1_accuracy_min],
  ['reuse_top5_recall', result.reuse_top5_recall >= GATES.reuse_top5_recall_min],
  ['selective_top1_precision', result.selective_top1_precision >= GATES.selective_top1_precision_min],
  ['novel_suggestion_exposure_rate', result.novel_suggestion_exposure_rate <= GATES.novel_suggestion_exposure_max],
  ['ambiguous_suggestion_exposure_rate', result.ambiguous_suggestion_exposure_rate <= GATES.ambiguous_suggestion_exposure_max],
  ['exact_canonical_top1', classMetrics.exact_canonical?.top1_accuracy >= GATES.exact_canonical_top1_min],
  ['exact_reviewed_alias_top1', classMetrics.exact_reviewed_alias?.top1_accuracy >= GATES.exact_reviewed_alias_top1_min],
  ['single_edit_typo_top5', classMetrics.single_edit_typo?.top5_recall >= GATES.single_edit_typo_top5_min],
  ['token_reorder_top5', classMetrics.token_reorder?.top5_recall >= GATES.token_reorder_top5_min],
]

console.log('IA-2F precision-preserving recall calibration result:')
console.log(JSON.stringify(result, null, 2))

const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failedChecks.length > 0) fail(`gate failures: ${failedChecks.join(', ')}`)

console.log('IA-2F recall calibration gates: PASS')
