import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { control, openPlayground } from './helpers'

type Violations = Awaited<ReturnType<ReturnType<typeof scan>['analyze']>>['violations']

/** Rule, help and the offending elements, so failures say what to fix. */
const summarize = (violations: Violations) =>
  violations.map(
    (v) =>
      `${v.id}: ${v.help} → ${v.nodes
        .slice(0, 5)
        .map((node) => `${node.target.join(' ')} (${node.any[0]?.message ?? node.failureSummary ?? ''})`)
        .join('; ')}`
  )

// @axe-core/playwright is typed against its own copy of Playwright's Page type.
const scan = (page: Page) =>
  new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'] })
    .include('.tably-container')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])

test.describe('accessibility (axe)', () => {
  test('default table with filters, selection and pagination', async ({ page }) => {
    await openPlayground(page, { filters: true })
    const { violations } = await scan(page).analyze()
    expect(summarize(violations)).toEqual([])
  })

  test('dark theme', async ({ page }) => {
    await openPlayground(page, { filters: true })
    await control(page, 'Theme').selectOption('dark')
    const { violations } = await scan(page).analyze()
    expect(summarize(violations)).toEqual([])
  })

  test('tree rows, grouping and open menus', async ({ page }) => {
    await openPlayground(page)
    await control(page, 'Rows').selectOption('tree')
    await page.locator('tbody').getByRole('button', { name: 'Expand row' }).first().click()
    await page.getByRole('button', { name: 'Columns' }).click()
    const { violations } = await scan(page).analyze()
    expect(summarize(violations)).toEqual([])
  })

  test('detects violations (sanity check of the scan)', async ({ page }) => {
    await openPlayground(page)
    await page.locator('tbody td').first().evaluate((cell) => {
      cell.insertAdjacentHTML('beforeend', '<img src="x.png"><button></button>')
    })
    const { violations, passes } = await scan(page).analyze()
    expect(passes.length).toBeGreaterThan(20)
    expect(violations.map((v) => v.id).sort()).toEqual(['button-name', 'image-alt'])
  })

  test('virtualized rows', async ({ page }) => {
    await openPlayground(page)
    await control(page, 'Size').selectOption('10000')
    await page.locator('tbody tr[data-index="0"]').waitFor()
    const { violations } = await scan(page).analyze()
    expect(summarize(violations)).toEqual([])
  })
})
