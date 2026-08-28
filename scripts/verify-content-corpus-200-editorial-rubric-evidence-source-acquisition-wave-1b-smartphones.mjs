import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd(); const p=(...x)=>path.join(root,...x)
const stem='editorial-rubric-evidence-source-acquisition-wave-1b-smartphones'
const f={
 e:p(`content/corpus-200/${stem}.json`),
 p:p('content/corpus-200/editorial-rubric-evidence-source-acquisition-plan-wave-1.json'),
 a:p('content/corpus-200/editorial-rubric-evidence-source-acquisition-authorization-wave-1b-smartphones.json'),
 s:p(`content/corpus-200/${stem}-source-records.json`),
 b:[
  p(`content/corpus-200/${stem}-cell-bindings-01-galaxy-s26.json`),
  p(`content/corpus-200/${stem}-cell-bindings-02-galaxy-s26-plus.json`),
  p(`content/corpus-200/${stem}-cell-bindings-03-galaxy-s26-ultra.json`),
  p(`content/corpus-200/${stem}-cell-bindings-04-iphone-17-pro.json`),
  p(`content/corpus-200/${stem}-cell-bindings-05-iphone-17-pro-max.json`),
  p(`content/corpus-200/${stem}-cell-bindings-06-xiaomi-15.json`),
  p(`content/corpus-200/${stem}-cell-bindings-07-oneplus-15-sand-storm.json`),
  p(`content/corpus-200/${stem}-cell-bindings-08-vivo-x300-pro.json`),
 ],
 u:p(`content/corpus-200/${stem}-unresolved-cells.json`),
 page:p('src/app/rankings/[rankingSlug]/page.tsx'),pkg:p('package.json'),ci:p('.github/workflows/ci.yml')}
const MANIFEST='f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const PLAN='80eb6a1602ce7fae0155aeb2f872f1ac281039d8ed3a6a7cdcdcc0e9fc96a28b'
const AUTH='a34b25be38637ff8ddcd4be59eca61f5816bdc8d5432056a4e9813c1cac9d6e6'
const SR='826c66c838de588a366bd750ef22784f0ad3e56945e0bbcb804ada46d55178f6'
const BR='e6cae8dc0aed706171edf80a08fe911c98d223f5901db82c791fd35145a58615'
const UR='f8f0152b5bc47f1526ad5ef30539047ea5b30ecda80b075400e937e31ffa45a4'
const EXPECTED='UNSEALED_EDITORIAL_RUBRIC_EVIDENCE_SOURCE_ACQUISITION_WAVE_1B_SMARTPHONES'
const fail=m=>{console.error(`CONTENT-CORPUS-200 Wave 1B smartphone source acquisition verification failed: ${m}`);process.exit(1)}
const ok=(v,m)=>{if(!v)fail(m)};const read=x=>JSON.parse(fs.readFileSync(x,'utf8'));const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex')
for(const x of [f.e,f.p,f.a,f.s,...f.b,f.u,f.page,f.pkg,f.ci])ok(fs.existsSync(x),`${path.relative(root,x)} must exist`)
const e=read(f.e),plan=read(f.p),auth=read(f.a),sources=read(f.s).records||[],bindings=f.b.flatMap(x=>read(x).bindings||[]),unresolved=read(f.u).cells||[],page=fs.readFileSync(f.page,'utf8'),pkg=read(f.pkg),ci=fs.readFileSync(f.ci,'utf8')
ok(sha(plan)===PLAN,'sealed acquisition plan mutated');ok(sha(auth)===AUTH,'sealed Wave 1B authorization mutated')
ok(auth.nextGate==='EDITORIAL_RUBRIC_EVIDENCE_SOURCE_ACQUISITION_WAVE_1B_SMARTPHONES','authorization handoff changed')
ok(auth.authorityBoundary?.externalSourceAcquisitionExecutionAuthorized===true,'external acquisition was not authorized')
const fp=plan.familyExecutionPlan?.[1];ok(fp?.sequence===2&&fp.familyId==='smartphones'&&fp.frozenCandidates===8&&fp.explicitRubricSlots===18&&fp.cellEvidenceObligations===144,'plan Wave 1B scope changed')

const candidates=[
 ['galaxy-s26','Samsung Galaxy S26'],['galaxy-s26-plus','Samsung Galaxy S26+'],['galaxy-s26-ultra','Samsung Galaxy S26 Ultra'],
 ['iphone-17-pro','Apple iPhone 17 Pro'],['iphone-17-pro-max','Apple iPhone 17 Pro Max'],['xiaomi-15','Xiaomi 15'],
 ['oneplus-15-sand-storm','OnePlus 15 (Sand Storm)'],['vivo-x300-pro','vivo X300 Pro']]
