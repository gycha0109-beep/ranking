import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const FIXTURE_PATH = 'tests/fixtures/ia-2d-controlled-semantic-benchmark.json'
const SUGGESTION_SOURCE_PATH = 'src/lib/ranking-subject-suggestions.ts'
const IDENTITY_SOURCE_PATH = 'src/lib/ranking-identity.ts'

function importTypeScriptModule(path) {
  const source = fs.readFileSync(path, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

function rate(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0
}

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'))
const suggestionModule = await importTypeScriptModule(SUGGESTION_SOURCE_PATH)
const identityModule = await importTypeScriptModule(IDENTITY_SOURCE_PATH)

assert.equal(fixture.provenance, 'CONTROLLED_SYNTHETIC', 'benchmark provenance must remain controlled synthetic')
assert.ok(fixture.benchmark_id, 'benchmark id missing')
assert.ok(Array.isArray(fixture.subject_options) && fixture.subject_options.length > 0, 'subject option corpus missing')
assert.ok(Array.isArray(fixture.decision_cases) && fixture.decision_cases.length > 0, 'decision cases missing')
assert.ok(Array.isArray(fixture.identity_cases) && fixture.identity_cases.length > 0, 'identity cases missing')

const decisionIds = new Set()
let reuseCases = 0
let newCases = 0
let suggestionExposures = 0
let positiveTop5Hits = 0
let positiveTop1Hits = 0
let aliasExactCases = 0
let aliasExactTop1Hits = 0
let novelSuggestionExposures = 0
const noisyNovelCases = []

for (const testCase of fixture.decision_cases) {
  assert.ok(!decisionIds.has(testCase.id), `duplicate benchmark decision id: ${testCase.id}`)
  decisionIds.add(testCase.id)

  const suggestions = suggestionModule.rankRankingSubjectSuggestions(
    testCase.input_subject_key,
    fixture.subject_options
  )

  if (suggestions.length > 0) suggestionExposures += 1

  if (testCase.expected_decision === 'reuse') {
    reuseCases += 1
    assert.ok(testCase.expected_subject_key, `${testCase.id}: reuse case must name the expected canonical Subject`)

    const targetIndex = suggestions.findIndex(candidate => candidate.subject_key === testCase.expected_subject_key)
    if (targetIndex >= 0 && targetIndex < 5) positiveTop5Hits += 1
    if (targetIndex === 0) positiveTop1Hits += 1

    assert.ok(
      targetIndex >= 0 && targetIndex < Number(testCase.expected_max_rank || 5),
      `${testCase.id}: expected ${testCase.expected_subject_key} within rank ${testCase.expected_max_rank || 5}, got ${suggestions.map(candidate => candidate.subject_key).join(', ') || 'no suggestions'}`
    )

    if (testCase.expected_matched_by) {
      assert.equal(
        suggestions[targetIndex]?.matched_by,
        testCase.expected_matched_by,
        `${testCase.id}: matched_by mismatch`
      )
    }

    if (testCase.case_kind === 'alias_exact') {
      aliasExactCases += 1
      if (targetIndex === 0 && suggestions[0]?.matched_by === 'alias') aliasExactTop1Hits += 1
    }
  } else if (testCase.expected_decision === 'new') {
    newCases += 1

    if (suggestions.length > 0) {
      novelSuggestionExposures += 1
      noisyNovelCases.push({
        id: testCase.id,
        input_subject_key: testCase.input_subject_key,
        top_subject_key: suggestions[0].subject_key,
        score: suggestions[0].score,
        matched_by: suggestions[0].matched_by,
        matched_key: suggestions[0].matched_key,
      })
    }

    // A candidate list is advisory only. The human-labelled expected decision remains `new`.
    assert.equal(testCase.expected_subject_key, null, `${testCase.id}: novel case must not carry an auto-resolved Subject`)
  } else {
    assert.fail(`${testCase.id}: unsupported expected_decision ${testCase.expected_decision}`)
  }
}

const identityIds = new Set()
let identityHits = 0
for (const testCase of fixture.identity_cases) {
  assert.ok(!identityIds.has(testCase.id), `duplicate identity case id: ${testCase.id}`)
  identityIds.add(testCase.id)

  const relation = identityModule.classifyRankingIdentity(testCase.current, testCase.candidate)
  const actual = relation?.kind || null
  if (actual === testCase.expected_relation) identityHits += 1
  assert.equal(actual, testCase.expected_relation, `${testCase.id}: identity relation mismatch`)
}

const positiveTop5Recall = rate(positiveTop5Hits, reuseCases)
const positiveTop1Accuracy = rate(positiveTop1Hits, reuseCases)
const aliasExactTop1Accuracy = rate(aliasExactTop1Hits, aliasExactCases)
const novelSuggestionExposureRate = rate(novelSuggestionExposures, newCases)
const identityAccuracy = rate(identityHits, fixture.identity_cases.length)

assert.ok(fixture.decision_cases.length >= fixture.gates.minimum_decision_cases, 'controlled decision sample below gate')
assert.ok(reuseCases >= fixture.gates.minimum_reuse_cases, 'controlled reuse sample below gate')
assert.ok(newCases >= fixture.gates.minimum_new_cases, 'controlled new-Subject sample below gate')
assert.ok(suggestionExposures >= fixture.gates.minimum_suggestion_exposures, 'controlled suggestion exposure sample below gate')
assert.ok(positiveTop5Recall >= fixture.gates.minimum_positive_top5_recall, 'controlled positive Top-5 recall below gate')
assert.ok(positiveTop1Accuracy >= fixture.gates.minimum_positive_top1_accuracy, 'controlled positive Top-1 accuracy below gate')
assert.ok(aliasExactTop1Accuracy >= fixture.gates.minimum_alias_exact_top1_accuracy, 'controlled alias exact Top-1 accuracy below gate')
assert.ok(identityAccuracy >= fixture.gates.identity_case_accuracy, 'controlled identity accuracy below gate')

noisyNovelCases.sort((left, right) => {
  if (left.score !== right.score) return right.score - left.score
  return left.id.localeCompare(right.id)
})

console.log('IA-2D controlled semantic benchmark verified.')
console.log(`benchmark_id=${fixture.benchmark_id}`)
console.log(`provenance=${fixture.provenance}`)
console.log(`subject_options=${fixture.subject_options.length}`)
console.log(`decisions=${fixture.decision_cases.length}`)
console.log(`reuse=${reuseCases}`)
console.log(`new=${newCases}`)
console.log(`suggestion_exposures=${suggestionExposures}`)
console.log(`positive_top5_recall=${positiveTop5Recall.toFixed(4)}`)
console.log(`positive_top1_accuracy=${positiveTop1Accuracy.toFixed(4)}`)
console.log(`alias_exact_top1_accuracy=${aliasExactTop1Accuracy.toFixed(4)}`)
console.log(`novel_suggestion_exposure_rate=${novelSuggestionExposureRate.toFixed(4)}`)
console.log(`identity_cases=${fixture.identity_cases.length}`)
console.log(`identity_accuracy=${identityAccuracy.toFixed(4)}`)
console.log('organic_evidence_rows_written=0')
console.log('organic_readiness_impact=NONE')

if (noisyNovelCases.length > 0) {
  console.log('top_noisy_novel_suggestions:')
  for (const entry of noisyNovelCases.slice(0, 10)) {
    console.log(`- ${entry.input_subject_key} -> ${entry.top_subject_key} score=${entry.score} matched_by=${entry.matched_by}:${entry.matched_key}`)
  }
}
