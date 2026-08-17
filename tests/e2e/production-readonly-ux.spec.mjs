import { expect, test } from '@playwright/test'

const TARGET_PATH = '/rankings/best-chicken-breast'
const TARGET_TITLE = '2026 닭가슴살 TOP 10'
const ITEM_PATH = '/items/heo_steam'
const NO_RESULT_QUERY = 'noresult7f3c2rankingwiki'
const FAKE_FACET_ID = '00000000-0000-4000-8000-000000000001'

function monitorRuntimeFailures(page) {
  const failures = []
  const onPageError = (error) => failures.push(`pageerror: ${error.message}`)
  const onResponse = (response) => {
    if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`)
  }

  page.on('pageerror', onPageError)
  page.on('response', onResponse)

  return {
    failures,
    stop() {
      page.off('pageerror', onPageError)
      page.off('response', onResponse)
    },
  }
}

async function expectHealthyNavigation(page, path) {
  // Let the previous document and any in-flight Next.js prefetches die before
  // attributing runtime failures to the destination page. Firefox/WebKit can
  // surface an aborted old-document fetch as a pageerror during navigation.
  await page.goto('about:blank', { waitUntil: 'load' })
  const monitor = monitorRuntimeFailures(page)

  try {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
    expect(response, `missing navigation response for ${path}`).not.toBeNull()
    expect(response.status(), `${path} returned ${response.status()}`).toBeLessThan(400)
    await expect(page.locator('body')).not.toContainText('This page could not be found.')
    await expect(page.locator('body')).not.toContainText('Application error')
    await page.waitForTimeout(600)
    expect(monitor.failures, `runtime failures on ${path}`).toEqual([])
  } finally {
    monitor.stop()
  }
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
  test('search finds the published ranking and browser history restores canonical sort state', async ({ page }) => {
    await expectHealthyNavigation(page, '/search?q=%EB%8B%AD%EA%B0%80%EC%8A%B4%EC%82%B4&type=ranking&sort=relevance')

    const mainSearch = page.locator('main').getByRole('search')
    await expect(page.getByRole('heading', { level: 2, name: '“닭가슴살”', exact: true })).toBeVisible()
    const rankingResult = page.locator(`a[href="${TARGET_PATH}"]`).filter({ hasText: TARGET_TITLE }).first()
    await expect(rankingResult).toBeVisible()
    await expect(mainSearch.getByLabel('검색 대상')).toHaveValue('ranking')
    await expect(mainSearch.getByLabel('검색 정렬')).toHaveValue('relevance')

    await mainSearch.getByLabel('검색 정렬').selectOption('popular')
    await mainSearch.getByRole('button', { name: '검색', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/search' && url.searchParams.get('sort') === 'popular')
    await expect(page.locator(`a[href="${TARGET_PATH}"]`).filter({ hasText: TARGET_TITLE }).first()).toBeVisible()

    await page.goBack({ waitUntil: 'domcontentloaded' })
    expect(new URL(page.url()).searchParams.get('sort')).toBe('relevance')
    await expect(page.locator('main').getByRole('search').getByLabel('검색 정렬')).toHaveValue('relevance')

    const restoredSearch = page.locator('main').getByRole('search')
    const searchbox = restoredSearch.getByRole('searchbox', { name: '랭킹위키 검색' })
    await searchbox.fill('닭가슴살')
    await searchbox.press('Enter')
    await page.waitForURL((url) => url.pathname === '/search' && url.searchParams.get('q') === '닭가슴살')
    await expect(page.locator(`a[href="${TARGET_PATH}"]`).filter({ hasText: TARGET_TITLE }).first()).toBeVisible()
  })

  test('item search deterministically finds the clean published item', async ({ page }) => {
    await expectHealthyNavigation(page, '/search?q=%ED%97%88%EB%8B%AD&type=item&sort=relevance')
    const itemResult = page.locator(`a[href="${ITEM_PATH}"]`).filter({ hasText: '허닭 스팀' }).first()
    await expect(itemResult).toBeVisible()
    await itemResult.click()
    await page.waitForURL((url) => url.pathname === ITEM_PATH)
    await expect(page.getByRole('heading', { level: 1, name: '허닭 스팀', exact: true })).toBeVisible()
  })

  test('empty search, invalid cursor, and unavailable facet state fail soft', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'deep query-state resilience runs once on Chromium')

    await expectHealthyNavigation(page, `/search?q=${NO_RESULT_QUERY}`)
    await expect(page.getByRole('heading', { level: 3, name: '검색 결과가 없습니다', exact: true })).toBeVisible()
    const categoryEscape = page.getByRole('link', { name: '카테고리 탐색', exact: true })
    await expect(categoryEscape).toHaveAttribute('href', '/categories')

    await expectHealthyNavigation(page, '/search?q=%EB%8B%AD%EA%B0%80%EC%8A%B4%EC%82%B4&cursor=not-a-valid-cursor')
    await expect(page.getByText('페이지 위치를 초기화했습니다.', { exact: true })).toBeVisible()
    await expect(page.locator(`a[href="${TARGET_PATH}"]`).first()).toBeVisible()

    await expectHealthyNavigation(page, `/search?q=%EB%8B%AD%EA%B0%80%EC%8A%B4%EC%82%B4&facet=${FAKE_FACET_ID}`)
    await expect(page.getByText('현재 검색 대상에 맞지 않는 Facet 필터를 제거했습니다.', { exact: true })).toBeVisible()
    await expect(page.locator(`a[href="${TARGET_PATH}"]`).first()).toBeVisible()
  })

  test('category browse sort, history, and invalid cursor remain coherent', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'category query-state resilience runs once on Chromium')

    await expectHealthyNavigation(page, '/categories/foods?sort=latest')
    await expect(page.getByRole('heading', { level: 1, name: '건강식품 랭킹', exact: true })).toBeVisible()
    await page.getByRole('link', { name: /인기순/ }).click()
    await page.waitForURL((url) => url.pathname === '/categories/foods' && url.searchParams.get('sort') === 'popular')
    await expect(page.locator(`a[href="${TARGET_PATH}"]`).first()).toBeVisible()

    await page.goBack({ waitUntil: 'domcontentloaded' })
    expect(new URL(page.url()).searchParams.get('sort')).toBe('latest')
    await expect(page.getByRole('link', { name: '최신순', exact: true })).toHaveClass(/bg-\[#eef2ff\]/)

    await expectHealthyNavigation(page, '/categories/foods?sort=latest&cursor=not-a-valid-cursor')
    await expect(page.getByText('유효하지 않은 페이지 위치를 초기화했습니다.', { exact: true })).toBeVisible()
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
    const commentLogin = page.getByRole('button', { name: '로그인하고 댓글 작성하기', exact: true })
    await expect(commentLogin).toBeVisible()
    await commentLogin.click()
    await page.waitForURL((url) => url.pathname === '/login')
    expectLoginReturnPath(page, TARGET_PATH)
  })

  test('published ranking exposes document anatomy and supports item traversal and back navigation', async ({ page }) => {
    await expectHealthyNavigation(page, TARGET_PATH)
    await expect(page.getByRole('heading', { level: 1, name: TARGET_TITLE, exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: '순위', exact: true })).toBeVisible()
    await expect(page.getByText(/총 \d+개 항목/)).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: '이 순위가 만들어진 기준', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: '평가 기준', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: '출처', exact: true })).toBeVisible()

    const itemHrefs = await page.locator('a[href^="/items/"]').evaluateAll((anchors) =>
      [...new Set(anchors.map((anchor) => anchor.getAttribute('href')).filter(Boolean))]
    )
    expect(itemHrefs.length, 'published ranking must expose at least one item detail path').toBeGreaterThan(0)

    const firstItemPath = itemHrefs[0]
    await page.locator(`a[href="${firstItemPath}"]`).first().click()
    await page.waitForURL((url) => url.pathname === firstItemPath)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

    await page.goBack({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1, name: TARGET_TITLE, exact: true })).toBeVisible()
  })

  test('account entry surface exposes signup fields without mutating production auth', async ({ page }) => {
    await expectHealthyNavigation(page, '/login')
    await page.getByRole('button', { name: '회원가입', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: '회원가입', exact: true })).toBeVisible()
    await expect(page.getByLabel('이름 또는 닉네임')).toBeVisible()
    await expect(page.getByLabel('이메일')).toHaveAttribute('type', 'email')
    await expect(page.getByLabel('비밀번호')).toHaveAttribute('autocomplete', 'new-password')
    await expect(page.getByRole('button', { name: '회원가입', exact: true })).toBeVisible()

    await page.getByRole('button', { name: '로그인', exact: true }).last().click()
    await expect(page.getByRole('heading', { level: 1, name: '로그인', exact: true })).toBeVisible()
  })

  test('responsive projects stay within viewport and mobile projects expose touch navigation', async ({ page }, testInfo) => {
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

      await expectHealthyNavigation(page, '/')
      await page.getByLabel('메뉴 열기').click()
      const mobileNav = page.locator('header').getByRole('link', { name: '통합 검색', exact: true })
      await expect(mobileNav).toBeVisible()
      await mobileNav.click()
      await page.waitForURL((url) => url.pathname === '/search')
      await expect(page.getByRole('heading', { level: 1, name: '통합 검색', exact: true })).toBeVisible()
    }
  })

  test('synthetic long content stress does not create horizontal overflow on mobile layouts', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile-'), 'synthetic long-content stress is mobile-focused')

    await expectHealthyNavigation(page, TARGET_PATH)
    await page.evaluate(() => {
      const heading = document.querySelector('main h1')
      if (heading) heading.textContent = '아주 긴 랭킹 제목 '.repeat(24)
      const paragraphs = [...document.querySelectorAll('main p')].slice(0, 4)
      for (const paragraph of paragraphs) paragraph.textContent = '공백이 있는 매우 긴 설명 텍스트 '.repeat(40)
    })
    await assertNoHorizontalOverflow(page, `${testInfo.project.name}:synthetic-long-content`)
  })

  test('delayed requests and repeated reloads recover without runtime or server failures', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'network stress runs once on Chromium')

    const monitor = monitorRuntimeFailures(page)
    await page.route('**/*', async (route) => {
      const type = route.request().resourceType()
      if (type === 'document' || type === 'fetch' || type === 'xhr') {
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      await route.continue()
    })

    try {
      await page.goto('/search?q=%EB%8B%AD%EA%B0%80%EC%8A%B4%EC%82%B4', { waitUntil: 'domcontentloaded' })
      await expect(page.locator(`a[href="${TARGET_PATH}"]`).first()).toBeVisible()

      for (let index = 0; index < 3; index += 1) {
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.getByRole('heading', { level: 2, name: '“닭가슴살”', exact: true })).toBeVisible()
      }

      expect(monitor.failures, 'delayed/repeated search navigation must not produce page errors or 5xx responses').toEqual([])
    } finally {
      monitor.stop()
    }
  })
})
