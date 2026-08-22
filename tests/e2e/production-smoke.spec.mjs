import { expect, test } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'https://ranking-rho-three.vercel.app'
const CATEGORY_PATH = '/categories/technology'
const TARGET_PATH = '/rankings/top500-supercomputer-hpl-rmax-2026-06-top-5'
const ITEM_PATH = '/items/lineshine'

function monitorServerFailures(page) {
  const failures = []

  page.on('pageerror', (error) => {
    failures.push(`pageerror: ${error.message}`)
  })

  page.on('response', (response) => {
    if (response.status() >= 500) {
      failures.push(`${response.status()} ${response.url()}`)
    }
  })

  return failures
}

async function expectHealthyPage(page, path) {
  const failures = monitorServerFailures(page)
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })

  expect(response, `missing navigation response for ${path}`).not.toBeNull()
  expect(response.status(), `${path} returned ${response.status()}`).toBeLessThan(400)
  await expect(page.locator('body')).not.toContainText('This page could not be found.')
  await expect(page.locator('body')).not.toContainText('Application error')
  expect(failures, `runtime failures on ${path}`).toEqual([])
}

async function readHorizontalOverflowDiagnostics(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    const round = (value) => Math.round(value * 10) / 10

    return [...document.querySelectorAll('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect()
        const className = typeof element.className === 'string' ? element.className : ''
        const text = (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90)
        const escapedBy = Math.max(0, -rect.left, rect.right - viewportWidth)

        return {
          tag: element.tagName.toLowerCase(),
          className: className.slice(0, 180),
          text,
          left: round(rect.left),
          right: round(rect.right),
          width: round(rect.width),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          escapedBy: round(escapedBy),
        }
      })
      .filter((item) => item.escapedBy > 2)
      .sort((a, b) => b.escapedBy - a.escapedBy)
      .slice(0, 16)
  })
}

test.describe('production public smoke', () => {
  test('core public entry points render without 4xx/5xx', async ({ page }) => {
    for (const path of [
      '/',
      '/categories',
      CATEGORY_PATH,
      '/categories/technology/supercomputers',
      '/search',
      TARGET_PATH,
      ITEM_PATH,
      '/login',
    ]) {
      await expectHealthyPage(page, path)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    }
  })

  test('category directory uses slug links and click-through is healthy', async ({ page }) => {
    await expectHealthyPage(page, '/categories')

    const categoryLink = page.locator('main a[href^="/categories/"]').filter({ has: page.locator('h2') }).first()
    await expect(categoryLink).toBeVisible()

    const href = await categoryLink.getAttribute('href')
    expect(href).toBeTruthy()
    expect(href, 'category cards must use one slug segment').toMatch(/^\/categories\/[^/?#]+$/)
    expect(href, 'category cards must not navigate by numeric database id').not.toMatch(/^\/categories\/\d+$/)

    await categoryLink.click()
    await page.waitForURL((url) => url.pathname === href, { timeout: 10_000 })

    expect(new URL(page.url()).pathname).toBe(href)
    await expect(page.locator('body')).not.toContainText('This page could not be found.')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

    const direct = await page.request.get(new URL(href, BASE_URL).toString(), { maxRedirects: 0 })
    expect(direct.status(), `${href} must not be a broken category link`).toBeLessThan(400)
  })

  test('search form performs a real navigation with query state', async ({ page }) => {
    await expectHealthyPage(page, '/search')

    const searchbox = page.getByRole('searchbox').first()
    await searchbox.fill('슈퍼컴퓨터')
    await page.getByRole('button', { name: '검색' }).first().click()
    await page.waitForLoadState('domcontentloaded')

    const url = new URL(page.url())
    expect(url.pathname).toBe('/search')
    expect(url.searchParams.get('q')).toBe('슈퍼컴퓨터')
    await expect(page.locator('body')).not.toContainText('This page could not be found.')
  })

  test('rendered internal GET links from key public pages do not resolve to 404', async ({ page }) => {
    const entryPaths = [
      '/',
      '/categories',
      CATEGORY_PATH,
      TARGET_PATH,
      ITEM_PATH,
    ]
    const internal = new Set()

    for (const path of entryPaths) {
      await expectHealthyPage(page, path)
      const hrefs = await page.locator('a[href]').evaluateAll((anchors) =>
        anchors
          .map((anchor) => anchor.getAttribute('href'))
          .filter((href) => Boolean(href && href.startsWith('/') && !href.startsWith('/_next/')))
      )
      hrefs.forEach((href) => internal.add(href))
    }

    const links = [...internal].slice(0, 50)
    expect(links.length).toBeGreaterThan(0)

    for (const href of links) {
      const target = new URL(href, BASE_URL)
      const response = await page.request.get(target.toString(), { maxRedirects: 0 })
      expect(response.status(), `broken internal link: ${href}`).toBeLessThan(400)
    }
  })

  test('SEO endpoints and current canonical metadata are production-safe', async ({ page, request }) => {
    const robots = await request.get(`${BASE_URL}/robots.txt`)
    expect(robots.status()).toBe(200)
    expect(await robots.text()).toContain('User-Agent')

    const sitemap = await request.get(`${BASE_URL}/sitemap.xml`)
    expect(sitemap.status()).toBe(200)
    const sitemapText = await sitemap.text()
    expect(sitemapText).toContain('https://ranking-rho-three.vercel.app/')
    expect(sitemapText).toContain(ITEM_PATH)
    expect(sitemapText).toContain(TARGET_PATH)

    await expectHealthyPage(page, ITEM_PATH)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index,\s*follow/i)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${ITEM_PATH}$`))

    await expectHealthyPage(page, TARGET_PATH)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index,\s*follow/i)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${TARGET_PATH}$`))

    await expectHealthyPage(page, '/login')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i)
    await expect(page.locator('body')).not.toContainText('ADMIN_BOOTSTRAP_EMAIL')
    await expect(page.locator('body')).not.toContainText('랭킹위키 MVP')
  })

  test('mobile public pages have no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    for (const path of [
      '/',
      '/categories',
      CATEGORY_PATH,
      '/search?q=%EC%8A%88%ED%8D%BC%EC%BB%B4%ED%93%A8%ED%84%B0',
      TARGET_PATH,
      ITEM_PATH,
      '/login',
    ]) {
      await expectHealthyPage(page, path)
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      const diagnostics = dimensions.scrollWidth > dimensions.clientWidth + 2
        ? await readHorizontalOverflowDiagnostics(page)
        : []
      expect(
        dimensions.scrollWidth,
        `horizontal overflow on ${path}; offenders=${JSON.stringify(diagnostics)}`
      ).toBeLessThanOrEqual(dimensions.clientWidth + 2)
    }
  })
})
