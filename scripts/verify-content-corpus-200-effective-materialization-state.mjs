import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  state: p('content/corpus-200/effective-materialization-state.json'),
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
const CLOSURE_SHA = '5b409992bb35914b1076ceebdd56545664438ca5205b6c0d16dc39b91cc06ff3'
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
const EXPECTED = 'e25f7ba735695f8171b22ce9ba0d6bb0e6e36dea1963d3596d3edbd9a5e14618'

const fail = (message) => { console.error(`CONTENT-CORPUS-200 effective materialization state verification failed: ${message}`); process.exit(1) }
const ok = (value, message) => { if (!value) fail(message) }
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files)) ok(fs.existsSync(file), `${path.basename(file)} must exist`)

const state = read(files.state)
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
ok(jsonSha(closure) === CLOSURE_SHA, 'recovery closure evidence mutated')
ok(closure.status === 'BLOCKED_RECOVERY_PHASE_CLOSED_WITH_UNRESOLVED_FACTS', 'recovery phase must remain closed before deriving effective state')

ok(state.version === 'content-corpus-200-effective-materialization-state-v1', 'effective state version mismatch')
ok(state.manifestVersion === 'content-corpus-200-manifest-v1' && state.manifestSha256 === MANIFEST, 'manifest identity mismatch')
ok(state.status === 'DERIVED_PREPUBLICATION_EFFECTIVE_STATE_AFTER_RECOVERY_CLOSURE', 'effective state status mismatch')
ok(state.derivedAt === '2026-08-26T09:27:00+09:00', 'derived timestamp mismatch')
ok(state.derivedFrom?.recoveryClosureVersion === closure.version, 'closure version lineage mismatch')
ok(state.derivedFrom?.recoveryClosureEvidenceSha256 === CLOSURE_SHA, 'closure SHA lineage mismatch')
ok(JSON.stringify(state.derivedFrom?.baseWaveEvidenceSha256) === JSON.stringify([1, 2, 3, 4].map((wave) => ({ wave, sha256: WAVE_SHA[wave] }))), 'base wave lineage mismatch')
ok(JSON.stringify(state.derivedFrom?.recoveryEvidenceSha256) === JSON.stringify(RECOVERY_SHA.map(([id, sha256]) => ({ id, sha256 }))), 'recovery lineage mismatch')

const boundary = state.derivationBoundary || {}
ok(boundary.baseEvidenceMutated === false, 'base evidence mutation must remain false')
ok(boundary.recoveryEvidenceMutated === false, 'recovery evidence mutation must remain false')
ok(boundary.recoveryOverlayOnly === true, 'effective state must be recovery-overlay only')
ok(boundary.recoveredFactsOverrideOnlyTheirOriginalBlockedFactState === true, 'recovery override boundary mismatch')
ok(boundary.unresolvedFactsRemainBlocked === true, 'unresolved FACTs must remain blocked')
ok(boundary.editorialWeightsAssigned === false, 'editorial scoring remains unauthorized')
ok(boundary.communityVotesFabricated === false, 'community vote fabrication remains forbidden')
ok(boundary.productionRowsCreated === false, 'effective state must not claim production rows')
ok(Object.values(state.authorityBoundary || {}).every((value) => value === false), 'all authority flags must remain false')

const familiesByWave = new Map([
  [1, wave1.families || []],
  [2, wave2.families || []],
  [3, wave3.families || []],
  [4, [...(wave4a.families || []), ...(wave4b.families || [])]],
])
const recoveredFacts = recoveryDocs.flatMap((doc) => (doc.recoveredFacts || []).map((row) => row.manifestId))
ok(recoveredFacts.length === 9 && new Set(recoveredFacts).size === 9, 'R1-R8 must expose exactly nine unique recovered FACT ids')
ok(JSON.stringify(recoveredFacts) === JSON.stringify(closure.recoveredFacts), 'effective recovery overlay must match closure recovered FACT lineage')
const recoveredSet = new Set(recoveredFacts)
const unresolvedSet = new Set((closure.unresolvedFacts || []).map((row) => row.manifestId))
ok(unresolvedSet.size === 20, 'closure must preserve exactly 20 unresolved FACT ids')

