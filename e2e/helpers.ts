import type { Page } from '@playwright/test'

/** Opens the playground with the column filter row off unless asked. */
export async function openPlayground(page: Page, { filters = false } = {}) {
  await page.goto('/')
  await page.locator('.tably-table').waitFor()
  if (!filters) await page.getByLabel('Column filters').uncheck()
}

/** A playground select by its position in the controls row. */
export const control = (page: Page, label: 'Size' | 'Rows' | 'Theme' | 'Density') =>
  page.locator('main > p').first().locator('label', { hasText: label }).locator('select')

export const tbodyRows = (page: Page) => page.locator('tbody tr.tably-tr')
