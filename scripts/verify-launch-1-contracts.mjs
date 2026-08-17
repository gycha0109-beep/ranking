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
const adminClient = read('src/lib/supabase/admin.ts')
const bookmarksPage = read('src/app/me/bookmarks/page.tsx')
const bookmarkRemoveButton = read('src/components/engagement/BookmarkRemoveButton.tsx')
const commentReportReconciliation = read('supabase/migrations/20260817001000_launch_p0_comment_report_contract_reconciliation.sql')
const envExample = read('.env.example')
const routing = read('src/lib/routing.ts')
const publicQueries = read('src/lib/queries/public.ts')
const seo = read('src/lib/seo.ts')
const middleware = read('src/middleware.ts')
const publicE2EWorkflow = read('.github/workflows/production-e2e.yml')
const productionQAWorkflow = read('.github/workflows/production-qa.yml')
const productionQAConfig = read('playwright.production-qa.config.mjs')
const productionCompatConfig = read('playwright.production-compat.config.mjs')
const productionQASpec = read('tests/e2e/production-qa.spec.mjs')
const productionReadonlyUXSpec = read('tests/e2e/production-readonly-ux.spec.mjs')
const productionQADesign = read('docs/launch-production-qa-suite.md')

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
requireCondition(login.includes('type="button"'), 'login mode switch must not submit the form')
requireCondition(!loginPage.includes("bg-[#0a0a0c]"), 'login suspense fallback must not restore the legacy dark canvas')
requireCondition(!loginPage.includes('보안 인증 센터'), 'login suspense fallback must use public account language')

requireCondition(auth.includes("process.env.NODE_ENV !== 'development'"), 'admin bootstrap must remain development-only')
requireCondition(auth.includes('SUPABASE_SERVICE_ROLE_KEY'), 'admin bootstrap/service path must keep the server role key explicit')
requireCondition(auth.includes('authErrorMessage'), 'public auth failures must use a controlled localization mapper')
requireCondition(auth.includes("case 'invalid_credentials':"), 'invalid credentials must have an explicit localized auth mapping')
requireCondition(auth.includes('이메일 또는 비밀번호가 올바르지 않습니다.'), 'invalid credentials must render a Korean public message')
requireCondition(!auth.includes('return { ok: false, error: error.message }'), 'raw Supabase auth messages must not be returned to the public login/signup UI')

requireCondition(engagement.includes("import { createPublicClient } from '@/lib/supabase/public'"), 'engagement target reads must use the session-independent public client')
requireCondition(engagement.includes('const publicSupabase = createPublicClient()'), 'engagement target resolution must create a public client')
requireCondition(engagement.includes("const { data: ranking, error } = await publicSupabase\n      .from('rankings')"), 'ranking engagement target lookup must not depend on the authenticated RLS role')
requireCondition(engagement.includes("const { data: item, error } = await publicSupabase\n    .from('items')"), 'item engagement target lookup must not depend on the authenticated RLS role')
requireCondition(engagement.includes('const { data, error } = await publicSupabase\n    .from(table)'), 'view target validation must preserve the public-read security boundary')

requireCondition(adminClient.includes('SUPABASE_SECRET_KEY'), 'admin client must accept the current Supabase Secret-key environment contract')
requireCondition(adminClient.includes('SUPABASE_SERVICE_ROLE_KEY'), 'admin client must preserve the legacy service-role environment fallback')
requireCondition(adminClient.includes('process.env.SUPABASE_SERVICE_ROLE_KEY = configuredAdminKey'), 'current Secret keys must bridge legacy server-only view-writer consumers')
requireCondition(adminClient.includes('detectSessionInUrl: false'), 'server admin client must disable URL session detection')

requireCondition(comments.includes("import { createPublicClient } from '@/lib/supabase/public'"), 'comment target validation must use the session-independent public client')
requireCondition(comments.includes('const publicSupabase = createPublicClient()'), 'comment target validation must create a public client')
requireCondition(comments.includes("const { data, error } = await publicSupabase\n      .from('rankings')"), 'ranking comment target validation must not depend on the authenticated RLS role')
requireCondition(comments.includes("const { data, error } = await publicSupabase\n    .from('items')"), 'item comment target validation must not depend on the authenticated RLS role')