function blankWaveSummary(wave) {
  return {
    wave,
    totalRankings: 0,
    effectiveReadyRows: 0,
    blockedRows: 0,
    fact: { total: 0, materializedBase: 0, materializedRecovery: 0, blockedSourceGap: 0 },
    editorial: { total: 0, candidatesFrozenScoringUnassigned: 0, blockedCandidateGap: 0 },
    vote: { total: 0, candidatesFrozenNoVotes: 0, blockedCandidateGap: 0 },
  }
}

const byWave = []
const allIds = []
for (const [wave, families] of familiesByWave) {
  const summary = blankWaveSummary(wave)
  for (const family of families) {
    for (const ranking of family.rankings || []) {
      summary.totalRankings += 1
      allIds.push(ranking.manifestId)
      if (ranking.kind === 'FACT') {
        summary.fact.total += 1
        if (['MATERIALIZED_FACT', 'MATERIALIZED_COMPARISON'].includes(ranking.materializationStatus)) {
          ok(!recoveredSet.has(ranking.manifestId), `${ranking.manifestId} cannot be both base-materialized and recovered`)
          summary.fact.materializedBase += 1
          summary.effectiveReadyRows += 1
        } else if (ranking.materializationStatus === 'BLOCKED_SOURCE_GAP') {
          if (recoveredSet.has(ranking.manifestId)) {
            summary.fact.materializedRecovery += 1
            summary.effectiveReadyRows += 1
          } else {
            ok(unresolvedSet.has(ranking.manifestId), `${ranking.manifestId} base-blocked FACT must be recovered or explicitly unresolved`)
            summary.fact.blockedSourceGap += 1
            summary.blockedRows += 1
          }
        } else {
          fail(`${ranking.manifestId} has unknown FACT materialization status ${ranking.materializationStatus}`)
        }
      } else if (ranking.kind === 'EDITORIAL_COMPOSITE') {
        summary.editorial.total += 1
        if (ranking.materializationStatus === 'CANDIDATES_FROZEN_SCORING_UNASSIGNED') {
          ok(ranking.scoringStatus === 'UNASSIGNED_EVIDENCE_REVIEW_REQUIRED', `${ranking.manifestId} scoring must remain unassigned`)
          summary.editorial.candidatesFrozenScoringUnassigned += 1
          summary.effectiveReadyRows += 1
        } else if (ranking.materializationStatus === 'BLOCKED_CANDIDATE_GAP') {
          summary.editorial.blockedCandidateGap += 1
          summary.blockedRows += 1
        } else {
          fail(`${ranking.manifestId} has unknown editorial materialization status ${ranking.materializationStatus}`)
        }
      } else if (ranking.kind === 'COMMUNITY_VOTE') {
        summary.vote.total += 1
        if (ranking.materializationStatus === 'CANDIDATES_FROZEN_NO_VOTES') {
          ok(ranking.voteCountStatus === 'NOT_STARTED_NO_FABRICATED_VOTES', `${ranking.manifestId} vote count must remain unstarted`)
          summary.vote.candidatesFrozenNoVotes += 1
          summary.effectiveReadyRows += 1
        } else if (ranking.materializationStatus === 'BLOCKED_CANDIDATE_GAP') {
          summary.vote.blockedCandidateGap += 1
          summary.blockedRows += 1
        } else {
          fail(`${ranking.manifestId} has unknown vote materialization status ${ranking.materializationStatus}`)
        }
      } else {
        fail(`${ranking.manifestId} has unknown ranking kind ${ranking.kind}`)
      }
    }
  }
  ok(summary.totalRankings === summary.effectiveReadyRows + summary.blockedRows, `Wave ${wave} readiness arithmetic mismatch`)
  byWave.push(summary)
}

ok(allIds.length === 200, `expected 200 effective-state rows, observed ${allIds.length}`)
ok(new Set(allIds).size === 200, 'effective-state manifest ids must be unique across waves')
ok(recoveredFacts.every((manifestId) => allIds.includes(manifestId)), 'every recovered FACT must exist in frozen wave materialization')
ok([...unresolvedSet].every((manifestId) => allIds.includes(manifestId)), 'every unresolved FACT must exist in frozen wave materialization')
ok(JSON.stringify(state.byWave) === JSON.stringify(byWave), 'declared by-wave effective state must equal derived frozen-artifact state')

