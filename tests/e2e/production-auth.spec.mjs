import { expect, test } from '@playwright/test'

const EMAIL = process.env.E2E_USER_EMAIL || ''
const PASSWORD = process.env.E2E_USER_PASSWORD || ''

async function expectHealthyAuthenticatedPage(page, path) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  expect(response, `missing navigation response for ${path}`).not.toBeNull()
  expect(response.status(), `${path} returned ${response.status()}`).toBeLessThan(400)
  expect(new URL(page.url()).pathname, `${path} unexpectedly redirected`).toBe(path)
  await expect(page.locator('body')).not.toContainText('This page could not be found.')
  await expect(page.locator('body')).not.toContainText('Application error')
}

function sanitizeLoginError(message) {
  const trimmed = message.trim().replace(/\s+/g, ' ')
  return EMAIL ? trimmed.replaceAll(EMAIL, '[redacted-email]') : trimmed
}

async function waitForLoginOutcome(page) {
  const loginError = page.locator('section[aria-labelledby="account-title"] [role="alert"]').first()

  try {
    return await Promise.any([
      page.waitForURL((candidate) => candidate.pathname === '/me/bookmarks', { timeout: 15_000 })
        .then(() => ({ kind: 'success' })),
      loginError.waitFor({ state: 'visible', timeout: 15_000 })
        .then(async () => ({ kind: 'error', message: sanitizeLoginError(await loginError.innerText()) })),
    ])
  } catch {
    return { kind: 'unknown', message: `login produced neither a protected-route session nor a visible error; final path=${new URL(page.url()).pathname}` }
  }
}

test.describe('production authenticated smoke', () => {
  test('ordinary user session, protected surfaces, admin denial, and logout are healthy', async ({ page }) => {
    expect(EMAIL, 'E2E_USER_EMAIL must be configured').not.toBe('')
    expect(PASSWORD, 'E2E_USER_PASSWORD must be configured').not.toBe('')

    await page.goto('/me/bookmarks', { waitUntil: 'domcontentloaded' })
    let url = new URL(page.url())
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('next')).toBe('/me/bookmarks')

    await page.getByLabel('이메일').fill(EMAIL)
    await page.getByLabel('비밀번호').fill(PASSWORD)
    await page.getByRole('button', { name: '로그인', exact: true }).click()

    const loginOutcome = await waitForLoginOutcome(page)
    if (loginOutcome.kind !== 'success') {
      throw new Error(`Production login failed: ${loginOutcome.message || loginOutcome.kind}`)
    }

    await expect(page.getByRole('heading', { level: 1, name: '내 북마크' })).toBeVisible()
    await expect(page.locator('header')).toContainText(EMAIL)

    await page.reload({ waitUntil: 'domcontentloaded' })
    expect(new URL(page.url()).pathname).toBe('/me/bookmarks')
    await expect(page.getByRole('heading', { level: 1, name: '내 북마크' })).toBeVisible()
    await expect(page.locator('header')).toContainText(EMAIL)

    await expectHealthyAuthenticatedPage(page, '/me/notifications')
    await expectHealthyAuthenticatedPage(page, '/me/sanctions')

    const adminResponse = await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    expect(adminResponse).not.toBeNull()
    url = new URL(page.url())
    expect(url.pathname, 'ordinary E2E user must not enter the admin console').toBe('/')
    expect(url.searchParams.get('error')).toBe('not_authorized')

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const accountMenu = page.locator('header details').filter({ hasText: EMAIL }).first()
    await expect(accountMenu.locator('summary')).toBeVisible()
    await accountMenu.locator('summary').click()
    await accountMenu.getByRole('button', { name: '로그아웃', exact: true }).click()

    await expect(page.locator('header').getByRole('link', { name: '로그인' })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('header')).not.toContainText(EMAIL)

    await page.goto('/me/bookmarks', { waitUntil: 'domcontentloaded' })
    url = new URL(page.url())
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('next')).toBe('/me/bookmarks')
  })
})
