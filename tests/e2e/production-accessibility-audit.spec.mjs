import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PAGES = [
  ['home', '/'],
  ['categories', '/categories'],
  ['search', '/search?q=%EB%8B%AD%EA%B0%80%EC%8A%B4%EC%82%B4'],
  ['ranking', '/rankings/best-chicken-breast'],
  ['item', '/items/heo_steam'],
  ['login', '/login'],
]

for (const [name, path] of PAGES) {
  test(`${name} has no serious or critical automated accessibility violations`, async ({ page }, testInfo) => {
    const response = await page.goto(path, { waitUntil: 'networkidle' })
    expect(response?.status()).toBeLessThan(400)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    await testInfo.attach(`${name}-axe-results`, {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    })

    const blocking = results.violations.filter((violation) =>
      violation.impact === 'serious' || violation.impact === 'critical'
    )

    expect(
      blocking,
      blocking.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`).join('\n')
    ).toEqual([])
  })
}
