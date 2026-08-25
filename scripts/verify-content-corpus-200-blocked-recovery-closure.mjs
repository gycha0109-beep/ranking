import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  closure: p('content/corpus-200/recovery/blocked-recovery-closure.json'),
  wave1: p('content/corpus-200/materialization/wave-1.json'),
  wave2: p('content/corpus-200/materialization/wave-2.json'),
  wave2Provenance: p('content/corpus-200/materialization/wave-2-provenance.json'),
  wave3: p('content/corpus-200/materialization/wave-3.json'),
  wave4: p('content/corpus-200/materialization/wave-4.json'),
  wave4a: p('content/corpus-200/materialization/wave-4-families-a.json'),
  wave4b: p('content/corpus-200/materialization/wave-4-families-b.json'),
  page: p('src/app/rankings/[rankingSlug]/page.tsx'),
  pkg: p('package.json'),
  ci: p('.github/workflows/ci.yml'),
}
for (let index = 1; index <= 8; index += 1) files[`r${index}`] = p(`content/corpus-200/recovery/blocked-evidence-r${index}.json`)

const MANIFEST = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const WAVE_SHA = {
  1: '7e0c2b11cf9f6f5b4468d3ab112a2fa31d5ace2a55ef4bca0713771647562f6c',
  2: 'dab9b2cde2b8bbf3e6eed3ddcdf166df408d2df30a20bbb3e38bbbf105276023',
  3: 'f366862c0b6d9edd881245dbaba35572faa4e7bbde8b10c4af4ac5872634e756',
  4: '7383ff4509bd4d2f254a511a80e313f625004231e6d615736375cae19cb89436',
}
const RECOVERY_SHA = [
  ['r1', '6e5897ef79dc7280e7da1e2b87a2f663f49d383f27a7d65885c84fa09381c42c'],
  ['r2', '6ded2c4dc33993e223ffac3ed777a232ec40aa9d5a7556b6c25d1f28653474cc'],
  ['r3', 'fe70b352fa329a1d230c87cb071b44e92b67e246758b62099aec7c7679505a9e'],
  ['r4', 'efedcd57539a34169fc658b8b34a78006b031178e5ddbe15ef9f4042bf782d61'],
  ['r5', '54d94c069c2ea8731330d3aa1b2d9620bd37559f4e4df9cdd42692352927ac37'],
  ['r6', 'f2053d7fe208cc6bf658ddebd9c21a2ed3778ed84e90c73f2e94f43f3eeeab36'],
  ['r7', 'c84557fe19b4371c2ab2fcc093197ecb111f588b1693fea1b767f4fc0930d334'],
  ['r8', '8105d95ab4b04fda5bcf16ed57294d40632bba2b37b3b561b62325e001b0dd92'],
]
const EXPECTED = '5b409992bb35914b1076ceebdd56545664438ca5205b6c0d16dc39b91cc06ff3'

const fail = (message) => { console.error(`CONTENT-CORPUS-200 blocked recovery closure verification failed: ${message}`); process.exit(1) }
const ok = (value, message) => { if (!value) fail(message) }
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
const sameSet = (left, right) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
const sortFacts = (rows) => [...rows].sort((a, b) => a.wave - b.wave || a.familyId.localeCompare(b.familyId) || a.manifestId.localeCompare(b.manifestId))

for (const file of Object.values(files)) ok(fs.existsSync(file), `${path.basename(file)} must exist`)

