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
const envExample = read('.env.example')
const routing = read('src/lib/routing.ts')
const publicQueries = read('src/lib/queries/public.ts')
const seo = read('src/lib/seo.ts')
const middleware = read('src/middleware.ts')
const publicE2EWorkflow = read('.github/workflows/production-e2e.yml')
const authE2EWorkflow = read('.github/workflows/production-auth-e2e.yml')
const authE2ESpec = read('tests/e2e/production-auth.spec.mjs')
const authE2EConfig = read('playwright.production-auth.config.mjs')
const authE2EDesign = read('docs/launch-1-authenticated-production-e2e-design.md')

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

requireCondition(publicE2EWorkflow.includes('production-smoke.spec.mjs'), 'public production E2E must run the public spec explicitly')
requireCondition(authE2EWorkflow.includes('secrets.E2E_USER_EMAIL'), 'authenticated E2E email must come from a repository secret')
requireCondition(authE2EWorkflow.includes('secrets.E2E_USER_PASSWORD'), 'authenticated E2E password must come from a repository secret')
requireCondition(!authE2EWorkflow.includes('SUPABASE_SERVICE_ROLE_KEY'), 'authenticated production E2E must not receive the Supabase service role key')
requireCondition(!authE2EWorkflow.includes('radar-test@example.com'), 'authenticated E2E workflow must not hardcode a test email')
requireCondition(authE2EWorkflow.includes('production-auth.spec.mjs'), 'authenticated production E2E must run the auth spec explicitly')
requireCondition(authE2ESpec.includes("'/me/bookmarks'"), 'authenticated E2E must verify the protected bookmark surface')
requireCondition(authE2ESpec.includes("'/admin'"), 'authenticated E2E must verify ordinary-user admin denial')
requireCondition(authE2ESpec.includes("name: '로그아웃'"), 'authenticated E2E must verify logout')
requireCondition(!authE2ESpec.includes('SUPABASE_SERVICE_ROLE_KEY'), 'authenticated E2E spec must not use privileged Supabase credentials')
requireCondition(authE2EConfig.includes("trace: 'off'"), 'authenticated E2E must disable trace capture around password entry')
requireCondition(authE2EConfig.includes("video: 'off'"), 'authenticated E2E must disable video capture around password entry')
requireCondition(authE2EDesign.includes('content_like_events'), 'authenticated E2E design must document production like-event pollution')
requireCondition(authE2EDesign.includes("status='deleted'"), 'authenticated E2E design must document comment soft-delete persistence')
requireCondition(authE2EDesign.includes('read-only'), 'authenticated production E2E must remain read-only after authentication')

console.log('LAUNCH-1 contracts verified')
