import { expect, test } from '@playwright/test'

const EMAIL = process.env.E2E_USER_EMAIL || ''
const PASSWORD = process.env.E2E_USER_PASSWORD || ''
const TARGET_PATH = '/rankings/best-chicken-breast'
const COMMENT_PREFIX = 'E2E 자동화 확인 댓글'

function parseCount(text) {
  const value = Number((text || '').replace(/[^0-9]/g, ''))
  return Number.isFinite(value) ? value : 0
}

async function login(page, { verifyLocalizedFailure = false } = {}) {
  await page.goto('/login?next=%2Fme%2Fbookmarks', { waitUntil: 'domcontentloaded' })

  await page.getByLabel('이메일').fill(EMAIL)
  await page.getByLabel('비밀번호').fill(verifyLocalizedFailure ? `${PASSWORD}__wrong__` : PASSWORD)
  await page.getByRole('button', { name: '로그인', exact: true }).click()

  if (verifyLocalizedFailure) {
    const alert = page.getByRole('alert').first()
    await expect(alert).toContainText('이메일 또는 비밀번호가 올바르지 않습니다.')
    await expect(alert).not.toContainText('Invalid login credentials')

    await page.getByLabel('비밀번호').fill(PASSWORD)
    await page.getByRole('button', { name: '로그인', exact: true }).click()
  }

  await page.waitForURL((url) => url.pathname === '/me/bookmarks', { timeout: 20_000 })
  await expect(page.getByRole('heading', { level: 1, name: '내 북마크' })).toBeVisible()
}

async function getLikeButton(page) {
  const button = page.getByRole('button', { name: /좋아요 (추가|취소)$/ }).first()
  await expect(button).toBeVisible()
  return button
}

async function getBookmarkButton(page) {
  const button = page.getByRole('button', { name: /북마크 (추가|취소)$/ }).first()
  await expect(button).toBeVisible()
  return button
}

async function ensureLikeState(page, desired) {
  const button = await getLikeButton(page)
  const current = (await button.getAttribute('aria-pressed')) === 'true'
  if (current !== desired) {
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', desired ? 'true' : 'false')
  }
  return button
}

async function ensureBookmarkState(page, desired) {
  const button = await getBookmarkButton(page)
  const current = (await button.getAttribute('aria-pressed')) === 'true'
  if (current !== desired) {
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', desired ? 'true' : 'false')
  }
  return button
}

async function readViewCount(page) {
  const count = page.locator('div[title="일일 중복을 제거한 누적 조회수"] span').first()
  await expect(count).toBeVisible()
  return parseCount(await count.innerText())
}

async function deleteCommentIfVisible(page, text) {
  const article = page.locator('article').filter({ hasText: text }).first()
  if (await article.count() === 0 || !(await article.isVisible().catch(() => false))) return

  const deleteButton = article.getByRole('button', { name: '삭제', exact: true })
  if (!(await deleteButton.isVisible().catch(() => false))) return

  page.once('dialog', (dialog) => void dialog.accept())
  await deleteButton.click()
  await expect(page.getByText(text, { exact: true })).toHaveCount(0)
}

async function bestEffortCleanup(page, commentTexts) {
  try {
    await page.goto(TARGET_PATH, { waitUntil: 'domcontentloaded' })

    if (await page.locator('header').getByRole('link', { name: '로그인' }).isVisible().catch(() => false)) {
      await login(page)
      await page.goto(TARGET_PATH, { waitUntil: 'domcontentloaded' })
    }

    await ensureLikeState(page, false).catch(() => {})
    await ensureBookmarkState(page, false).catch(() => {})

    for (const text of commentTexts) {
      await deleteCommentIfVisible(page, text).catch(() => {})
    }
  } catch {
    // Cleanup is best-effort; the primary assertion failure remains authoritative.
  }
}