const closure = read(files.closure)
const wave1 = read(files.wave1)
const wave2 = read(files.wave2)
const wave2Provenance = read(files.wave2Provenance)
const wave3 = read(files.wave3)
const wave4 = read(files.wave4)
const wave4a = read(files.wave4a)
const wave4b = read(files.wave4b)
const recoveryDocs = RECOVERY_SHA.map(([id]) => read(files[id]))
const page = fs.readFileSync(files.page, 'utf8')
const pkg = read(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

const observedWaveSha = {
  1: jsonSha(wave1),
  2: jsonSha({ wave: wave2, provenance: wave2Provenance }),
  3: jsonSha(wave3),
  4: jsonSha({ index: wave4, familyA: wave4a, familyB: wave4b }),
}
for (const wave of [1, 2, 3, 4]) ok(observedWaveSha[wave] === WAVE_SHA[wave], `frozen Wave ${wave} evidence mutated`)
for (let index = 0; index < RECOVERY_SHA.length; index += 1) {
  const [id, expectedSha] = RECOVERY_SHA[index]
  ok(jsonSha(recoveryDocs[index]) === expectedSha, `frozen Recovery ${id.toUpperCase()} evidence mutated`)
}

ok(closure.version === 'content-corpus-200-blocked-recovery-closure-v1', 'closure version mismatch')
ok(closure.manifestVersion === 'content-corpus-200-manifest-v1' && closure.manifestSha256 === MANIFEST, 'manifest identity mismatch')
ok(closure.status === 'BLOCKED_RECOVERY_PHASE_CLOSED_WITH_UNRESOLVED_FACTS', 'closure status mismatch')
ok(closure.observedAt === '2026-08-25T18:34:00+09:00', 'closure observation time mismatch')
ok(JSON.stringify(closure.baseWaves) === JSON.stringify([1, 2, 3, 4].map((wave) => ({ wave, evidenceSha256: WAVE_SHA[wave] }))), 'base wave identities mismatch')
ok(JSON.stringify(closure.recoveries?.map((row) => [row.id, row.evidenceSha256])) === JSON.stringify(RECOVERY_SHA), 'recovery identities/order mismatch')
ok(Object.values(closure.authorityBoundary || {}).every((value) => value === false), 'all authority flags must remain false')
ok(closure.closureBoundary?.newSourceEvidenceAdded === false, 'closure must not claim new source evidence')
ok(closure.closureBoundary?.sourceRequirementDowngraded === false, 'source requirement downgrade is forbidden')
ok(closure.closureBoundary?.metricSubstitutionAuthorized === false, 'metric substitution must remain unauthorized')
ok(closure.closureBoundary?.candidateScopeExpansionAuthorized === false, 'candidate scope expansion must remain unauthorized')
ok(closure.closureBoundary?.unresolvedFactsRemainBlocked === true, 'unresolved FACTs must remain blocked')
ok(closure.closureBoundary?.reopenCondition === 'NEW_REVIEWED_SOURCE_EVIDENCE_MUST_SATISFY_EXISTING_METRIC_SCOPE_AND_COMPARABILITY_BOUNDARIES', 'reopen condition mismatch')

const familiesByWave = new Map([
  [1, wave1.families || []],
  [2, wave2.families || []],
  [3, wave3.families || []],
  [4, [...(wave4a.families || []), ...(wave4b.families || [])]],
])
const baseBlockedFacts = []
for (const [wave, families] of familiesByWave) {
  for (const family of families) {
    for (const ranking of family.rankings || []) {
      if (ranking.kind !== 'FACT' || ranking.materializationStatus !== 'BLOCKED_SOURCE_GAP') continue
      ok(typeof ranking.blocker === 'string' && ranking.blocker.length > 0, `${ranking.manifestId} blocked FACT must preserve blocker`)
      baseBlockedFacts.push({ wave, familyId: family.familyId, manifestId: ranking.manifestId, baseBlocker: ranking.blocker })
    }
  }
}
ok(baseBlockedFacts.length === 29, `expected 29 original blocked FACTs, observed ${baseBlockedFacts.length}`)
ok(new Set(baseBlockedFacts.map((row) => row.manifestId)).size === 29, 'original blocked FACT ids must be unique')

const recoveredFacts = recoveryDocs.flatMap((doc) => (doc.recoveredFacts || []).map((row) => row.manifestId))
const expectedRecoveredFacts = [
  'cc200-convenience-protein-01',
  'cc200-fifa-national-teams-02',
  'cc200-steam-coop-survival-02',
  'cc200-streaming-services-03',
  'cc200-sunscreens-01',
  'cc200-steam-mainstream-02',
  'cc200-netflix-titles-03',
  'cc200-convenience-protein-02',
  'cc200-convenience-protein-03',
]
ok(recoveredFacts.length === 9 && new Set(recoveredFacts).size === 9, 'R1-R8 must recover exactly nine unique FACTs')
ok(JSON.stringify(recoveredFacts) === JSON.stringify(expectedRecoveredFacts), 'R1-R8 recovered FACT lineage/order mismatch')
ok(JSON.stringify(closure.recoveredFacts) === JSON.stringify(expectedRecoveredFacts), 'closure recovered FACT list mismatch')
for (const manifestId of recoveredFacts) ok(baseBlockedFacts.some((row) => row.manifestId === manifestId), `${manifestId} recovery must originate from a frozen base blocker`)

const recoveredSet = new Set(recoveredFacts)
const derivedUnresolved = sortFacts(baseBlockedFacts.filter((row) => !recoveredSet.has(row.manifestId)))
const declaredUnresolved = sortFacts(closure.unresolvedFacts || [])
ok(derivedUnresolved.length === 20, `expected 20 unresolved FACTs, observed ${derivedUnresolved.length}`)
ok(new Set(derivedUnresolved.map((row) => row.manifestId)).size === 20, 'unresolved FACT ids must be unique')
ok(JSON.stringify(declaredUnresolved) === JSON.stringify(derivedUnresolved), 'closure unresolved FACT inventory must exactly equal frozen base blockers minus R1-R8 recoveries')
ok(!declaredUnresolved.some((row) => recoveredSet.has(row.manifestId)), 'recovered FACT cannot remain in unresolved inventory')

const summary = closure.recoverySummary || {}
ok(summary.originalBlockedFactCount === 29 && summary.recoveredFactCount === 9 && summary.unresolvedBlockedFactCount === 20, 'global recovery counts mismatch')
const expectedByWave = [
  { wave: 1, originalBlockedFacts: 4, recoveredFacts: 2, unresolvedFacts: 2 },
  { wave: 2, originalBlockedFacts: 6, recoveredFacts: 1, unresolvedFacts: 5 },
  { wave: 3, originalBlockedFacts: 6, recoveredFacts: 3, unresolvedFacts: 3 },
  { wave: 4, originalBlockedFacts: 13, recoveredFacts: 3, unresolvedFacts: 10 },
]
ok(JSON.stringify(summary.byWave) === JSON.stringify(expectedByWave), 'per-wave recovery counts mismatch')
for (const expected of expectedByWave) {
  const originals = baseBlockedFacts.filter((row) => row.wave === expected.wave).length
  const recovered = baseBlockedFacts.filter((row) => row.wave === expected.wave && recoveredSet.has(row.manifestId)).length
  const unresolved = derivedUnresolved.filter((row) => row.wave === expected.wave).length
  ok(originals === expected.originalBlockedFacts && recovered === expected.recoveredFacts && unresolved === expected.unresolvedFacts, `Wave ${expected.wave} derived recovery counts mismatch`)
}
ok(summary.recoveredFactCount + summary.unresolvedBlockedFactCount === summary.originalBlockedFactCount, 'recovery arithmetic mismatch')

ok(!page.includes('blocked-recovery-closure.json'), 'public ranking page must not consume recovery closure evidence')
ok(pkg.scripts?.['verify:content-corpus-200-blocked-recovery-closure'] === 'node scripts/verify-content-corpus-200-blocked-recovery-closure.mjs', 'package recovery closure verifier wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-blocked-recovery-r8\n      - run: npm run verify:content-corpus-200-blocked-recovery-closure'), 'CI recovery closure verifier must follow R8')

const sha = jsonSha(closure)
console.log('CONTENT-CORPUS-200 blocked recovery closure result:')
console.log(JSON.stringify({
  version: closure.version,
  manifestSha256: closure.manifestSha256,
  evidenceSha256: sha,
  originalBlockedFactCount: summary.originalBlockedFactCount,
  recoveredFactCount: summary.recoveredFactCount,
  unresolvedBlockedFactCount: summary.unresolvedBlockedFactCount,
  byWave: summary.byWave,
  authority: closure.authorityBoundary,
}, null, 2))
ok(EXPECTED !== 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION', `recovery closure evidence must be frozen after first structurally valid execution; observed sha256=${sha}`)
ok(sha === EXPECTED, `recovery closure evidence freeze mismatch: expected ${EXPECTED}, observed ${sha}`)
console.log(`CONTENT-CORPUS-200 blocked recovery closure contracts: PASS (${sha.slice(0, 16)})`)
