import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd(); const p=(...x)=>path.join(root,...x)
const f={
 e:p('content/corpus-200/editorial-rubric-evidence-source-acquisition-wave-1a-steam-mainstream.json'),
 p:p('content/corpus-200/editorial-rubric-evidence-source-acquisition-plan-wave-1.json'),
 a:p('content/corpus-200/editorial-rubric-evidence-source-acquisition-authorization-wave-1a-steam-mainstream.json'),
 s:p('content/corpus-200/editorial-rubric-evidence-source-acquisition-wave-1a-steam-mainstream-source-records.json'),
 b:[p('content/corpus-200/editorial-rubric-evidence-source-acquisition-wave-1a-steam-mainstream-cell-bindings-01-cs2-dota.json'),p('content/corpus-200/editorial-rubric-evidence-source-acquisition-wave-1a-steam-mainstream-cell-bindings-02-pubg-palworld.json'),p('content/corpus-200/editorial-rubric-evidence-source-acquisition-wave-1a-steam-mainstream-cell-bindings-03-fivem.json')],
 u:p('content/corpus-200/editorial-rubric-evidence-source-acquisition-wave-1a-steam-mainstream-unresolved-cells.json'),
 page:p('src/app/rankings/[rankingSlug]/page.tsx'), pkg:p('package.json'), ci:p('.github/workflows/ci.yml')}
const MANIFEST='f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const PLAN='80eb6a1602ce7fae0155aeb2f872f1ac281039d8ed3a6a7cdcdcc0e9fc96a28b'
const AUTH='7abfd8007bf24a50ca3b353c1f3f36f264290d6a0a1a749f957bef8bd50bbcc1'
const SR='131f5206778c104d0e9eebba84d8e98b50749ac4e4726954d9a2674f6a03c07d'
const BR='2bba608cf240f67b21a1ed02f159b51ce1c2a515b2d49e85eaba3d732aee6fa8'
const UR='ffb083e5a2ddcdb52c28ec9a5bb4ab2d49caadfe539e83843836283ab5ae30d2'
const EXPECTED='UNSEALED_EDITORIAL_RUBRIC_EVIDENCE_SOURCE_ACQUISITION_WAVE_1A_STEAM_MAINSTREAM'
const fail=m=>{console.error(`CONTENT-CORPUS-200 Wave 1A Steam source acquisition verification failed: ${m}`);process.exit(1)}
const ok=(v,m)=>{if(!v)fail(m)}; const read=x=>JSON.parse(fs.readFileSync(x,'utf8')); const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex')
for(const x of [f.e,f.p,f.a,f.s,...f.b,f.u,f.page,f.pkg,f.ci])ok(fs.existsSync(x),`${path.relative(root,x)} must exist`)
const e=read(f.e), plan=read(f.p), auth=read(f.a), sources=read(f.s).records||[], bindings=f.b.flatMap(x=>read(x).bindings||[]), unresolved=read(f.u).cells||[], page=fs.readFileSync(f.page,'utf8'), pkg=read(f.pkg), ci=fs.readFileSync(f.ci,'utf8')
ok(sha(plan)===PLAN,'sealed acquisition plan mutated'); ok(sha(auth)===AUTH,'sealed Wave 1A authorization mutated')
ok(auth.nextGate==='EDITORIAL_RUBRIC_EVIDENCE_SOURCE_ACQUISITION_WAVE_1A_STEAM_MAINSTREAM','authorization handoff changed')
ok(auth.authorityBoundary?.externalSourceAcquisitionExecutionAuthorized===true,'external acquisition was not authorized')
ok(plan.familyExecutionPlan?.[0]?.familyId==='steam-mainstream'&&plan.familyExecutionPlan[0].frozenCandidates===5&&plan.familyExecutionPlan[0].explicitRubricSlots===18&&plan.familyExecutionPlan[0].cellEvidenceObligations===90,'plan Wave 1A scope changed')

