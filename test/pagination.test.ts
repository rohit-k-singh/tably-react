import { describe, expect, it, vi } from 'vitest'
import { getDefaultPaginationState, type ColumnDef, type PaginationState, type TableOptions } from '../src'
import { createTestTable } from './fixtures'

interface Item {
  id: number
  group: string
}

const items: Item[] = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, group: i % 2 ? 'odd' : 'even' }))
const columns: ColumnDef<Item>[] = [{ accessorKey: 'id' }, { accessorKey: 'group' }]

function setup(options: Partial<TableOptions<Item>> = {}) {
  return createTestTable<Item>({ data: items, columns, enablePagination: true, ...options })
}

const ids = (table: ReturnType<typeof setup>) => table.getRowModel().rows.map((row) => row.original.id)

describe('pagination', () => {
  it('shows every row unless enabled', () => {
    expect(ids(setup({ enablePagination: false }))).toHaveLength(25)
  })

  it('shows the first page of 10 rows by default', () => {
    const table = setup()
    expect(getDefaultPaginationState()).toEqual({ pageIndex: 0, pageSize: 10 })
    expect(ids(table)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(table.getPageCount()).toBe(3)
    expect(table.getRowCount()).toBe(25)
  })

  it('navigates between pages', () => {
    const table = setup()
    expect(table.getCanPreviousPage()).toBe(false)
    expect(table.getCanNextPage()).toBe(true)

    table.nextPage()
    expect(ids(table)[0]).toBe(11)
    table.lastPage()
    expect(ids(table)).toEqual([21, 22, 23, 24, 25])
    expect(table.getCanNextPage()).toBe(false)

    table.nextPage()
    expect(table.getPageIndex()).toBe(2)
    table.previousPage()
    expect(table.getPageIndex()).toBe(1)
    table.firstPage()
    expect(table.getPageIndex()).toBe(0)
    table.previousPage()
    expect(table.getPageIndex()).toBe(0)
  })

  it('clamps page indexes to the available pages', () => {
    const table = setup()
    table.setPageIndex(99)
    expect(table.getState().pagination.pageIndex).toBe(2)
    table.setPageIndex(-3)
    expect(table.getState().pagination.pageIndex).toBe(0)
  })

  it('shows the last available page when the data shrinks', () => {
    const table = setup({ initialState: { pagination: { pageIndex: 2, pageSize: 10 } } })
    table.setOptions({ ...table.options, data: items.slice(0, 15) })

    expect(table.getPageIndex()).toBe(1)
    expect(ids(table)).toEqual([11, 12, 13, 14, 15])
    expect(table.getCanNextPage()).toBe(false)
  })

  it('keeps the first visible row when the page size changes', () => {
    const table = setup({ initialState: { pagination: { pageIndex: 2, pageSize: 10 } } })
    table.setPageSize(5)
    expect(table.getState().pagination).toEqual({ pageIndex: 4, pageSize: 5 })
    expect(ids(table)[0]).toBe(21)

    table.setPageSize(20)
    expect(table.getState().pagination).toEqual({ pageIndex: 1, pageSize: 20 })
  })

  it('returns to the first page when sorting or filters change', () => {
    const table = setup()

    table.setPageIndex(2)
    table.setSorting([{ id: 'id', desc: true }])
    expect(table.getPageIndex()).toBe(0)
    expect(ids(table)[0]).toBe(25)

    table.setPageIndex(1)
    table.getColumn('group')!.setFilterValue('odd')
    expect(table.getPageIndex()).toBe(0)
    expect(table.getRowCount()).toBe(12)

    table.setPageIndex(1)
    table.setGlobalFilter('2')
    expect(table.getPageIndex()).toBe(0)
  })

  it('can keep the page when sorting or filters change', () => {
    const table = setup({ autoResetPageIndex: false })
    table.setPageIndex(1)
    table.setSorting([{ id: 'id', desc: true }])
    expect(table.getPageIndex()).toBe(1)
  })

  it('supports controlled state', () => {
    const onPaginationChange = vi.fn()
    const pagination: PaginationState = { pageIndex: 1, pageSize: 5 }
    const table = setup({ state: { pagination }, onPaginationChange })

    expect(ids(table)).toEqual([6, 7, 8, 9, 10])
    table.nextPage()
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 2, pageSize: 5 })
    expect(table.getState().pagination).toBe(pagination)
  })

  it('does not report a change when the page index stays the same', () => {
    const onPaginationChange = vi.fn()
    const table = setup({ onPaginationChange })
    table.setSorting([{ id: 'id', desc: true }])
    expect(onPaginationChange).not.toHaveBeenCalled()
  })

  it('resets to the initial or default pagination', () => {
    const table = setup({ initialState: { pagination: { pageIndex: 1, pageSize: 5 } } })
    table.setPagination({ pageIndex: 3, pageSize: 5 })
    table.resetPageIndex()
    expect(table.getState().pagination).toEqual({ pageIndex: 1, pageSize: 5 })
    table.resetPagination(true)
    expect(table.getState().pagination).toEqual({ pageIndex: 0, pageSize: 10 })
    table.setPageIndex(2)
    table.resetPagination()
    expect(table.getState().pagination).toEqual({ pageIndex: 1, pageSize: 5 })
  })

  describe('manual pagination', () => {
    it('renders data as the current page and derives the page count from rowCount', () => {
      const table = setup({
        data: items.slice(0, 10),
        manualPagination: true,
        rowCount: 95,
        initialState: { pagination: { pageIndex: 3, pageSize: 10 } }
      })
      expect(ids(table)).toHaveLength(10)
      expect(table.getPageCount()).toBe(10)
      expect(table.getRowCount()).toBe(95)
      expect(table.getPageIndex()).toBe(3)
    })

    it('uses pageCount when given', () => {
      const table = setup({ manualPagination: true, pageCount: 4 })
      expect(table.getPageCount()).toBe(4)
      expect(table.getRowCount()).toBe(-1)
      table.setPageIndex(10)
      expect(table.getState().pagination.pageIndex).toBe(3)
    })

    it('allows moving forward when the total is unknown', () => {
      const table = setup({ manualPagination: true })
      expect(table.getPageCount()).toBe(-1)
      expect(table.getCanNextPage()).toBe(true)
      table.setPageIndex(41)
      expect(table.getPageIndex()).toBe(41)
    })
  })
})
