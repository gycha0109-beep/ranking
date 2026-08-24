import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const corePath = path.join(root, 'src/lib/recommendation/rf1-core.ts')
const calibrationPath = path.join(root, 'src/lib/recommendation/rf1-initial-policy-calibration.ts')
const hypothesisPath = path.join(root, 'src/lib/recommendation/rf1-policy-hypothesis.ts')
const admissionPath = path.join(root, 'src/lib/recommendation/rf1-reviewed-shadow-admission.ts')
const rankingPagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')

function fail(message) {
  console.error(`RF-1K contract failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

for (const requiredPath of [corePath, calibrationPath, hypothesisPath, admissionPath, rankingPagePath]) {
  assert(fs.existsSync(requiredPath), `${path.relative(root, requiredPath)} must exist`)
}

const coreSource = fs.readFileSync(corePath, 'utf8')
const calibrationSource = fs.readFileSync(calibrationPath, 'utf8')
const hypothesisSource = fs.readFileSync(hypothesisPath, 'utf8')
const admissionSource = fs.readFileSync(admissionPath, 'utf8')
const rankingPageSource = fs.readFileSync(rankingPagePath, 'utf8')

assert(admissionSource.includes("RF1K_ADMISSION_STATUS = 'APPROVED_FOR_DURABLE_SHADOW'"), 'admission must explicitly authorize durable SHADOW only')
assert(admissionSource.includes('shadowExecutionAuthorized: true'), 'RF-1K must explicitly open SHADOW execution')
assert(admissionSource.includes('productionActivationAuthorized: false'), 'RF-1K must keep production activation forbidden')
assert(!admissionSource.includes('productionActivationAuthorized: true'), 'RF-1K must not contain a production activation authority')
assert(admissionSource.includes("reviewStatus: 'REVIEWED_FOR_SHADOW_ONLY'"), 'RF-1K must use the RF-1H reviewed SHADOW-only contract')
assert(admissionSource.includes('policy: calibration.policy'), 'RF-1K must admit the exact RF-1J policy rather than inventing another bundle')
assert(admissionSource.includes('sourceCalibrationFingerprint: calibration.candidateFingerprint'), 'RF-1K admission must bind the RF-1J calibration fingerprint')
assert(admissionSource.includes("domain: 'rankingwiki:rf1-shadow-admission:v1'"), 'RF-1K admission must have deterministic provenance')
assert(!rankingPageSource.includes('RF1_REVIEWED_SHADOW_ADMISSION_V1'), 'public ranking page must not consume SHADOW admission')
assert(!rankingPageSource.includes('runAndRecordRf1RelatedShadowEvidence'), 'public ranking page must remain outside durable SHADOW execution')

const transpile = (source, fileName) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, strict: true },
  fileName,
}).outputText
const toUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

const coreUrl = toUrl(transpile(coreSource, corePath))

let calibrationJs = transpile(calibrationSource, calibrationPath)
calibrationJs = calibrationJs.replace("from './rf1-core'", `from '${coreUrl}'`)
const calibrationUrl = toUrl(calibrationJs)
const calibrationModule = await import(calibrationUrl)

let hypothesisJs = transpile(hypothesisSource, hypothesisPath)
hypothesisJs = hypothesisJs.replace("from './rf1-core'", `from '${coreUrl}'`)
const hypothesisUrl = toUrl(hypothesisJs)

let admissionJs = transpile(admissionSource, admissionPath)
admissionJs = admissionJs
  .replace("from './rf1-core'", `from '${coreUrl}'`)
  .replace("from './rf1-initial-policy-calibration'", `from '${calibrationUrl}'`)
  .replace("from './rf1-policy-hypothesis'", `from '${hypothesisUrl}'`)
const admissionUrl = toUrl(admissionJs)
const admissionModule = await import(admissionUrl)

const admission = admissionModule.RF1_REVIEWED_SHADOW_ADMISSION_V1
const rebuilt = admissionModule.buildRf1ReviewedShadowAdmission()
const calibration = calibrationModule.RF1_INITIAL_POLICY_CALIBRATION_V1

assert(admission.admissionStatus === 'APPROVED_FOR_DURABLE_SHADOW', 'admission status must be durable-SHADOW-only')
assert(admission.shadowExecutionAuthorized === true, 'durable SHADOW execution must be authorized after explicit review')
assert(admission.productionActivationAuthorized === false, 'production activation must remain forbidden')
assert(admission.sourceCalibrationFingerprint === calibration.candidateFingerprint, 'admission must bind the exact RF-1J candidate fingerprint')
assert(admission.hypothesis.reviewStatus === 'REVIEWED_FOR_SHADOW_ONLY', 'hypothesis review status must remain SHADOW-only')
assert(admission.hypothesis.productionActivationAuthorized === false, 'reviewed hypothesis must remain non-production')
assert(admission.hypothesis.policy.policyBundleVersion === calibration.policy.policyBundleVersion, 'RF-1K must retain the exact RF-1J policy bundle')
assert(admission.admissionFingerprint === rebuilt.admissionFingerprint, 'RF-1K admission fingerprint must be deterministic')
assert(admission.hypothesis.hypothesisFingerprint === rebuilt.hypothesis.hypothesisFingerprint, 'reviewed hypothesis fingerprint must be deterministic')

const policy = admission.hypothesis.policy
assert(policy.behavior.eventWeights.QUICK_SKIP === 0, 'long-term QUICK_SKIP must remain quarantined')
assert(policy.behavior.eventWeights.DWELL === 0, 'long-term DWELL must remain quarantined')
assert(policy.sessionBehavior.eventWeights.QUICK_SKIP === 0, 'session QUICK_SKIP must remain quarantined')
assert(policy.sessionBehavior.eventWeights.DWELL === 0, 'session DWELL must remain quarantined')
assert(policy.score.lowExposureMaximumBoost === 0, 'low-exposure boost must remain disabled before evidence')
assert(policy.exploration.maximumPromotions === 0, 'exploration must remain disabled before outcome evidence')
assert(policy.exploration.slotIndexes.length === 0, 'exploration slots must remain empty before outcome evidence')

console.log(`RF-1K reviewed SHADOW admission contracts: PASS (${admission.hypothesis.hypothesisFingerprint})`)
