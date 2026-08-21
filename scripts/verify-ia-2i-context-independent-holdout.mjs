import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const fixturePath = path.join(root, 'tests/ia-2i/holdout.json')
const lexicalPath = path.join(root, 'src/lib/ranking-subject-suggestions.ts')
const contextPath = path.join(root, 'src/lib/ranking-subject-context.ts')

const FROZEN_MAIN_SHA = 'b278cef92b95fd80c27b31ebcb4d0eec7b04c3d3'
const FROZEN_LEXICAL_BLOB_SHA = '49f8d8ea220d1ee1d4fa229f8f3a5a0aff048a47'
const FROZEN_CONTEXT_BLOB_SHA = 'ae6edc3086280324c7537f7afe14b1e08a2ef5c7'
const SEALED_HOLDOUT_BLOB_SHA = 'b748a118fa527c376f12db31ce43291270c8c13a'

const EXPECTED_CLASS_COUNTS = {
  lexical_reuse: 20,
  context_reuse: 20,
  novel_familiar_items: 20,
  competing_subjects: 10,
  insufficient_support: 10,
}

function fail(message) {
  console.error(`IA-2I holdout integrity failed: ${message}`)
  process.exit(1)
}

function gitBlobSha1(buffer) {
  return crypto
    .createHash('sha1')
    .update(`blob ${buffer.length}\0`)
    .update(buffer)
    .digest('hex')
}

function readFrozenSource(filePath, expectedBlob, label) {
  if (!fs.existsSync(filePath)) fail(`${label} source is missing`)
  const raw = fs.readFileSync(filePath)
  const actual = gitBlobSha1(raw)
  if (actual !== expectedBlob) fail(`${label} changed after freeze: ${actual}`)
  return raw
}