const candidates=[['counter-strike-2','Counter-Strike 2'],['dota-2','Dota 2'],['pubg-battlegrounds','PUBG: BATTLEGROUNDS'],['palworld','Palworld'],['fivem','FiveM']]
const slots=[
 ['cc200-steam-mainstream-04',1,'진입 난이도'],['cc200-steam-mainstream-04',2,'세션 길이'],['cc200-steam-mainstream-04',3,'반복 플레이성'],
 ['cc200-steam-mainstream-05',0,'평균 세션 길이'],['cc200-steam-mainstream-05',1,'진행 저장 편의'],['cc200-steam-mainstream-05',2,'즉시성'],['cc200-steam-mainstream-05',3,'한 판 만족도'],
 ['cc200-steam-mainstream-06',0,'콘텐츠 깊이'],['cc200-steam-mainstream-06',1,'빌드 다양성'],['cc200-steam-mainstream-06',2,'반복 플레이성'],['cc200-steam-mainstream-06',3,'업데이트 지속성'],
 ['cc200-steam-mainstream-07',0,'관전 가독성'],['cc200-steam-mainstream-07',1,'돌발 상황'],['cc200-steam-mainstream-07',2,'사회적 상호작용'],['cc200-steam-mainstream-07',3,'세션 변주'],
 ['cc200-steam-mainstream-08',1,'성능 안정성'],['cc200-steam-mainstream-08',2,'콘텐츠 깊이'],['cc200-steam-mainstream-08',3,'가격 접근성']]
const target=[]; for(const [m,i,n] of slots){const slotId=`${m}:${i}:${n}`;for(const [itemKey,label] of candidates)target.push({cellId:`${slotId}::steam-mainstream:${itemKey}`,slotId,manifestId:m,dimensionIndex:i,exactDimensionName:n,familyId:'steam-mainstream',itemKey,exactFrozenLabel:label})}
ok(target.length===90,'exact target registry must remain 90 cells'); const byId=new Map(target.map(x=>[x.cellId,x])); const candidateLabel=new Map(candidates)

ok(e.version==='content-corpus-200-editorial-rubric-evidence-source-acquisition-wave-1a-steam-mainstream-v1','evidence version mismatch')
ok(e.manifestVersion==='content-corpus-200-manifest-v1'&&e.manifestSha256===MANIFEST,'manifest lineage mismatch')
ok(e.sourceAcquisitionPlanVersion===plan.version&&e.sourceAcquisitionPlanSha256===PLAN,'plan lineage mismatch')
ok(e.sourceAcquisitionAuthorizationVersion===auth.version&&e.sourceAcquisitionAuthorizationSha256===AUTH,'authorization lineage mismatch')
ok(e.status==='SOURCE_ACQUISITION_EXECUTED_PARTIAL_DIRECT_BINDINGS_NO_RUBRIC_OUTCOMES','status mismatch'); ok(e.acquiredAt==='2026-08-28T15:34:00+09:00','timestamp mismatch')
ok(JSON.stringify(e.scope)===JSON.stringify({wave:'1A',familyId:'steam-mainstream',editorialRows:5,frozenCandidates:5,explicitRubricSlots:18,candidateSlotCells:90,reviewedSourceRecords:16,directlyBoundCells:56,unresolvedCells:34,candidateRubricOutcomesAuthored:0,numericDimensionValuesAuthored:0,weightsAuthored:0,compositeScoresAuthored:0,editorialOrderingsAuthored:0}),'scope mismatch')
ok(e.gateDisposition==='WAVE_1A_STEAM_MAINSTREAM_SOURCE_ACQUISITION_MATERIALIZED_56_OF_90_EXACT_CELLS_WITH_34_UNRESOLVED_AND_ZERO_RUBRIC_OUTCOMES','gate disposition mismatch')
ok(e.nextGate==='EDITORIAL_RUBRIC_EVIDENCE_SOURCE_ACQUISITION_AUTHORIZATION_WAVE_1B_SMARTPHONES','next gate mismatch'); ok(Object.values(e.authorityBoundary||{}).every(v=>v===false),'post-acquisition authorities must remain false')

