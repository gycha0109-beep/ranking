const args = process.argv.slice(2)

function argValue(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function hasFlag(name) {
  return args.includes(name)
}

function fail(message) {
  throw new Error(message)
}

function normalizeSite(value) {
  if (!value) fail('Missing --site <https://origin>')
  const url = new URL(value)
  if (url.protocol !== 'https:') fail('ACQ-3 requires an https Production origin')
  if (url.pathname !== '/' || url.search || url.hash) fail('--site must be an origin without path, query, or fragment')
  return url.origin
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'RankingWiki-ACQ3-Readback/1.0' },
    redirect: 'follow',
  })
  return { response, text: await response.text() }
}

function metaContent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) return match[1]
  }
  return null
}

function canonicalHref(html) {
  const patterns = [
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) return match[1]
  }
  return null
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1].trim())
}

async function inspectPublicPage(url) {
  const { response, text } = await fetchText(url)
  const robots = metaContent(text, 'robots')
  const canonical = canonicalHref(text)
  return {
    url,
    status: response.status,
    robots,
    canonical,
    indexFollow: typeof robots === 'string' && /\bindex\b/i.test(robots) && /\bfollow\b/i.test(robots),
    canonicalMatches: canonical === url || canonical === `${url}/` || `${canonical}/` === url,
  }
}

const site = normalizeSite(argValue('--site') || process.env.NEXT_PUBLIC_SITE_URL)
const requireGoogleTag = hasFlag('--require-google-tag')
const requireBingTag = hasFlag('--require-bing-tag')

const rootUrl = `${site}/`
const robotsUrl = `${site}/robots.txt`
const sitemapUrl = `${site}/sitemap.xml`

const [root, robots, sitemap] = await Promise.all([
  fetchText(rootUrl),
  fetchText(robotsUrl),
  fetchText(sitemapUrl),
])

if (root.response.status !== 200) fail(`Production root returned ${root.response.status}`)
if (robots.response.status !== 200) fail(`robots.txt returned ${robots.response.status}`)
if (sitemap.response.status !== 200) fail(`sitemap.xml returned ${sitemap.response.status}`)

const rootRobots = metaContent(root.text, 'robots')
const rootCanonical = canonicalHref(root.text)
const googleTagPresent = Boolean(metaContent(root.text, 'google-site-verification'))
const bingTagPresent = Boolean(metaContent(root.text, 'msvalidate.01'))

if (!rootRobots || !/\bindex\b/i.test(rootRobots) || !/\bfollow\b/i.test(rootRobots)) {
  fail('Production root must expose index, follow')
}
if (!(rootCanonical === site || rootCanonical === `${site}/`)) {
  fail(`Production root canonical mismatch: ${rootCanonical ?? 'missing'}`)
}
if (!robots.text.includes('Allow: /')) fail('robots.txt must allow public crawling')
if (!robots.text.includes(`Sitemap: ${sitemapUrl}`)) fail('robots.txt must advertise the canonical sitemap')

const locs = extractLocs(sitemap.text)
if (locs.length === 0) fail('sitemap.xml contains no <loc> entries')
const offOrigin = locs.filter((value) => new URL(value).origin !== site)
if (offOrigin.length > 0) fail(`sitemap.xml contains ${offOrigin.length} off-origin URL(s)`)
if (new Set(locs).size !== locs.length) fail('sitemap.xml contains duplicate URLs')

const rankingUrl = locs.find((value) => new URL(value).pathname.startsWith('/rankings/'))
const itemUrl = locs.find((value) => new URL(value).pathname.startsWith('/items/'))
if (!rankingUrl) fail('sitemap.xml contains no ranking detail URL')
if (!itemUrl) fail('sitemap.xml contains no item detail URL')

const [rankingSample, itemSample] = await Promise.all([
  inspectPublicPage(rankingUrl),
  inspectPublicPage(itemUrl),
])
for (const sample of [rankingSample, itemSample]) {
  if (sample.status !== 200) fail(`Sample URL returned ${sample.status}: ${sample.url}`)
  if (!sample.indexFollow) fail(`Sample URL is not index, follow: ${sample.url}`)
  if (!sample.canonicalMatches) fail(`Sample canonical mismatch: ${sample.url} -> ${sample.canonical}`)
}

if (requireGoogleTag && !googleTagPresent) fail('Google verification tag is required but absent')
if (requireBingTag && !bingTagPresent) fail('Bing verification tag is required but absent')

const result = {
  site,
  technicalCrawlability: 'VERIFIED',
  root: {
    status: root.response.status,
    canonical: rootCanonical,
    robots: rootRobots,
  },
  robots: {
    status: robots.response.status,
    sitemapAdvertised: true,
  },
  sitemap: {
    status: sitemap.response.status,
    urlCount: locs.length,
    sameOriginOnly: true,
    duplicateFree: true,
  },
  samples: {
    ranking: rankingSample,
    item: itemSample,
  },
  verificationSurface: {
    googleTagPresent,
    bingTagPresent,
  },
  externalAuthority: {
    googleOwnershipVerified: 'UNCONFIRMED',
    bingOwnershipVerified: 'UNCONFIRMED',
    googleSitemapSubmitted: 'UNCONFIRMED',
    bingSitemapSubmitted: 'UNCONFIRMED',
    crawlStatus: 'UNCONFIRMED',
    indexStatus: 'UNCONFIRMED',
  },
}

console.log(JSON.stringify(result, null, 2))
console.log('\nACQ-3 boundary: verification-tag presence is not ownership verification; public-site readback cannot assert engine-side sitemap submission, crawl, or index state.')
