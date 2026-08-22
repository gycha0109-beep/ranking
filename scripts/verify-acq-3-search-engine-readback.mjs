import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function read(path) {
  return readFileSync(path, 'utf8')
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message)
}

const operatorPath = 'scripts/readback-acq-3-search-engine.mjs'
const syntaxCheck = spawnSync(process.execPath, ['--check', operatorPath], { encoding: 'utf8' })
requireCondition(syntaxCheck.status === 0, `ACQ-3 operator syntax check failed: ${syntaxCheck.stderr || syntaxCheck.stdout}`)

const operator = read(operatorPath)
const docs = read('docs/acq-3-search-engine-readback.md')
const packageJson = read('package.json')
const ci = read('.github/workflows/ci.yml')
const acq1 = read('docs/acq-1-search-engine-ownership-submission-readiness.md')
const acq2 = read('docs/acq-2-indexnow-discovery-bootstrap.md')

for (const phrase of [
  "technicalCrawlability: 'VERIFIED'",
  "googleOwnershipVerified: 'UNCONFIRMED'",
  "bingOwnershipVerified: 'UNCONFIRMED'",
  "googleSitemapSubmitted: 'UNCONFIRMED'",
  "bingSitemapSubmitted: 'UNCONFIRMED'",
  "crawlStatus: 'UNCONFIRMED'",
  "indexStatus: 'UNCONFIRMED'",
  'verification-tag presence is not ownership verification',
]) {
  requireCondition(operator.includes(phrase), `ACQ-3 operator must preserve evidence boundary: ${phrase}`)
}

requireCondition(operator.includes("metaContent(root.text, 'google-site-verification')"), 'operator must inspect the Google verification surface')
requireCondition(operator.includes("metaContent(root.text, 'msvalidate.01')"), 'operator must inspect the Bing verification surface')
requireCondition(operator.includes("robots.text.includes(`Sitemap: ${sitemapUrl}`)"), 'operator must read back the canonical sitemap advertisement')
requireCondition(operator.includes("new URL(value).origin !== site"), 'operator must reject off-origin sitemap URLs')
requireCondition(operator.includes("new Set(locs).size !== locs.length"), 'operator must reject duplicate sitemap URLs')
requireCondition(operator.includes("pathname.startsWith('/rankings/')"), 'operator must inspect a ranking detail sample')
requireCondition(operator.includes("pathname.startsWith('/items/')"), 'operator must inspect an item detail sample')
requireCondition(operator.includes("hasFlag('--require-google-tag')"), 'operator must support explicit Google tag gating')
requireCondition(operator.includes("hasFlag('--require-bing-tag')"), 'operator must support explicit Bing tag gating')

for (const phrase of [
  'TECHNICALLY_CRAWLABLE != OWNERSHIP_VERIFIED != SITEMAP_SUBMITTED != CRAWLED != INDEXED',
  'GOOGLE_VERIFICATION_TAG = ABSENT',
  'BING_VERIFICATION_TAG = ABSENT',
  'GOOGLE_SEARCH_CONSOLE_OWNERSHIP = UNCONFIRMED',
  'BING_WEBMASTER_OWNERSHIP = UNCONFIRMED',
  'ENGINE_SIDE_SITEMAP_READBACK = UNCONFIRMED',
  'PUBLIC_SEARCH_SAMPLING = NO_RESULTS / ADVISORY_ONLY',
  'EXTERNAL_ENGINE_AUTHORITY_BLOCKED',
]) {
  requireCondition(docs.includes(phrase), `ACQ-3 docs must freeze current authority: ${phrase}`)
}

requireCondition(acq1.includes('PENDING_EXTERNAL_ENGINE_OWNERSHIP'), 'ACQ-1 external ownership boundary must remain intact')
requireCondition(acq2.includes('CRAWL_STATUS = UNCONFIRMED'), 'ACQ-2 crawl boundary must remain intact')
requireCondition(acq2.includes('SEARCH_ENGINE_INDEXING = UNCONFIRMED'), 'ACQ-2 indexing boundary must remain intact')
requireCondition(packageJson.includes('"acq-3:readback": "node scripts/readback-acq-3-search-engine.mjs"'), 'package.json must expose the ACQ-3 operator')
requireCondition(packageJson.includes('"verify:acq-3": "node scripts/verify-acq-3-search-engine-readback.mjs"'), 'package.json must expose verify:acq-3')
requireCondition(ci.includes('npm run verify:acq-3'), 'CI must run the ACQ-3 verifier without performing live engine operations')

console.log('ACQ-3 search engine readback contract verified')