requireCondition(commentReportReconciliation.includes('CREATE OR REPLACE FUNCTION public.create_comment_report'), 'comment report reconciliation must restore the hosted canonical create RPC')
requireCondition(commentReportReconciliation.includes('CREATE OR REPLACE FUNCTION public.get_my_comment_report_states'), 'comment report reconciliation must restore the hosted canonical state RPC')
requireCondition(commentReportReconciliation.includes('CREATE OR REPLACE FUNCTION public.report_content_comment'), 'comment report reconciliation must preserve the current application compatibility RPC')
requireCondition(commentReportReconciliation.includes('CREATE OR REPLACE FUNCTION public.get_my_reported_comment_ids'), 'comment report reconciliation must preserve comment-list report-state compatibility')
requireCondition(commentReportReconciliation.includes('TO authenticated;'), 'comment report RPCs must remain authenticated-only')

requireCondition(bookmarksPage.includes('BookmarkRemoveButton'), 'bookmark library must expose a direct remove action')
requireCondition(bookmarkRemoveButton.includes('bookmarked: false'), 'bookmark library removal must call the existing bookmark-off mutation')
requireCondition(bookmarkRemoveButton.includes('router.refresh()'), 'bookmark library must refresh after removal')

requireCondition(envExample.includes('Development-only first-admin bootstrap'), 'env example must mark ADMIN_BOOTSTRAP_EMAIL development-only')
requireCondition(envExample.includes('SUPABASE_SECRET_KEY='), 'env example must expose the current server Secret-key variable')
requireCondition(envExample.includes('SUPABASE_SERVICE_ROLE_KEY='), 'env example must retain the legacy server-key fallback')
requireCondition(envExample.includes('VIEWER_HASH_SECRET='), 'env example must document the daily unique-view HMAC secret')
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
requireCondition(middleware.includes('noindex, nofollow'), 'private surfaces must keep noindex,nofollow')

requireCondition(publicE2EWorkflow.includes('tests/e2e/production-smoke.spec.mjs'), 'public production E2E must explicitly execute the deep public smoke spec')
requireCondition(publicE2EWorkflow.includes('playwright.production-compat.config.mjs'), 'public production E2E must execute the cross-browser compatibility config')
requireCondition(publicE2EWorkflow.includes('chromium firefox webkit'), 'public compatibility workflow must install Chromium, Firefox, and WebKit')

requireCondition(productionQAWorkflow.includes('secrets.E2E_USER_EMAIL'), 'production QA email must come from a GitHub Actions secret')
requireCondition(productionQAWorkflow.includes('secrets.E2E_USER_PASSWORD'), 'production QA password must come from a GitHub Actions secret')
requireCondition(!productionQAWorkflow.includes('SUPABASE_SECRET_KEY'), 'production browser QA must not receive the current Supabase server secret')
requireCondition(!productionQAWorkflow.includes('SUPABASE_SERVICE_ROLE_KEY'), 'production browser QA must not receive the legacy Supabase server key')
requireCondition(productionQAWorkflow.includes('tests/e2e/production-qa.spec.mjs'), 'production QA workflow must execute only the integrated credentialed spec')
requireCondition(productionQAWorkflow.includes('workflow_dispatch:'), 'production mutation QA must remain explicitly dispatchable')
requireCondition(!productionQAWorkflow.includes('\n  push:'), 'production mutation QA must not auto-run on repository pushes')

requireCondition(productionQAConfig.includes("trace: 'off'"), 'production QA must not retain browser traces containing authenticated state')
requireCondition(productionQAConfig.includes("screenshot: 'off'"), 'production QA must not retain authenticated screenshots')
requireCondition(productionQAConfig.includes("video: 'off'"), 'production QA must not retain authenticated video')
requireCondition(productionQAConfig.includes('workers: 1'), 'production mutation QA must run serially')

for (const device of ['Desktop Chrome', 'Desktop Firefox', 'Desktop Safari', 'Pixel 5', 'iPhone 13']) {
  requireCondition(productionCompatConfig.includes(device), `production compatibility config must include ${device}`)
}
requireCondition(productionCompatConfig.includes('production-readonly-ux.spec.mjs'), 'compatibility config must isolate the read-only UX spec')
requireCondition(productionCompatConfig.includes('workers: 1'), 'cross-browser production compatibility must run serially')