const slots=[
 ['cc200-smartphones-04',1,'발열 억제'],['cc200-smartphones-04',2,'배터리'],['cc200-smartphones-04',3,'화면'],['cc200-smartphones-04',4,'게임 기능'],
 ['cc200-smartphones-05',0,'카메라 범용성'],['cc200-smartphones-05',1,'줌'],['cc200-smartphones-05',2,'동영상'],['cc200-smartphones-05',3,'배터리'],
 ['cc200-smartphones-06',3,'그립'],['cc200-smartphones-06',4,'버튼 접근'],
 ['cc200-smartphones-07',1,'충전 속도'],['cc200-smartphones-07',2,'대기 효율'],['cc200-smartphones-07',3,'발열'],
 ['cc200-smartphones-08',0,'성능'],['cc200-smartphones-08',1,'카메라'],['cc200-smartphones-08',2,'배터리'],['cc200-smartphones-08',3,'디스플레이'],['cc200-smartphones-08',4,'소프트웨어']]
const target=[];for(const [m,i,n] of slots){const slotId=`${m}:${i}:${n}`;for(const [itemKey,label] of candidates)target.push({cellId:`${slotId}::smartphones:${itemKey}`,slotId,manifestId:m,dimensionIndex:i,exactDimensionName:n,familyId:'smartphones',itemKey,exactFrozenLabel:label})}
ok(target.length===144,'exact target registry must remain 144 cells');const byId=new Map(target.map(x=>[x.cellId,x]));const candidateLabel=new Map(candidates)

ok(e.version==='content-corpus-200-editorial-rubric-evidence-source-acquisition-wave-1b-smartphones-v1','evidence version mismatch')
ok(e.manifestVersion==='content-corpus-200-manifest-v1'&&e.manifestSha256===MANIFEST,'manifest lineage mismatch')
ok(e.sourceAcquisitionPlanVersion===plan.version&&e.sourceAcquisitionPlanSha256===PLAN,'plan lineage mismatch')
ok(e.sourceAcquisitionAuthorizationVersion===auth.version&&e.sourceAcquisitionAuthorizationSha256===AUTH,'authorization lineage mismatch')
ok(e.status==='SOURCE_ACQUISITION_EXECUTED_PARTIAL_DIRECT_BINDINGS_NO_RUBRIC_OUTCOMES','status mismatch');ok(e.acquiredAt==='2026-08-28T16:39:00+09:00','timestamp mismatch')
ok(JSON.stringify(e.scope)===JSON.stringify({wave:'1B',familyId:'smartphones',editorialRows:5,frozenCandidates:8,explicitRubricSlots:18,candidateSlotCells:144,reviewedSourceRecords:19,directlyBoundCells:120,unresolvedCells:24,candidateRubricOutcomesAuthored:0,numericDimensionValuesAuthored:0,weightsAuthored:0,compositeScoresAuthored:0,editorialOrderingsAuthored:0}),'scope mismatch')
ok(e.gateDisposition==='WAVE_1B_SMARTPHONES_SOURCE_ACQUISITION_MATERIALIZED_120_OF_144_EXACT_CELLS_WITH_24_UNRESOLVED_AND_ZERO_RUBRIC_OUTCOMES','gate disposition mismatch')
ok(e.nextGate==='EDITORIAL_RUBRIC_EVIDENCE_SOURCE_ACQUISITION_AUTHORIZATION_WAVE_1C_KBO_CLUBS','next gate mismatch');ok(Object.values(e.authorityBoundary||{}).every(v=>v===false),'post-acquisition authorities must remain false')

ok(sources.length===19,'source count must be 19');ok(bindings.length===120,'binding count must be 120');ok(unresolved.length===24,'unresolved count must be 24')
ok(sha(sources)===SR,'source registry digest mismatch');ok(sha(bindings)===BR,'binding registry digest mismatch');ok(sha(unresolved)===UR,'unresolved registry digest mismatch')
ok(JSON.stringify(e.registryDigests)===JSON.stringify({sourceRecordRegistrySha256:SR,directCellBindingRegistrySha256:BR,unresolvedCellRegistrySha256:UR}),'index digest mismatch')