const totals = byWave.reduce((acc, row) => {
  acc.totalRankings += row.totalRankings
  acc.effectiveReadyRows += row.effectiveReadyRows
  acc.blockedRows += row.blockedRows
  acc.fact.total += row.fact.total
  acc.fact.materializedBase += row.fact.materializedBase
  acc.fact.materializedRecovery += row.fact.materializedRecovery
  acc.fact.blockedSourceGap += row.fact.blockedSourceGap
  acc.editorial.total += row.editorial.total
  acc.editorial.candidatesFrozenScoringUnassigned += row.editorial.candidatesFrozenScoringUnassigned
  acc.editorial.blockedCandidateGap += row.editorial.blockedCandidateGap
  acc.vote.total += row.vote.total
  acc.vote.candidatesFrozenNoVotes += row.vote.candidatesFrozenNoVotes
  acc.vote.blockedCandidateGap += row.vote.blockedCandidateGap
  return acc
}, {
  totalRankings: 0,
  effectiveReadyRows: 0,
  blockedRows: 0,
  fact: { total: 0, materializedBase: 0, materializedRecovery: 0, blockedSourceGap: 0 },
  editorial: { total: 0, candidatesFrozenScoringUnassigned: 0, blockedCandidateGap: 0 },
  vote: { total: 0, candidatesFrozenNoVotes: 0, blockedCandidateGap: 0 },
})

const declared = state.effectiveSummary || {}
ok(declared.totalRankings === totals.totalRankings, 'global total ranking count mismatch')
ok(declared.effectiveReadyRows === totals.effectiveReadyRows, 'global effective-ready count mismatch')
ok(declared.blockedRows === totals.blockedRows, 'global blocked count mismatch')
ok(JSON.stringify(declared.byContentType?.FACT) === JSON.stringify(totals.fact), 'FACT effective-state counts mismatch')
ok(JSON.stringify(declared.byContentType?.EDITORIAL_COMPOSITE) === JSON.stringify(totals.editorial), 'EDITORIAL effective-state counts mismatch')
ok(JSON.stringify(declared.byContentType?.COMMUNITY_VOTE) === JSON.stringify(totals.vote), 'COMMUNITY_VOTE effective-state counts mismatch')
ok(totals.fact.total === 60 && totals.editorial.total === 90 && totals.vote.total === 50, 'content mix must remain 60/90/50')
ok(totals.fact.materializedBase === 31 && totals.fact.materializedRecovery === 9 && totals.fact.blockedSourceGap === 20, 'FACT overlay counts must remain 31/9/20')
ok(totals.editorial.candidatesFrozenScoringUnassigned === 76 && totals.editorial.blockedCandidateGap === 14, 'editorial candidate readiness must remain 76/14')
ok(totals.vote.candidatesFrozenNoVotes === 43 && totals.vote.blockedCandidateGap === 7, 'vote candidate readiness must remain 43/7')
ok(totals.effectiveReadyRows === 159 && totals.blockedRows === 41, 'global readiness must remain 159/41')
ok(totals.effectiveReadyRows + totals.blockedRows === 200, 'global readiness arithmetic mismatch')

ok(!page.includes('effective-materialization-state.json'), 'public ranking page must not consume prepublication effective-state artifact')
ok(pkg.scripts?.['verify:content-corpus-200-effective-state'] === 'node scripts/verify-content-corpus-200-effective-materialization-state.mjs', 'package effective-state verifier wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-blocked-recovery-closure\n      - run: npm run verify:content-corpus-200-effective-state'), 'CI effective-state verifier must follow recovery closure')

const sha = jsonSha(state)
console.log('CONTENT-CORPUS-200 effective materialization state result:')
console.log(JSON.stringify({
  version: state.version,
  manifestSha256: state.manifestSha256,
  evidenceSha256: sha,
  totalRankings: totals.totalRankings,
  effectiveReadyRows: totals.effectiveReadyRows,
  blockedRows: totals.blockedRows,
  byContentType: declared.byContentType,
  byWave,
  authority: state.authorityBoundary,
}, null, 2))
ok(EXPECTED !== 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION', `effective materialization state must be frozen after first structurally valid execution; observed sha256=${sha}`)
ok(sha === EXPECTED, `effective materialization state freeze mismatch: expected ${EXPECTED}, observed ${sha}`)
console.log(`CONTENT-CORPUS-200 effective materialization state contracts: PASS (${sha.slice(0, 16)})`)
