import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const checks = []
function requireText(path, text, label = `${path}: ${text}`) {
  const content = read(path)
  if (!content.includes(text)) throw new Error(`P1-5 contract failed: ${label}`)
  checks.push(label)
}

requireText('src/app/robots.ts', "disallow: ['/admin', '/me', '/login']", 'robots excludes private surfaces')
if (read('src/app/robots.ts').includes("'/search'")) throw new Error('P1-5 contract failed: search must remain crawlable so noindex can be observed')
checks.push('search is not robots-disallowed')
requireText('src/app/sitemap.ts', "export const dynamic = 'force-dynamic'", 'sitemap is runtime-generated')
requireText('src/app/sitemap.ts', 'getPublicSitemapRows', 'sitemap uses public-safe rows')
requireText('src/lib/seo.ts', ".eq('status', 'published')", 'sitemap/ranking SEO requires published rankings')
requireText('src/lib/seo.ts', ".eq('status', 'active')", 'sitemap/item SEO requires active items')
requireText('src/lib/seo.ts', ".in('moderation_status', PUBLIC_MODERATION_STATUSES)", 'SEO helpers enforce moderation')
requireText('src/lib/seo.ts', ".replace(/</g, '\\\\u003c')", 'JSON-LD serialization scrubs less-than')
requireText('src/app/search/layout.tsx', 'index: false, follow: true', 'search is noindex follow')
requireText('src/app/admin/layout.tsx', 'index: false, follow: false', 'admin is noindex nofollow')
requireText('src/app/me/layout.tsx', 'index: false, follow: false', 'account area is noindex nofollow')
requireText('src/app/login/layout.tsx', 'index: false, follow: false', 'login is noindex nofollow')
requireText('src/middleware.ts', "['sort', 'cursor', 'facet']", 'category query variants are detected')
requireText('src/middleware.ts', "'X-Robots-Tag', 'noindex, follow'", 'query variants receive noindex header')
requireText('src/middleware.ts', 'robots.txt|sitemap.xml', 'middleware excludes metadata routes')
requireText('src/app/rankings/[rankingSlug]/layout.tsx', "'@type': 'ItemList'", 'ranking emits ItemList JSON-LD')
requireText('src/app/rankings/[rankingSlug]/layout.tsx', "'@type': 'BreadcrumbList'", 'ranking emits breadcrumb JSON-LD')
requireText('src/app/items/[itemSlug]/layout.tsx', "'@type': 'Thing'", 'generic item schema remains Thing')
if (read('src/app/items/[itemSlug]/layout.tsx').includes("'@type': 'Product'")) throw new Error('P1-5 contract failed: generic Product schema is forbidden')
checks.push('generic Product schema is forbidden')
requireText('README.md', 'P1 COMPLETE', 'README reflects P1 closure')
requireText('.github/workflows/ci.yml', 'npm run verify:p1-5', 'CI runs P1-5 verifier')

console.log(`P1-5 contract verification passed (${checks.length} checks).`)
