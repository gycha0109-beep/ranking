import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(path, 'utf8')
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message)
}

const layout = read('src/app/layout.tsx')
const envExample = read('.env.example')
const seo = read('src/lib/seo.ts')
const robots = read('src/app/robots.ts')
const sitemap = read('src/app/sitemap.ts')
const docs = read('docs/acq-1-search-engine-ownership-submission-readiness.md')
const packageJson = read('package.json')
const ci = read('.github/workflows/ci.yml')

requireCondition(layout.includes("process.env.GOOGLE_SITE_VERIFICATION?.trim()"), 'root metadata must read the Google verification token')
requireCondition(layout.includes("process.env.BING_SITE_VERIFICATION?.trim()"), 'root metadata must read the Bing verification token')
requireCondition(layout.includes("{ google: googleSiteVerification }"), 'Google ownership token must use Next.js verification.google')
requireCondition(layout.includes("'msvalidate.01': bingSiteVerification"), 'Bing ownership token must render the msvalidate.01 meta name')
requireCondition(layout.includes('verification: searchEngineVerification'), 'root metadata must expose the bounded verification object')
requireCondition(layout.includes('googleSiteVerification || bingSiteVerification'), 'verification metadata must remain absent when both tokens are unset')

for (const key of ['GOOGLE_SITE_VERIFICATION=', 'BING_SITE_VERIFICATION=']) {
  requireCondition(envExample.includes(key), `.env.example must document ${key}`)
}
requireCondition(!envExample.includes('GOOGLE_SITE_VERIFICATION=google'), 'Google example must not contain a fake/default token')
requireCondition(!envExample.includes('BING_SITE_VERIFICATION=bing'), 'Bing example must not contain a fake/default token')
requireCondition(!layout.includes("GOOGLE_SITE_VERIFICATION || '"), 'Google verification must not have a hard-coded fallback')
requireCondition(!layout.includes("BING_SITE_VERIFICATION || '"), 'Bing verification must not have a hard-coded fallback')

requireCondition(seo.includes('NEXT_PUBLIC_SITE_URL'), 'canonical origin must remain bound to NEXT_PUBLIC_SITE_URL')
requireCondition(seo.includes('VERCEL_PROJECT_PRODUCTION_URL'), 'canonical origin must preserve the Vercel production fallback')
requireCondition(robots.includes("allow: '/'"), 'robots must continue allowing public crawling')
requireCondition(robots.includes("disallow: ['/admin', '/me', '/login']"), 'robots must preserve private-surface exclusions')
requireCondition(robots.includes("sitemap: absoluteUrl('/sitemap.xml')"), 'robots must continue advertising the Production sitemap')
requireCondition(sitemap.includes("export const dynamic = 'force-dynamic'"), 'sitemap must remain dynamically generated from current public authority')
requireCondition(sitemap.includes('getPublicSitemapRows()'), 'sitemap must continue using the LAUNCH-2 public row authority')

for (const phrase of [
  'TECHNICALLY_CRAWLABLE',
  'OWNERSHIP_VERIFIED',
  'SITEMAP_SUBMITTED',
  'INDEXED',
  'PENDING_EXTERNAL_ENGINE_OWNERSHIP',
  'SEARCH_ENGINE_INDEXING = UNCONFIRMED',
  'must not be treated as an exhaustive index inventory',
  'No fallback, sample, synthetic, or guessed token',
]) {
  requireCondition(docs.includes(phrase), `ACQ-1 docs must freeze evidence boundary: ${phrase}`)
}

requireCondition(packageJson.includes('"verify:acq-1": "node scripts/verify-acq-1-search-engine-readiness.mjs"'), 'package.json must expose verify:acq-1')
requireCondition(ci.includes('npm run verify:acq-1'), 'CI must run the ACQ-1 verifier')

console.log('ACQ-1 search engine readiness verified')
