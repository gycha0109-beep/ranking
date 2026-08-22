import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const SAMPLE_PATHS = [
  '/',
  '/categories',
  '/categories/technology',
  '/categories/technology/supercomputers',
  '/search?q=%EC%8A%88%ED%8D%BC%EC%BB%B4%ED%93%A8%ED%84%B0',
  '/rankings/top500-supercomputer-hpl-rmax-2026-06-top-5',
  '/items/lineshine',
  '/login',
]

function summarizeViolation(path, violation) {
  return {
    path,
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    nodes: violation.nodes.map((node) => node.target),
  }
}

test.describe('production accessibility acceptance', () => {
  test('sampled public pages expose zero serious or critical automated violations', async ({ page }) => {
    const failures = []

    for (const path of SAMPLE_PATHS) {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(response, `missing navigation response for ${path}`).not.toBeNull()
      expect(response.status(), `${path} returned ${response.status()}`).toBeLessThan(400)
      await page.waitForTimeout(500)

      const results = await new AxeBuilder({ page }).analyze()
      const severe = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical'
      )

      failures.push(...severe.map((violation) => summarizeViolation(path, violation)))
    }

    expect(failures, JSON.stringify(failures, null, 2)).toEqual([])
  })
})
