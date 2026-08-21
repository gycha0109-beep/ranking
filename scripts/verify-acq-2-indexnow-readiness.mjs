import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function read(path) {
  return readFileSync(path, 'utf8')
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message)
}

const key = '0fc5987ce02e929b5fcd9b1223ae985e81fd8c41e9d2dc381513970419411722'
const keyPath = `public/${key}.txt`
const keyFile = read(keyPath)
const submitter = read('scripts/submit-indexnow.mjs')
const docs = read('docs/acq-2-indexnow-discovery-bootstrap.md')
const packageJson = read('package.json')
const ci = read('.github/workflows/ci.yml')
const acq1Docs = read('docs/acq-1-search-engine-ownership-submission-readiness.md')

requireCondition(keyFile.trim() === key, 'IndexNow key file contents must equal the filename stem')
requireCondition(/^[A-Za-z0-9-]{8,128}$/.test(key), 'IndexNow key must satisfy protocol syntax')
requireCondition(submitter.includes("const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'"), 'submitter must use the universal IndexNow endpoint')
requireCondition(submitter.includes(`const INDEXNOW_KEY_FILE = '${key}.txt'`), 'submitter must bind to the hosted root key file')
requireCondition(submitter.includes('const MAX_URLS = 10_000'), 'submitter must enforce the 10,000 URL protocol limit')
requireCondition(submitter.includes("if (arg === '--submit')"), 'live submission must require an explicit --submit flag')
requireCondition(submitter.includes('if (!args.submit)'), 'submitter must default to dry-run')
requireCondition(submitter.includes('target.origin !== site.origin'), 'submitter must reject cross-origin URL submission')
requireCondition(submitter.includes('keyLocation'), 'submitter must send the hosted key location')
requireCondition(submitter.includes("method: 'POST'"), 'submitter must use bounded POST batch submission')
requireCondition(submitter.includes('response.status === 200 || response.status === 202'), 'submitter must distinguish successful protocol receipt states')
requireCondition(submitter.includes("'RECEIVED_KEY_VALIDATION_PENDING'"), 'HTTP 202 must remain key-validation-pending, not indexing evidence')

const dryRun = spawnSync(process.execPath, [
  'scripts/submit-indexnow.mjs',
  '--site',
  'https://rankingwiki.example',
  '--url',
  '/rankings/example',
], { encoding: 'utf8' })

requireCondition(dryRun.status === 0, `dry-run must succeed: ${dryRun.stderr}`)
requireCondition(dryRun.stdout.includes('"mode": "DRY_RUN"'), 'default execution must be a dry-run')
requireCondition(dryRun.stdout.includes('https://api.indexnow.org/indexnow'), 'dry-run must expose the intended endpoint')
requireCondition(dryRun.stdout.includes(`https://rankingwiki.example/${key}.txt`), 'dry-run must bind keyLocation to the selected site origin')
requireCondition(dryRun.stdout.includes('https://rankingwiki.example/rankings/example'), 'dry-run must normalize same-origin relative URLs')

const crossOrigin = spawnSync(process.execPath, [
  'scripts/submit-indexnow.mjs',
  '--site',
  'https://rankingwiki.example',
  '--url',
  'https://other.example/rankings/example',
], { encoding: 'utf8' })

requireCondition(crossOrigin.status !== 0, 'cross-origin submission must fail closed')
requireCondition(crossOrigin.stderr.includes('does not belong to site host'), 'cross-origin failure must state the host boundary')

for (const phrase of [
  'TECHNICALLY_CRAWLABLE',
  'INDEXNOW_KEY_REACHABLE',
  'INDEXNOW_REQUEST_RECEIVED',
  '!= CRAWLED',
  '!= INDEXED',
  'A successful IndexNow HTTP response means only that the notification was received',
  'Google Search Console ownership',
  'Total: **25 URLs**',
  'CI never performs a live submission',
  'SEARCH_ENGINE_INDEXING = UNCONFIRMED',
]) {
  requireCondition(docs.includes(phrase), `ACQ-2 docs must freeze evidence boundary: ${phrase}`)
}

requireCondition(acq1Docs.includes('PENDING_EXTERNAL_ENGINE_OWNERSHIP'), 'ACQ-1 external ownership boundary must remain pending')
requireCondition(acq1Docs.includes('SEARCH_ENGINE_INDEXING = UNCONFIRMED'), 'ACQ-1 indexing authority must remain unconfirmed')
requireCondition(packageJson.includes('"indexnow:submit": "node scripts/submit-indexnow.mjs"'), 'package.json must expose the operator IndexNow command')
requireCondition(packageJson.includes('"verify:acq-2": "node scripts/verify-acq-2-indexnow-readiness.mjs"'), 'package.json must expose verify:acq-2')
requireCondition(ci.includes('npm run verify:acq-2'), 'CI must run the ACQ-2 verifier')
requireCondition(!ci.includes('indexnow:submit'), 'CI must never perform IndexNow submission')

console.log('ACQ-2 IndexNow readiness verified')
