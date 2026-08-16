import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(path, 'utf8')
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message)
}

const login = read('src/app/login/LoginForm.tsx')
const loginPage = read('src/app/login/page.tsx')
const auth = read('src/lib/actions/auth.ts')
const engagement = read('src/lib/actions/engagement.ts')
const comments = read('src/lib/actions/comments.ts')
const envExample = read('.env.example')
const routing = read('src/lib/routing.ts')
const publicQueries = read('src/lib/queries/public.ts')
const seo = read('src/lib/seo.ts')
const middleware = read('src/middleware.ts')

for (const forbidden of [
  '랭킹위키 MVP',
  '신규 에디터',
  '새 에디터',
  'ADMIN_BOOTSTRAP_EMAIL',
  '.env.local',
  'RLS 우회',
  '어드민 권한으로 대시보드',
]) {
  requireCondition(!login.includes(forbidden), `public login exposes launch-forbidden copy: ${forbidden}`)
}

requireCondition(login.includes('rw-page'), 'login must use the UI-1 public shell')
requireCondition(login.includes("rawNextPath?.startsWith('/')") && login.includes("!rawNextPath.startsWith('//')"), 'login must preserve safe next-path validation')
requireCondition(login.includes('투표, 좋아요, 북마크, 댓글'), 'login must describe ordinary account participation')
requireCondition(login.includes("type=\"button\""), 'login mode switch must not submit the form')
requireCondition(!loginPage.includes('bg-[#0a0a0c]'), 'login suspense fallback must not restore the legacy dark canvas')
requireCondition(!loginPage.includes('보안 인증 센터'), 'login suspense fallback must use public account language')

requireCondition(auth.includes("process.env.NODE_ENV !== 'development'"), 'admin bootstrap must remain development-only')
requireCondition(auth.includes('SUPABASE_SERVICE_ROLE_KEY'), 'admin bootstrap/service path must keep the server role key explicit')
requireCondition(auth.includes('authErrorMessage'), 'public auth failures must use a controlled localization mapper')
requireCondition(auth.includes("case 'invalid_credentials':"), 'invalid credentials must have an explicit localized auth mapping')
requireCondition(auth.includes('이메일 또는 비밀번호가 올바르지 않습니다.'), 'invalid credentials must render a Korean public message')
requireCondition(!auth.includes("return { ok: false, error: error.message }"), 'raw Supabase auth messages must not be returned to the public login/signup UI')

requireCondition(engagement.includes("import { createPublicClient } from '@/lib/supabase/public'"), 'engagement target reads must use the session-independent public client')
requireCondition(engagement.includes('const publicSupabase = createPublicClient()'), 'engagement target resolution must create a public client')
requireCondition(engagement.includes("const { data: ranking, error } = await publicSupabase\n      .from('rankings')"), 'ranking engagement target lookup must not depend on the authenticated RLS role')
requireCondition(engagement.includes("const { data: item, error } = await publicSupabase\n    .from('items')"), 'item engagement target lookup must not depend on the authenticated RLS role')
requireCondition(engagement.includes('const { data, error } = await publicSupabase\n    .from(table)'), 'view target validation must preserve the public-read security boundary')

requireCondition(comments.includes("import { createPublicClient } from '@/lib/supabase/public'"), 'comment target validation must use the session-independent public client')
requireCondition(comments.includes('const publicSupabase = createPublicClient()'), 'comment target validation must create a public client')
requireCondition(comments.includes("const { data, error } = await publicSupabase\n      .from('rankings')"), 'ranking comment target validation must not depend on the authenticated RLS role')
requireCondition(comments.includes("const { data, error } = await publicSupabase\n    .from('items')"), 'item comment target validation must not depend on the authenticated RLS role')

requireCondition(envExample.includes('Development-only first-admin bootstrap'), 'env example must mark ADMIN_BOOTSTRAP_EMAIL development-only')
requireCondition(envExample.includes('Server-only.'), 'env example must mark the service role key server-only')
requireCondition(envExample.includes('NEXT_PUBLIC_SITE_URL='), 'env example must expose the production site-origin contract')

requireCondition(routing.includes('decodeURIComponent(value)'), 'public slug normalization must decode percent-encoded route params')
requireCondition(routing.includes('catch') && routing.includes('return value'), 'public slug normalization must tolerate malformed percent encoding')
requireCondition(publicQueries.includes("import { normalizeRouteSlug } from '@/lib/routing'"), 'public data queries must share route slug normalization')
requireCondition(publicQueries.includes('const normalizedSlug = normalizeRouteSlug(slug)'), 'public item/ranking slug queries must normalize encoded params')
requireCondition(publicQueries.includes('const normalizedCategorySlug = normalizeRouteSlug(categorySlug)'), 'public category slug queries must normalize encoded params')
requireCondition(publicQueries.includes('const normalizedSubcategorySlug = normalizeRouteSlug(subcategorySlug)'), 'public subcategory slug queries must normalize encoded params')
requireCondition(seo.includes("import { normalizeRouteSlug } from '@/lib/routing'"), 'SEO snapshots must share route slug normalization')
requireCondition(seo.includes('const normalizedSlug = normalizeRouteSlug(slug)'), 'SEO item/ranking snapshots must normalize encoded params')
requireCondition(seo.includes('const normalizedCategorySlug = normalizeRouteSlug(categorySlug)'), 'SEO category snapshots must normalize encoded params')
requireCondition(seo.includes('const normalizedSubcategorySlug = normalizeRouteSlug(subcategorySlug)'), 'SEO subcategory snapshots must normalize encoded params')

const explicitOriginIndex = seo.indexOf('NEXT_PUBLIC_SITE_URL')
const vercelOriginIndex = seo.indexOf('VERCEL_PROJECT_PRODUCTION_URL')
requireCondition(explicitOriginIndex >= 0 && vercelOriginIndex > explicitOriginIndex, 'production site origin must prefer NEXT_PUBLIC_SITE_URL before the Vercel fallback')
requireCondition(middleware.includes("pathname === '/login'"), 'login must remain a private noindex surface')
requireCondition(middleware.includes("noindex, nofollow"), 'private surfaces must keep noindex,nofollow')

console.log('LAUNCH-1 contracts verified')
