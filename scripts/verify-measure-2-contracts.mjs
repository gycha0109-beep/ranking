import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const middleware = read('src/middleware.ts')
const productionConfig = read('playwright.production.config.mjs')
const compatConfig = read('playwright.production-compat.config.mjs')
const measureRoute = read('src/app/api/measure-1/route.ts')
const doc = read('docs/measure-2-clean-baseline-integrity.md')

const failures = []
const requireText = (source, text, label) => {
  if (!source.includes(text)) failures.push(`${label}: missing ${JSON.stringify(text)}`)
}
const forbidText = (source, text, label) => {
  if (source.includes(text)) failures.push(`${label}: forbidden ${JSON.stringify(text)}`)
}

requireText(middleware, "const PRODUCTION_E2E_HEADER = 'x-rankingwiki-production-e2e'", 'middleware marker header')
requireText(middleware, "const PRODUCTION_E2E_MARKER = 'readonly-v1'", 'middleware marker value')
requireText(middleware, "request.method !== 'POST' || request.nextUrl.pathname !== '/api/measure-1'", 'bounded suppression surface')
requireText(middleware, "request.headers.get(PRODUCTION_E2E_HEADER) !== PRODUCTION_E2E_MARKER", 'exact marker gate')
requireText(middleware, "NextResponse.json({ inserted: false, suppressed: true }, { status: 200 })", 'suppressed telemetry response')
requireText(middleware, "X-RankingWiki-Telemetry", 'suppression readback header')

for (const [label, source] of [
  ['production config', productionConfig],
  ['compat config', compatConfig],
]) {
  requireText(source, "'x-rankingwiki-production-e2e': 'readonly-v1'", label)
}

requireText(measureRoute, "explicitClass === 'qa_internal' || email.endsWith('@example.com')", 'MEASURE-1 authenticated QA classification')
forbidText(measureRoute.toLowerCase(), 'user-agent', 'MEASURE-1 route privacy boundary')
forbidText(measureRoute.toLowerCase(), 'referer', 'MEASURE-1 route privacy boundary')

for (const required of [
  'MEASURE_2_INVESTMENT_GATE = BLOCKED_CONTAMINATED_BASELINE',
  'PRODUCT_FEATURE_INVESTMENT = NO_BUILD',
  'LEGACY_UNKNOWN_EVENTS = PRESERVED_NOT_RECLASSIFIED',
  'POST_FIX_CLEAN_BASELINE = REQUIRED',
  'UNKNOWN != VERIFIED_REAL_USER',
]) {
  requireText(doc, required, 'MEASURE-2 document')
}

if (failures.length) {
  console.error('MEASURE-2 contract verification failed')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('MEASURE-2 contract verification passed')