test.describe('production authenticated QA', () => {
  test('auth, engagement, comments, view dedupe, access control, and cleanup', async ({ page }) => {
    expect(EMAIL, 'E2E_USER_EMAIL must be configured').not.toBe('')
    expect(PASSWORD, 'E2E_USER_PASSWORD must be configured').not.toBe('')

    const runId = Date.now().toString(36)
    const createdComment = `${COMMENT_PREFIX} ${runId}`
    const editedComment = `${createdComment} 수정됨`

    await page.goto('/me/bookmarks', { waitUntil: 'domcontentloaded' })
    let url = new URL(page.url())
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('next')).toBe('/me/bookmarks')

    await login(page, { verifyLocalizedFailure: true })
    await expect(page.locator('header')).toContainText(EMAIL)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1, name: '내 북마크' })).toBeVisible()
    await expect(page.locator('header')).toContainText(EMAIL)

    try {
      await page.goto(TARGET_PATH, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { level: 1 })).toContainText('2026 닭가슴살 TOP 10')

      await page.waitForTimeout(1_500)
      const viewCountAfterFirstHydration = await readViewCount(page)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1_500)
      const viewCountAfterReload = await readViewCount(page)
      expect(viewCountAfterReload, 'same browser identity must not add a second daily view').toBe(viewCountAfterFirstHydration)

      const resetLike = await ensureLikeState(page, false)
      const likeCountBefore = parseCount(await resetLike.innerText())
      await resetLike.click()
      await expect(resetLike).toHaveAttribute('aria-pressed', 'true')
      await expect.poll(async () => parseCount(await resetLike.innerText())).toBe(likeCountBefore + 1)

      await page.reload({ waitUntil: 'domcontentloaded' })
      const persistedLike = await getLikeButton(page)
      await expect(persistedLike).toHaveAttribute('aria-pressed', 'true')
      expect(parseCount(await persistedLike.innerText())).toBe(likeCountBefore + 1)
      await persistedLike.click()
      await expect(persistedLike).toHaveAttribute('aria-pressed', 'false')
      await expect.poll(async () => parseCount(await persistedLike.innerText())).toBe(likeCountBefore)

      const bookmarkButton = await ensureBookmarkState(page, false)
      await bookmarkButton.click()
      await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'true')
      await expect(bookmarkButton).toContainText('저장됨')

      await page.goto('/me/bookmarks', { waitUntil: 'domcontentloaded' })
      const savedCard = page.locator(`article:has(a[href="${TARGET_PATH}"])`).first()
      await expect(savedCard).toBeVisible()
      await savedCard.getByRole('button', { name: /북마크 제거$/ }).click()
      await expect(page.locator(`article:has(a[href="${TARGET_PATH}"])`)).toHaveCount(0)

      await page.goto(TARGET_PATH, { waitUntil: 'domcontentloaded' })
      await expect(await getBookmarkButton(page)).toHaveAttribute('aria-pressed', 'false')

      const commentBox = page.getByPlaceholder('이 콘텐츠에 대한 의견을 남겨 주세요. 일반 텍스트만 지원합니다.')
      await expect(commentBox).toBeVisible()
      await commentBox.fill(createdComment)
      await page.getByRole('button', { name: '댓글 등록', exact: true }).click()
      await expect(page.getByText(createdComment, { exact: true })).toBeVisible()
      await expect(page.locator('body')).not.toContainText('댓글 신고 상태를 불러오지 못했습니다.')

      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.getByText(createdComment, { exact: true })).toBeVisible()
      await expect(page.locator('body')).not.toContainText('댓글 신고 상태를 불러오지 못했습니다.')

      let commentArticle = page.locator('article').filter({ hasText: createdComment }).first()
      await commentArticle.getByRole('button', { name: '수정', exact: true }).click()
      await commentArticle.locator('textarea').fill(editedComment)
      await commentArticle.getByRole('button', { name: '수정 저장', exact: true }).click()
      await expect(page.getByText(editedComment, { exact: true })).toBeVisible()

      commentArticle = page.locator('article').filter({ hasText: editedComment }).first()
      page.once('dialog', (dialog) => void dialog.accept())
      await commentArticle.getByRole('button', { name: '삭제', exact: true }).click()
      await expect(page.getByText(editedComment, { exact: true })).toHaveCount(0)
      await expect(page.locator('body')).not.toContainText('댓글 신고 상태를 불러오지 못했습니다.')

      const notifications = await page.goto('/me/notifications', { waitUntil: 'domcontentloaded' })
      expect(notifications?.status()).toBeLessThan(400)
      expect(new URL(page.url()).pathname).toBe('/me/notifications')

      const sanctions = await page.goto('/me/sanctions', { waitUntil: 'domcontentloaded' })
      expect(sanctions?.status()).toBeLessThan(400)
      expect(new URL(page.url()).pathname).toBe('/me/sanctions')

      const adminResponse = await page.goto('/admin', { waitUntil: 'domcontentloaded' })
      expect(adminResponse).not.toBeNull()
      url = new URL(page.url())
      expect(url.pathname, 'ordinary E2E user must not enter the admin console').toBe('/')
      expect(url.searchParams.get('error')).toBe('not_authorized')
    } finally {
      await bestEffortCleanup(page, [createdComment, editedComment])
    }

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const accountMenu = page.locator('header details').filter({ hasText: EMAIL }).first()
    await expect(accountMenu.locator('summary')).toBeVisible()
    await accountMenu.locator('summary').click()
    await accountMenu.getByRole('button', { name: '로그아웃', exact: true }).click()

    await expect(page.locator('header').getByRole('link', { name: '로그인' })).toBeVisible({ timeout: 15_000 })
    await page.goto('/me/bookmarks', { waitUntil: 'domcontentloaded' })
    url = new URL(page.url())
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('next')).toBe('/me/bookmarks')
  })
})