requireCondition(productionQASpec.includes("const TARGET_PATH = '/rankings/best-chicken-breast'"), 'production mutation QA must remain pinned to the approved stable target')
requireCondition(productionQASpec.includes('이메일 또는 비밀번호가 올바르지 않습니다.'), 'production QA must verify localized invalid credentials')
requireCondition(productionQASpec.includes('Invalid login credentials'), 'production QA must explicitly reject the raw Supabase invalid-login copy')
requireCondition(productionQASpec.includes('ensureLikeState(page, false)'), 'production QA must normalize likes to OFF during cleanup')
requireCondition(productionQASpec.includes('ensureBookmarkState(page, false)'), 'production QA must normalize bookmarks to OFF during cleanup')
requireCondition(productionQASpec.includes('deleteCommentIfVisible'), 'production QA must include best-effort comment cleanup')
requireCondition(productionQASpec.includes('북마크 제거'), 'production QA must cover direct removal from the bookmark library')
requireCondition(productionQASpec.includes('댓글 신고 상태를 불러오지 못했습니다.'), 'production QA must guard the comment report-state regression')
requireCondition(productionQASpec.includes('same browser identity must not add a second daily view'), 'production QA must verify daily unique-view dedupe')
requireCondition(!productionQASpec.includes('CommentReportForm'), 'production QA must not automate comment reporting')
requireCondition(!productionQASpec.includes("getByRole('button', { name: '신고'"), 'production QA must not submit user reports')

requireCondition(productionReadonlyUXSpec.includes("const TARGET_PATH = '/rankings/best-chicken-breast'"), 'read-only UX QA must use the stable published ranking')
requireCondition(productionReadonlyUXSpec.includes('검색 결과가 없습니다'), 'read-only UX QA must cover the zero-result state')
requireCondition(productionReadonlyUXSpec.includes('페이지 위치를 초기화했습니다.'), 'read-only UX QA must cover invalid cursor recovery')
requireCondition(productionReadonlyUXSpec.includes('현재 검색 대상에 맞지 않는 Facet 필터를 제거했습니다.'), 'read-only UX QA must cover unavailable Facet canonicalization')
requireCondition(productionReadonlyUXSpec.includes('좋아요 추가'), 'read-only UX QA must cover signed-out like login routing')
requireCondition(productionReadonlyUXSpec.includes('북마크 추가'), 'read-only UX QA must cover signed-out bookmark login routing')
requireCondition(productionReadonlyUXSpec.includes('로그인하고 댓글 작성하기'), 'read-only UX QA must cover signed-out comment login routing')
requireCondition(productionReadonlyUXSpec.includes('이 순위가 만들어진 기준'), 'read-only UX QA must validate ranking document anatomy')
requireCondition(productionReadonlyUXSpec.includes('new-password'), 'read-only UX QA must inspect the signup entry surface without submitting it')
requireCondition(productionReadonlyUXSpec.includes('maxTouchPoints'), 'mobile compatibility QA must assert touch-capable emulation')
requireCondition(productionReadonlyUXSpec.includes("setTimeout(resolve, 250)"), 'read-only UX QA must exercise delayed network behavior')
requireCondition(productionReadonlyUXSpec.includes('page.reload'), 'read-only UX QA must exercise repeated reload recovery')

requireCondition(productionQADesign.includes('append-only engagement events'), 'production QA design must disclose unavoidable dedicated-account audit traces')
requireCondition(productionQADesign.includes('physical-device'), 'production QA design must distinguish emulation from physical-device validation')
requireCondition(productionQADesign.includes('no production Facet fixtures'), 'production QA design must disclose the missing multi-Facet fixture')
requireCondition(productionQADesign.includes('full fresh-user signup/login/logout lifecycle'), 'production QA design must disclose the production signup cleanup boundary')
requireCondition(productionQADesign.includes('MUST NOT perform'), 'production QA design must state mutation non-goals')

console.log('LAUNCH-1 contracts verified')
