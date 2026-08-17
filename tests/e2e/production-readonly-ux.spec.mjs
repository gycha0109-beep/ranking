import { expect, test } from '@playwright/test'

const TARGET_PATH = '/rankings/best-chicken-breast'
const TARGET_TITLE = '2026 닭가슴살 TOP 10'
const NO_RESULT_QUERY = 'noresult7f3c2rankingwiki'
const FAKE_FACET_ID = '00000000-0000-4000-8000-000000000001'

function monitorRuntimeFailures(page) {
  const failures = []

  page.on('pageerror', (error) => {
    failures.push(`pageerror: ${error.message}`)
  })

  page.on('response', (response) => {
    if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`)
  })

  return failures
}

async function expectHealthyNavigation(page, path) {
  const failures = monitorRuntimeFailures(page)
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  expect(response, `missing navigation response for ${path}`).not.toBeNull()
  expect(response.status(), `${path} returned ${response.status()}`).toBeLessThan(400)
  await expect(page.locator('body')).not.toContainText('This page could not be found.')
  await expect(page.locator('body')).not.toContainText('Application error')
  expect(failures, `runtime failures on ${path}`).toEqual([])
}

function expectLoginReturnPath(page, expectedPath) {
  const url = new URL(page.url())
  expect(url.pathname).toBe('/login')
  expect(url.searchParams.get('next')).toBe(expectedPath)
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(dimensions.scrollWidth, `horizontal overflow on ${label}`).toBeLessThanOrEqual(dimensions.clientWidth + 2)
}

test.describe('production read-only UX compatibility', () => {
  test('search finds the published ranking and browser history restores sort state', async ({ page }) => {
    await expectHealthyNavigation(page, '/search?q=%EB%8B%AD%EA%B0%80%EC%8A%B4%EC%82%B4&type=ranking&sort=relevance')

    await expect(page.getByRole('heading', { level: 2, name: '“닭가슴살”' })).toBeVisible()
    const rankingResult = page.locator(`a[href="${TARGET_PATH}"]`).filter({ hasText: TARGET_TITLE }).first()
    await expect(rankingResult).toBeVisible()
    await expect(page.getByLabel('검색 대상')).toHaveValue('ranking')
    await expect(page.getByLabel('검색 정렬')).toHaveValue('relevance')

    await page.getByLabel('검색 정렬').selectOption('popular')
    await page.getByRole('search').getByRole('button', { name: '검색' }).click()
    await page.waitForURL((url) => url.pathname === '/search' && url.searchParams.get('sort') === 'popular')
    await expect(page.locator(`a[href="${TARGET_PATH}"]`).filter({ hasText: TARGET_TITLE }).first()).toBeVisible()

    await page.goBack({ waitUntil: 'domcontentloaded' })
    await expect(page.getByLabel('검색 정렬')).toHaveValue('relevance')
    expect(new URL(page.url()).searchParams.get('sort')).toBe('relevance')

    const searchbox = page.getByRole('searchbox', { name: '랭킹위키 검색' })
    await searchbox.fill('닭가슴살')
    await searchbox.press('Enter')
    await page.waitForURL((url) => url.pathname === '/search' && url.searchParams.get('q') === '닭가슴살')
    await expect(page.locator(`a[href="${TARGET_PATH}"]`).filter({ hasText: TARGET_TITLE }).first()).toBeVisible()
  })

  test('empty search, invalid cursor, and unavailable facet state fail soft', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'deep query-state resilience runs once on Chromium')

    await expectHealthyNavigation(page, `/search?q=${NO_RESULT_QUERY}`)
    await expect(page.getByRole('heading', { level: 3, name: '검색 결과가 없습니다' })).toBeVisible()
    const categoryEscape = page.getByRole('link', { name: '카테고리 탐색' })
    await expect(categoryEscape).toHaveAttribute('href', '/categories')

    await expectHealthyNavigation(page, '/search?q=%EB%8B%AD%EA%B0%80%EC%8A%B4%EC%82%B4&cursor=not-a-valid-cursor')
    await expect(page.getByText('페이지 위치를 초기화했습니다.')).toBeVisible()
    await expect(page.locator(`a[href="${TARGET_PATH}"]`).first()).toBeVisible()

    await expectHealthyNavigation(page, `/search?q=%EB%8B%AD%EA%B0%80%EC%8A%B4%EC%82%B4&facet=${FAKE_FACET_ID}`)
    await expect(page.getByText('현재 검색 대상에 맞지 않는 Facet 필터를 제거했습니다.')).toBeVisible()
    await expect(page.locator(`a[href="${TARGET_PATH}"]`).first()).toBeVisible()
  })

  test('signed-out participation actions consistently route to login and preserve return path', async ({ page }) => {
    await expectHealthyNavigation(page, TARGET_PATH)
    const like = page.getByRole('button', { name: /좋아요 추가$/ }).first()
    await expect(like).toBeVisible()
    await like.click()
    await page.waitForURL((url) => url.pathname === '/login')
    expectLoginReturnPath(page, TARGET_PATH)

    await expectHealthyNavigation(page, TARGET_PATH)
    const bookmark = page.getByRole('button', { name: /북마크 추가$/ }).first()
    await expect(bookmark).toBeVisible()
    await bookmark.click()
    await page.waitForURL((url) => url.pathname === '/login')
    expectLoginReturnPath(page, TARGET_PATH)

    await expectHealthyNavigation(page, TARGET_PATH)
    const commentLogin = page.getByRole('button', { name: '로그인하고 댓글 작성하기' })
    await expect(commentLogin).toBeVisible()
    await commentLogin.click()
    await page.waitForURL((url) => url.pathname === '/login')
    expectLoginReturnPath(page, TARGET_PATH)
  })

  test('published ranking exposes enough document anatomy to traverse from ranking to item and back', async ({ page }) => {
    await expectHealthyNavigation(page, TARGET_PATH)
    await expect(page.getByRole('heading', { level: 1, name: TARGET_TITLE })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: '순위' })).toBeVisible()
    await expect(page.getByText(/총 \d+개 항목/)).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: '이 순위가 만들어진 기준' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: '평가 기준' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: '출처' })).toBeVisible()

    const itemHrefs = await page.locator('a[href^="/items/"]').evaluateAll((anchors) =>
      [...new Set(anchors.map((anchor) => anchor.getAttribute('href')).filter(Boolean))]
    )
    expect(itemHrefs.length, 'published ranking must expose at least one item detail path').toBeGreaterThan(0)

    const firstItemPath = itemHrefs[0]
    await page.locator(`a[href="${firstItemPath}"]`).first().click()
    await page.waitForURL((url) => url.pathname === firstItemPath)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

    await page.goBack({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1, name: TARGET_TITLE })).toBeVisible()
  })

  test('account entry surface exposes signup fields without mutating production auth', async ({ page }) => {
    await expectHealthyNavigation(page, '/login')
    await page.getByRole('button', { name: '회원가입' }).click()
    await expect(page.getByRole('heading', { level: 1, name: '회원가입' })).toBeVisible()
    await expect(page.getByLabel('이름 또는 닉네임')).toBeVisible()
    await expect(page.getByLabel('이메일')).toHaveAttribute('type', 'email')
    await expect(page.getByLabel('비밀번호')).toHaveAttribute('autocomplete', 'new-password')
    await expect(page.getByRole('button', { name: '회원가입', exact: true })).toBeVisible()

    await page.getByRole('button', { name: '로그인', exact: true }).last().click()
    await expect(page.getByRole('heading', { level: 1, name: '로그인' })).toBeVisible()
  })

  test('responsive projects stay within viewport and mobile projects expose touch capability', async ({ page }, testInfo) => {
    for (const path of ['/search?q=%EB%8B%AD%EA%B0%80%EC%8A%B4%EC%82%B4', TARGET_PATH, '/login']) {
      await expectHealthyNavigation(page, path)
      await assertNoHorizontalOverflow(page, `${testInfo.project.name}:${path}`)
    }

    if (testInfo.project.name.startsWith('mobile-')) {
      const environment = await page.evaluate(() => ({
        maxTouchPoints: navigator.maxTouchPoints,
        viewportWidth: window.innerWidth,
      }))
      expect(environment.maxTouchPoints, 'mobile emulation must expose touch input').toBeGreaterThan(0)
      expect(environment.viewportWidth, 'mobile viewport should stay phone-sized').toBeLessThanOrEqual(500)
    }
  })

  test('delayed requests and repeated reloads recover without runtime or server failures', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'network stress runs once on Chromium')

    const failures = monitorRuntimeFailures(page)
    await page.route('**/*', async (route) => {
      const type = route.request().resourceType()
      if (type === 'document' || type === 'fetch' || type === 'xhr') {
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      await route.continue()
    })

    await page.goto('/search?q=%EB%8B%AD%EA%B0%80%EC%8A%B4%EC%82%B4', { waitUntil: 'domcontentloaded' })
    await expect(page.locator(`a[href="${TARGET_PATH}"]`).first()).toBeVisible()

    for (let index = 0; index < 3; index += 1) {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { level: 2, name: '“닭가슴살”' })).toBeVisible()
    }

    expect(failures, 'delayed/repeated search navigation must not produce page errors or 5xx responses').toEqual([])
  })
})
