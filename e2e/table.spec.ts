import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { control, openPlayground, tbodyRows } from './helpers'

const firstName = (page: import('@playwright/test').Page) => tbodyRows(page).first().locator('td').nth(1)

test.describe('sorting, filtering and pagination', () => {
  test('sorts by a header and searches', async ({ page }) => {
    await openPlayground(page)
    await page.getByRole('button', { name: 'Age', exact: true }).click()
    await expect(page.getByRole('columnheader', { name: /^Age/ })).toHaveAttribute('aria-sort', 'ascending')
    await expect(tbodyRows(page).first().locator('td').nth(3)).toHaveText('22')

    await page.getByRole('searchbox', { name: 'Search' }).fill('grace')
    await expect(page.locator('.tably-page-range')).toHaveText('1–3 of 3')
  })

  test('pages through rows', async ({ page }) => {
    await openPlayground(page)
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.locator('.tably-page-status')).toHaveText('Page 2 of 3')
    await expect(page.locator('.tably-page-range')).toHaveText('11–20 of 25')
  })

  test('filters with the multi-select facet filter', async ({ page }) => {
    await openPlayground(page, { filters: true })
    await page.getByRole('button', { name: 'Filter Role' }).click()
    await page.getByRole('dialog', { name: 'Filter Role' }).getByRole('checkbox', { name: /Admin/ }).check()
    await expect(page.locator('.tably-page-range')).toHaveText('1–9 of 9')
  })
})

test.describe('columns', () => {
  test('resizes a column by dragging its handle', async ({ page }) => {
    await openPlayground(page)
    const header = page.getByRole('columnheader', { name: /^Email/ })
    const before = (await header.boundingBox())!.width
    const handle = (await page.getByRole('separator', { name: 'Resize Email' }).boundingBox())!
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(handle.x + 80, handle.y + handle.height / 2, { steps: 5 })
    await page.mouse.up()
    await expect.poll(async () => (await header.boundingBox())!.width).toBeGreaterThan(before + 60)
  })

  test('keeps pinned columns in place while scrolling horizontally', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 })
    await openPlayground(page)
    const scroll = page.locator('.tably-scroll')
    const nameCell = tbodyRows(page).first().locator('td').nth(1)
    const before = (await nameCell.boundingBox())!.x
    await scroll.evaluate((element) => {
      element.scrollLeft = 300
    })
    await expect.poll(async () => (await scroll.evaluate((element) => element.scrollLeft)) > 0).toBe(true)
    expect(Math.round((await nameCell.boundingBox())!.x)).toBe(Math.round(before))
    const scrollRight = (await scroll.boundingBox())!
    const actions = (await tbodyRows(page).first().locator('td').last().boundingBox())!
    expect(Math.abs(actions.x + actions.width - (scrollRight.x + scrollRight.width))).toBeLessThan(2)
  })

  test('pins and hides columns from the column actions menu', async ({ page }) => {
    await openPlayground(page)
    await page.getByRole('columnheader', { name: /^City/ }).hover()
    await page.getByRole('button', { name: 'City column actions' }).click()
    await page.getByRole('menuitem', { name: 'Pin to left' }).click()
    await expect(page.getByRole('columnheader', { name: /^City/ })).toHaveAttribute('data-pinned', 'left')
    await expect(page.getByRole('button', { name: 'City column actions' })).toBeFocused()

    await page.getByRole('button', { name: 'Columns' }).click()
    await page.getByRole('dialog', { name: 'Columns' }).getByRole('checkbox', { name: /Email/ }).uncheck()
    await expect(page.getByRole('columnheader', { name: /^Email/ })).toHaveCount(0)
  })
})

test.describe('rows', () => {
  test('selects a range with Shift-click', async ({ page }) => {
    await openPlayground(page)
    const boxes = page.locator('tbody').getByRole('checkbox', { name: 'Select row' })
    await boxes.nth(1).click()
    await boxes.nth(4).click({ modifiers: ['Shift'] })
    await expect(page.locator('tbody tr[aria-selected="true"]')).toHaveCount(4)
    await expect(page.getByRole('checkbox', { name: 'Select all rows' })).toHaveJSProperty('indeterminate', true)
  })

  test('expands tree rows', async ({ page }) => {
    await openPlayground(page)
    await control(page, 'Rows').selectOption('tree')
    await expect(tbodyRows(page)).toHaveCount(5)
    await page.locator('tbody').getByRole('button', { name: 'Expand row' }).first().click()
    await expect(tbodyRows(page)).toHaveCount(9)
  })

  test('virtualizes 100,000 rows and reaches the last one', async ({ page }) => {
    await openPlayground(page)
    await control(page, 'Size').selectOption('100000')
    await expect(page.locator('tbody tr[data-index="0"]')).toBeVisible()
    expect(await tbodyRows(page).count()).toBeLessThan(60)

    const scroll = page.locator('.tably-scroll')
    for (let attempt = 0; attempt < 3; attempt++) {
      await scroll.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      })
      await page.waitForTimeout(150)
    }
    const last = page.locator('tbody tr[data-index="99999"]')
    await expect(last).toBeVisible()
    const scrollBox = (await scroll.boundingBox())!
    const lastBox = (await last.boundingBox())!
    expect(Math.abs(scrollBox.y + scrollBox.height - (lastBox.y + lastBox.height))).toBeLessThan(60)
  })
})

test.describe('keyboard', () => {
  test('is a single Tab stop with arrow key navigation', async ({ page }) => {
    await openPlayground(page)
    await page.getByRole('button', { name: 'Export CSV' }).focus()
    await page.keyboard.press('Tab')
    const active = () => page.evaluate(() => (document.activeElement as HTMLElement).dataset.gridRow + ',' + (document.activeElement as HTMLElement).dataset.gridCol)
    expect(await active()).toBe('-1,0')

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    expect(await active()).toBe('1,1')
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'View' }).nth(1)).toBeFocused()
    await page.keyboard.press('Escape')
    expect(await active()).toBe('1,8')

    // Tab leaves the grid instead of visiting every button in it.
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('.tably-pagination'))).toBe(true)
  })
})

test('exports CSV with a byte order mark', async ({ page }) => {
  await openPlayground(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click()
  ])
  expect(download.suggestedFilename()).toBe('people.csv')
  const content = readFileSync((await download.path())!)
  expect([...content.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const lines = content.toString('utf8').replace(/^﻿/, '').split('\r\n')
  expect(lines[0]).toBe('Name,Email,Age,Role,Joined,Active,City')
  expect(lines).toHaveLength(26)
})