ok(sources.length===16,'source count must be 16'); ok(bindings.length===56,'binding count must be 56'); ok(unresolved.length===34,'unresolved count must be 34')
ok(sha(sources)===SR,'source registry digest mismatch'); ok(sha(bindings)===BR,'binding registry digest mismatch'); ok(sha(unresolved)===UR,'unresolved registry digest mismatch')
ok(JSON.stringify(e.registryDigests)===JSON.stringify({sourceRecordRegistrySha256:SR,directCellBindingRegistrySha256:BR,unresolvedCellRegistrySha256:UR}),'index digest mismatch')

const sourceFields=plan.requiredSourceRecordContract?.requiredFields||[], allowed=new Set((plan.sourceClassPolicy||[]).map(x=>x.sourceClass)), sourceMap=new Map()
for(const s of sources){for(const k of sourceFields)ok(k in s&&s[k]!=='' ,`${s.sourceRecordId||'source'} missing ${k}`);ok(!sourceMap.has(s.sourceRecordId),`duplicate source ${s.sourceRecordId}`);sourceMap.set(s.sourceRecordId,s);ok(s.familyId==='steam-mainstream','source family mismatch');ok(candidateLabel.get(s.itemKey)===s.exactFrozenLabel,`${s.sourceRecordId} candidate mismatch`);ok(allowed.has(s.sourceClass),`${s.sourceRecordId} class not allowed`);ok(/^https:\/\//.test(s.sourceUrlOrFrozenSnapshotId),`${s.sourceRecordId} must use HTTPS reviewed source`);ok(s.accessAndReuseReviewStatus==='PUBLICLY_ACCESSIBLE_REVIEWED',`${s.sourceRecordId} access review incomplete`)}
ok(new Set(sources.map(x=>x.itemKey)).size===5,'all five candidates need reviewed source portfolios')

const forbidden=['ordinal','rubricOrdinal','outcome','rubricOutcome','value','numericValue','score','compositeScore','weight','ordering','rank']; const boundIds=new Set()
for(const b of bindings){for(const k of plan.requiredCellBindingContract?.requiredFields||[])ok(k in b,`${b.cellId||'binding'} missing ${k}`);const t=byId.get(b.cellId);ok(t,`${b.cellId} outside target`);for(const k of ['slotId','manifestId','dimensionIndex','exactDimensionName','familyId','itemKey','exactFrozenLabel'])ok(b[k]===t[k],`${b.cellId} ${k} mismatch`);ok(!boundIds.has(b.cellId),`duplicate binding ${b.cellId}`);boundIds.add(b.cellId);ok(Array.isArray(b.sourceRecordIds)&&b.sourceRecordIds.length>0,`${b.cellId} missing source IDs`);for(const id of b.sourceRecordIds){const s=sourceMap.get(id);ok(s,`${b.cellId} unknown source ${id}`);ok(s.itemKey===b.itemKey&&s.exactFrozenLabel===b.exactFrozenLabel,`${b.cellId} cross-candidate source ${id}`)}ok(typeof b.dimensionSpecificObservation==='string'&&b.dimensionSpecificObservation.trim(),`${b.cellId} missing observation`);ok(Array.isArray(b.materialCounterevidence),`${b.cellId} counterevidence must be array`);ok(b.evidenceReviewStatus==='REVIEWED_DIRECT_SUPPORT',`${b.cellId} review status mismatch`);for(const k of forbidden)ok(!(k in b),`${b.cellId} must not author ${k}`)}
const unresolvedIds=new Set(), reason='Reviewed candidate-specific sources did not directly support this exact dimension without proxying, inference, or outcome authoring.'
for(const x of unresolved){const t=byId.get(x.cellId);ok(t,`${x.cellId} outside target`);for(const k of ['slotId','manifestId','dimensionIndex','exactDimensionName','familyId','itemKey','exactFrozenLabel'])ok(x[k]===t[k],`${x.cellId} ${k} mismatch`);ok(!unresolvedIds.has(x.cellId),`duplicate unresolved ${x.cellId}`);unresolvedIds.add(x.cellId);ok(x.disposition==='SOURCE_FOUND_BUT_EXACT_DIMENSION_NOT_SUPPORTED',`${x.cellId} disposition mismatch`);ok(x.reason===reason,`${x.cellId} reason mismatch`);ok(!('sourceRecordIds' in x),`${x.cellId} unresolved must not bind sources`);for(const k of forbidden)ok(!(k in x),`${x.cellId} unresolved must not author ${k}`)}
for(const id of boundIds)ok(!unresolvedIds.has(id),`${id} has two dispositions`);const disposed=new Set([...boundIds,...unresolvedIds]);ok(disposed.size===90,'56+34 must partition 90 unique cells');ok(target.every(x=>disposed.has(x.cellId)),'target cell missing disposition')

const B={'counter-strike-2':10,'dota-2':13,'pubg-battlegrounds':13,'palworld':12,'fivem':8}, U={'counter-strike-2':8,'dota-2':5,'pubg-battlegrounds':5,'palworld':6,'fivem':10}, S={'counter-strike-2':3,'dota-2':3,'pubg-battlegrounds':4,'palworld':2,'fivem':4}
for(const [k] of candidates){ok(bindings.filter(x=>x.itemKey===k).length===B[k],`${k} bound count mismatch`);ok(unresolved.filter(x=>x.itemKey===k).length===U[k],`${k} unresolved count mismatch`);ok(sources.filter(x=>x.itemKey===k).length===S[k],`${k} source count mismatch`)}
const summary=candidates.map(([itemKey,exactFrozenLabel])=>({itemKey,exactFrozenLabel,reviewedSourceRecords:S[itemKey],directlyBoundCells:B[itemKey],unresolvedCells:U[itemKey]}));ok(JSON.stringify(e.sourcePortfolioSummary)===JSON.stringify(summary),'portfolio summary mismatch')
const r=e.acquisitionReview||{};for(const k of ['all90ExactCellsDispositioned','all56BoundCellsReferenceReviewedCandidateSpecificSources','all34UnresolvedCellsRemainWithoutProxyOrImputation'])ok(r[k]===true,`${k} must be true`);for(const k of ['searchResultSnippetsUsedAsEvidence','modelOnlyJudgmentsUsedAsEvidence','crossCandidateInferenceUsed','crossDimensionProxyUsed','missingEvidenceImputed','rubricOrdinalOutcomesAuthored','numericEditorialDimensionValuesAuthored','weightsOrCompositeScoringExecuted','publicPageConsumptionAdded'])ok(r[k]===false,`${k} must be false`)
const stem='editorial-rubric-evidence-source-acquisition-wave-1a-steam-mainstream', script=`verify:content-corpus-200-${stem}`;ok(!page.includes(stem),'public page must not consume acquisition artifacts');ok(pkg.scripts?.[script]===`node scripts/verify-content-corpus-200-${stem}.mjs`,'package wiring mismatch');ok(ci.includes(`npm run ${script}`),'CI wiring mismatch')
const observed=sha(e);console.log(JSON.stringify({version:e.version,evidenceSha256:observed,targetCells:90,reviewedSourceRecords:sources.length,directlyBoundCells:bindings.length,unresolvedCells:unresolved.length,sourceRecordRegistrySha256:sha(sources),directCellBindingRegistrySha256:sha(bindings),unresolvedCellRegistrySha256:sha(unresolved),candidateRubricOutcomesAuthored:e.scope.candidateRubricOutcomesAuthored,numericDimensionValuesAuthored:e.scope.numericDimensionValuesAuthored,weightsAuthored:e.scope.weightsAuthored,nextGate:e.nextGate},null,2));ok(observed===EXPECTED,`unsealed Wave 1A Steam source acquisition SHA: observed ${observed}; expected ${EXPECTED}`);console.log('CONTENT-CORPUS-200 Wave 1A Steam source acquisition verification passed')