const sourceFields=plan.requiredSourceRecordContract?.requiredFields||[],allowed=new Set((plan.sourceClassPolicy||[]).map(x=>x.sourceClass)),sourceMap=new Map()
for(const s of sources){for(const k of sourceFields)ok(k in s&&s[k]!=='',`${s.sourceRecordId||'source'} missing ${k}`);ok(!sourceMap.has(s.sourceRecordId),`duplicate source ${s.sourceRecordId}`);sourceMap.set(s.sourceRecordId,s);ok(s.familyId==='smartphones','source family mismatch');ok(candidateLabel.get(s.itemKey)===s.exactFrozenLabel,`${s.sourceRecordId} candidate mismatch`);ok(allowed.has(s.sourceClass),`${s.sourceRecordId} class not allowed`);ok(/^https:\/\//.test(s.sourceUrlOrFrozenSnapshotId),`${s.sourceRecordId} must use HTTPS reviewed source`);ok(s.accessAndReuseReviewStatus==='PUBLICLY_ACCESSIBLE_REVIEWED',`${s.sourceRecordId} access review incomplete`)}
ok(new Set(sources.map(x=>x.itemKey)).size===8,'all eight smartphone candidates need reviewed source portfolios')
const opIndependent=new Set(['smartphone-oneplus15-sandstorm-techradar-review-2025-11-13','smartphone-oneplus15-sandstorm-notebookcheck-test-2025-11-25'])
for(const s of sources.filter(x=>x.itemKey==='oneplus-15-sand-storm'&&x.sourceClass!=='OFFICIAL_CANDIDATE_RECORD')){ok(opIndependent.has(s.sourceRecordId),`${s.sourceRecordId} is not an approved exact Sand Storm independent source`);ok(/Sand Storm/i.test(s.referencePeriodOrVersionWhenMaterial),`${s.sourceRecordId} must explicitly bind the Sand Storm review unit`)}

const forbidden=['ordinal','rubricOrdinal','outcome','rubricOutcome','value','numericValue','score','compositeScore','weight','ordering','rank'],boundIds=new Set()
for(const b of bindings){for(const k of plan.requiredCellBindingContract?.requiredFields||[])ok(k in b,`${b.cellId||'binding'} missing ${k}`);const t=byId.get(b.cellId);ok(t,`${b.cellId} outside target`);for(const k of ['slotId','manifestId','dimensionIndex','exactDimensionName','familyId','itemKey','exactFrozenLabel'])ok(b[k]===t[k],`${b.cellId} ${k} mismatch`);ok(!boundIds.has(b.cellId),`duplicate binding ${b.cellId}`);boundIds.add(b.cellId);ok(Array.isArray(b.sourceRecordIds)&&b.sourceRecordIds.length>0,`${b.cellId} missing source IDs`);for(const id of b.sourceRecordIds){const s=sourceMap.get(id);ok(s,`${b.cellId} unknown source ${id}`);ok(s.itemKey===b.itemKey&&s.exactFrozenLabel===b.exactFrozenLabel,`${b.cellId} cross-candidate source ${id}`);if(b.itemKey==='oneplus-15-sand-storm'&&s.sourceClass!=='OFFICIAL_CANDIDATE_RECORD')ok(opIndependent.has(id),`${b.cellId} uses non-exact OnePlus independent source ${id}`)}ok(typeof b.dimensionSpecificObservation==='string'&&b.dimensionSpecificObservation.trim(),`${b.cellId} missing observation`);ok(Array.isArray(b.materialCounterevidence),`${b.cellId} counterevidence must be array`);ok(b.evidenceReviewStatus==='REVIEWED_DIRECT_SUPPORT',`${b.cellId} review status mismatch`);for(const k of forbidden)ok(!(k in b),`${b.cellId} must not author ${k}`)}
const unresolvedIds=new Set(),reason='Reviewed candidate-specific sources did not directly support this exact dimension without proxying, inference, or outcome authoring.'
for(const x of unresolved){const t=byId.get(x.cellId);ok(t,`${x.cellId} outside target`);for(const k of ['slotId','manifestId','dimensionIndex','exactDimensionName','familyId','itemKey','exactFrozenLabel'])ok(x[k]===t[k],`${x.cellId} ${k} mismatch`);ok(!unresolvedIds.has(x.cellId),`duplicate unresolved ${x.cellId}`);unresolvedIds.add(x.cellId);ok(x.disposition==='SOURCE_FOUND_BUT_EXACT_DIMENSION_NOT_SUPPORTED',`${x.cellId} disposition mismatch`);ok(x.reason===reason,`${x.cellId} reason mismatch`);ok(!('sourceRecordIds' in x),`${x.cellId} unresolved must not bind sources`);for(const k of forbidden)ok(!(k in x),`${x.cellId} unresolved must not author ${k}`)}
for(const id of boundIds)ok(!unresolvedIds.has(id),`${id} has two dispositions`);const disposed=new Set([...boundIds,...unresolvedIds]);ok(disposed.size===144,'120+24 must partition 144 unique cells');ok(target.every(x=>disposed.has(x.cellId)),'target cell missing disposition')

const B={'galaxy-s26':15,'galaxy-s26-plus':14,'galaxy-s26-ultra':14,'iphone-17-pro':15,'iphone-17-pro-max':15,'xiaomi-15':16,'oneplus-15-sand-storm':15,'vivo-x300-pro':16}
const U={'galaxy-s26':3,'galaxy-s26-plus':4,'galaxy-s26-ultra':4,'iphone-17-pro':3,'iphone-17-pro-max':3,'xiaomi-15':2,'oneplus-15-sand-storm':3,'vivo-x300-pro':2}
const S={'galaxy-s26':2,'galaxy-s26-plus':2,'galaxy-s26-ultra':2,'iphone-17-pro':2,'iphone-17-pro-max':2,'xiaomi-15':3,'oneplus-15-sand-storm':3,'vivo-x300-pro':3}
for(const [k] of candidates){ok(bindings.filter(x=>x.itemKey===k).length===B[k],`${k} bound count mismatch`);ok(unresolved.filter(x=>x.itemKey===k).length===U[k],`${k} unresolved count mismatch`);ok(sources.filter(x=>x.itemKey===k).length===S[k],`${k} source count mismatch`)}
const summary=candidates.map(([itemKey,exactFrozenLabel])=>({itemKey,exactFrozenLabel,reviewedSourceRecords:S[itemKey],directlyBoundCells:B[itemKey],unresolvedCells:U[itemKey]}));ok(JSON.stringify(e.sourcePortfolioSummary)===JSON.stringify(summary),'portfolio summary mismatch')
const unresolvedByDimension=Object.fromEntries(['대기 효율','버튼 접근','그립','게임 기능'].map(n=>[n,unresolved.filter(x=>x.exactDimensionName===n).length]));ok(JSON.stringify(unresolvedByDimension)===JSON.stringify({'대기 효율':8,'버튼 접근':8,'그립':5,'게임 기능':3}),'unresolved dimension distribution changed')
const samsung=new Set(['galaxy-s26','galaxy-s26-plus','galaxy-s26-ultra']);ok(unresolved.filter(x=>x.exactDimensionName==='게임 기능').every(x=>samsung.has(x.itemKey)),'game-feature unresolved set must remain Samsung-only')

const r=e.acquisitionReview||{};for(const k of ['all144ExactCellsDispositioned','all120BoundCellsReferenceReviewedCandidateSpecificSources','all24UnresolvedCellsRemainWithoutProxyOrImputation','allOnePlusIndependentReviewBindingsUseExactSandStormTestUnitsWhereVariantMaterial'])ok(r[k]===true,`${k} must be true`);for(const k of ['searchResultSnippetsUsedAsEvidence','modelOnlyJudgmentsUsedAsEvidence','crossCandidateInferenceUsed','crossDimensionProxyUsed','missingEvidenceImputed','rubricOrdinalOutcomesAuthored','numericEditorialDimensionValuesAuthored','weightsOrCompositeScoringExecuted','publicPageConsumptionAdded'])ok(r[k]===false,`${k} must be false`)
const script=`verify:content-corpus-200-${stem}`;ok(!page.includes(stem),'public page must not consume acquisition artifacts');ok(pkg.scripts?.[script]===`node scripts/verify-content-corpus-200-${stem}.mjs`,'package wiring mismatch');ok(ci.includes(`npm run ${script}`),'CI wiring mismatch')
const observed=sha(e);console.log(JSON.stringify({version:e.version,evidenceSha256:observed,targetCells:144,reviewedSourceRecords:sources.length,directlyBoundCells:bindings.length,unresolvedCells:unresolved.length,sourceRecordRegistrySha256:sha(sources),directCellBindingRegistrySha256:sha(bindings),unresolvedCellRegistrySha256:sha(unresolved),candidateRubricOutcomesAuthored:e.scope.candidateRubricOutcomesAuthored,numericDimensionValuesAuthored:e.scope.numericDimensionValuesAuthored,weightsAuthored:e.scope.weightsAuthored,nextGate:e.nextGate},null,2));ok(observed===EXPECTED,`unsealed Wave 1B smartphone source acquisition SHA: observed ${observed}; expected ${EXPECTED}`);console.log('CONTENT-CORPUS-200 Wave 1B smartphone source acquisition verification passed')