function loadTsModule(raw, filePath) {
  const transpiled = ts.transpileModule(raw.toString('utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
    fileName: filePath,
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)
}

if (!fs.existsSync(fixturePath)) fail('sealed holdout fixture is missing')
const fixtureRaw = fs.readFileSync(fixturePath)
const fixtureBlob = gitBlobSha1(fixtureRaw)
if (fixtureBlob !== SEALED_HOLDOUT_BLOB_SHA) {
  fail(`sealed holdout changed after fixture commit: ${fixtureBlob}`)
}

const fixture = JSON.parse(fixtureRaw.toString('utf8'))
if (fixture.benchmark_id !== 'ia-2i-context-independent-holdout-v1') fail('benchmark id changed')
if (fixture.provenance !== 'CONTROLLED_SYNTHETIC_INDEPENDENT_HOLDOUT') fail('provenance changed')
if (fixture.authored_after_freeze_main_sha !== FROZEN_MAIN_SHA) fail('fixture freeze main SHA mismatch')
if (!Array.isArray(fixture.options) || fixture.options.length !== 20) fail('expected 20 Subject options')
if (!Array.isArray(fixture.cases) || fixture.cases.length !== 80) fail('expected 80 holdout cases')

const observedClassCounts = Object.fromEntries(Object.keys(EXPECTED_CLASS_COUNTS).map(key => [key, 0]))
const seenIds = new Set()
for (const row of fixture.cases) {
  if (!row || typeof row !== 'object') fail('invalid case row')
  if (seenIds.has(row.id)) fail(`duplicate case id: ${row.id}`)
  seenIds.add(row.id)
  if (!(row.case_class in EXPECTED_CLASS_COUNTS)) fail(`unexpected class: ${row.case_class}`)
  observedClassCounts[row.case_class] += 1
  if (!['reuse', 'novel', 'ambiguous'].includes(row.kind)) fail(`invalid kind: ${row.kind}`)
  if (typeof row.query !== 'string' || !row.query) fail(`invalid query: ${row.id}`)
  if (!row.current || !Array.isArray(row.current.item_ids)) fail(`invalid current graph: ${row.id}`)
  if (!Array.isArray(row.projections)) fail(`invalid projections: ${row.id}`)
  if (row.kind === 'reuse' && typeof row.expected_subject !== 'string') fail(`reuse target missing: ${row.id}`)
  if (row.kind !== 'reuse' && row.expected_subject !== null) fail(`non-reuse target must be null: ${row.id}`)
}
for (const [name, expected] of Object.entries(EXPECTED_CLASS_COUNTS)) {
  if (observedClassCounts[name] !== expected) fail(`expected ${expected} ${name}, got ${observedClassCounts[name]}`)
}

const lexicalRaw = readFrozenSource(lexicalPath, FROZEN_LEXICAL_BLOB_SHA, 'lexical matcher')
const contextRaw = readFrozenSource(contextPath, FROZEN_CONTEXT_BLOB_SHA, 'context helper')
const lexicalModule = await loadTsModule(lexicalRaw, lexicalPath)
const contextModule = await loadTsModule(contextRaw, contextPath)
const { rankRankingSubjectSuggestions } = lexicalModule
const { rankRankingSubjectContextSuggestions } = contextModule
if (typeof rankRankingSubjectSuggestions !== 'function') fail('lexical matcher export unavailable')
if (typeof rankRankingSubjectContextSuggestions !== 'function') fail('context helper export unavailable')

const options = fixture.options.map(row => {
  if (!Array.isArray(row) || row.length !== 3) fail('invalid option row')
  const [subject_key, usage_count, aliases] = row
  if (typeof subject_key !== 'string' || !Number.isFinite(usage_count) || !Array.isArray(aliases)) {
    fail(`invalid Subject option: ${subject_key}`)
  }
  return { subject_key, usage_count, aliases }
})

const optionKeys = new Set(options.map(option => option.subject_key))
if (optionKeys.size !== options.length) fail('duplicate canonical Subject option')
for (const row of fixture.cases) {
  if (row.kind === 'reuse' && !optionKeys.has(row.expected_subject)) {
    fail(`reuse target missing from Subject options: ${row.expected_subject}`)
  }
  for (const projection of row.projections) {
    if (!optionKeys.has(projection.subject_key)) fail(`projection Subject missing from options: ${projection.subject_key}`)
  }
}

function lexicalKeys(row) {
  return rankRankingSubjectSuggestions(row.query, options).map(item => item.subject_key)
}

function combinedKeys(row) {
  const lexical = lexicalKeys(row)
  if (lexical.length > 0) return { keys: lexical, source: 'lexical' }
  const context = rankRankingSubjectContextSuggestions(row.current, row.projections)
  return { keys: context.map(item => item.subject_key), source: context.length > 0 ? 'context' : 'abstain' }
}

function blankMetrics() {
  return {
    reuse_total: 0,
    reuse_top1: 0,
    reuse_exposure: 0,
    novel_total: 0,
    novel_exposure: 0,
    ambiguous_total: 0,
    ambiguous_exposure: 0,
    total_exposures: 0,
    correct_top1_exposures: 0,
  }
}

const lexicalMetrics = blankMetrics()
const combinedMetrics = blankMetrics()
const byClass = new Map()
const firstFailures = []
let contextOnlyRecoveries = 0
let contextFalseExposures = 0
let contextAbstentions = 0

function observe(metrics, row, keys) {
  const exposed = keys.length > 0
  if (exposed) metrics.total_exposures += 1

  if (row.kind === 'reuse') {
    metrics.reuse_total += 1
    if (exposed) metrics.reuse_exposure += 1
    if (keys[0] === row.expected_subject) {
      metrics.reuse_top1 += 1
      metrics.correct_top1_exposures += 1
    }
    return
  }

  if (row.kind === 'novel') {
    metrics.novel_total += 1
    if (exposed) metrics.novel_exposure += 1
    return
  }

  metrics.ambiguous_total += 1
  if (exposed) metrics.ambiguous_exposure += 1
}

for (const row of fixture.cases) {
  const lexical = lexicalKeys(row)
  const combined = combinedKeys(row)
  observe(lexicalMetrics, row, lexical)
  observe(combinedMetrics, row, combined.keys)

  const bucket = byClass.get(row.case_class) || {
    total: 0,
    lexical_top1: 0,
    lexical_exposure: 0,
    combined_top1: 0,
    combined_exposure: 0,
    context_used: 0,
  }
  bucket.total += 1
  bucket.lexical_top1 += Number(row.kind === 'reuse' && lexical[0] === row.expected_subject)
  bucket.lexical_exposure += Number(lexical.length > 0)
  bucket.combined_top1 += Number(row.kind === 'reuse' && combined.keys[0] === row.expected_subject)
  bucket.combined_exposure += Number(combined.keys.length > 0)
  bucket.context_used += Number(combined.source === 'context')
  byClass.set(row.case_class, bucket)

  if (lexical.length === 0 && combined.source === 'context') {
    if (row.kind === 'reuse' && combined.keys[0] === row.expected_subject) contextOnlyRecoveries += 1
    if (row.kind !== 'reuse') contextFalseExposures += 1
  }
  if (lexical.length === 0 && combined.source === 'abstain') contextAbstentions += 1

  const combinedCorrect = row.kind === 'reuse'
    ? combined.keys[0] === row.expected_subject
    : combined.keys.length === 0
  if (!combinedCorrect && firstFailures.length < 30) {
    firstFailures.push({
      id: row.id,
      kind: row.kind,
      case_class: row.case_class,
      query: row.query,
      expected: row.expected_subject,
      lexical: lexical.slice(0, 5),
      combined: combined.keys.slice(0, 5),
      combined_source: combined.source,
    })
  }
}

const ratio = (numerator, denominator) => denominator === 0 ? 0 : numerator / denominator
function summarize(metrics) {
  return {
    reuse_top1_accuracy: ratio(metrics.reuse_top1, metrics.reuse_total),
    reuse_suggestion_coverage: ratio(metrics.reuse_exposure, metrics.reuse_total),
    novel_suggestion_exposure_rate: ratio(metrics.novel_exposure, metrics.novel_total),
    ambiguous_suggestion_exposure_rate: ratio(metrics.ambiguous_exposure, metrics.ambiguous_total),
    selective_top1_precision: ratio(metrics.correct_top1_exposures, metrics.total_exposures),
    total_exposures: metrics.total_exposures,
  }
}

const classMetrics = Object.fromEntries([...byClass.entries()].map(([name, value]) => [name, {
  total: value.total,
  lexical_top1_accuracy: ratio(value.lexical_top1, value.total),
  lexical_exposure_rate: ratio(value.lexical_exposure, value.total),
  combined_top1_accuracy: ratio(value.combined_top1, value.total),
  combined_exposure_rate: ratio(value.combined_exposure, value.total),
  context_usage_rate: ratio(value.context_used, value.total),
}]))

const lexicalSummary = summarize(lexicalMetrics)
const combinedSummary = summarize(combinedMetrics)
const result = {
  benchmark_id: fixture.benchmark_id,
  provenance: fixture.provenance,
  holdout_integrity: 'PASS',
  frozen_main_sha: FROZEN_MAIN_SHA,
  frozen_lexical_blob_sha: FROZEN_LEXICAL_BLOB_SHA,
  frozen_context_blob_sha: FROZEN_CONTEXT_BLOB_SHA,
  sealed_holdout_blob_sha: SEALED_HOLDOUT_BLOB_SHA,
  total_cases: fixture.cases.length,
  class_counts: observedClassCounts,
  lexical_only: lexicalSummary,
  lexical_plus_context: combinedSummary,
  delta: {
    reuse_top1_accuracy: combinedSummary.reuse_top1_accuracy - lexicalSummary.reuse_top1_accuracy,
    reuse_suggestion_coverage: combinedSummary.reuse_suggestion_coverage - lexicalSummary.reuse_suggestion_coverage,
    novel_suggestion_exposure_rate: combinedSummary.novel_suggestion_exposure_rate - lexicalSummary.novel_suggestion_exposure_rate,
    ambiguous_suggestion_exposure_rate: combinedSummary.ambiguous_suggestion_exposure_rate - lexicalSummary.ambiguous_suggestion_exposure_rate,
    selective_top1_precision: combinedSummary.selective_top1_precision - lexicalSummary.selective_top1_precision,
  },
  context_only_recoveries: contextOnlyRecoveries,
  context_false_exposures: contextFalseExposures,
  context_abstentions: contextAbstentions,
  by_case_class: classMetrics,
  first_failure_samples: firstFailures,
  performance_gate: 'NONE_FIRST_RUN_RESULT_MUST_BE_RECORDED_AS_OBSERVED',
  mutation_after_observation: 'FORBIDDEN_IN_IA_2I',
  organic_evidence_rows_written: 0,
}

console.log('IA-2I independent context holdout execution completed.')
console.log(JSON.stringify(result, null, 2))
