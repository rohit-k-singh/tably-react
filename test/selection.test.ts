import { describe, expect, it, vi } from 'vitest'
import type { ColumnDef, TableOptions } from '../src'
import { createTestTable } from './fixtures'

interface Item {
  id: string
  group: 'a' | 'b'
  locked?: boolean
}

const items: Item[] = Array.from({ length: 12 }, (_, i) => ({
  id: `item-${i}`,
  group: i % 2 ? 'b' : 'a',
  locked: i === 3
}))
const columns: ColumnDef<Item>[] = [{ accessorKey: 'id' }, { accessorKey: 'group' }]

function setup(options: Partial<TableOptions<Item>> = {}) {
  return createTestTable<Item>({
    data: items,
    columns,
    getRowId: (item) => item.id,
    enableRowSelection: true,
    ...options
  })
}

const selectedIds = (table: ReturnType<typeof setup>) => table.getSelectedRowModel().rows.map((row) => row.id)
const row = (table: ReturnType<typeof setup>, id: string) => table.getCoreRowModel().rowsById[id]

describe('row selection', () => {
  it('selects and deselects rows', () => {
    const onRowSelectionChange = vi.fn()
    const table = setup({ onRowSelectionChange })

    row(table, 'item-2').toggleSelected()
    row(table, 'item-0').toggleSelected(true)
    expect(selectedIds(table)).toEqual(['item-0', 'item-2'])
    expect(row(table, 'item-2').getIsSelected()).toBe(true)
    expect(onRowSelectionChange).toHaveBeenLastCalledWith({ 'item-2': true, 'item-0': true })

    row(table, 'item-2').toggleSelected()
    expect(table.getState().rowSelection).toEqual({ 'item-0': true })

    onRowSelectionChange.mockClear()
    row(table, 'item-0').toggleSelected(true)
    expect(onRowSelectionChange).not.toHaveBeenCalled()
  })

  it('is off by default and can be limited per row', () => {
    const off = setup({ enableRowSelection: undefined })
    row(off, 'item-0').toggleSelected()
    expect(row(off, 'item-0').getCanSelect()).toBe(false)
    expect(selectedIds(off)).toEqual([])

    const limited = setup({ enableRowSelection: (r) => !r.original.locked })
    expect(row(limited, 'item-3').getCanSelect()).toBe(false)
    limited.toggleAllRowsSelected()
    expect(selectedIds(limited)).toHaveLength(11)
    expect(limited.getIsAllRowsSelected()).toBe(true)
  })

  it('keeps one row selected in single selection mode', () => {
    const table = setup({ enableMultiRowSelection: false })
    row(table, 'item-1').toggleSelected()
    row(table, 'item-4').toggleSelected()
    expect(selectedIds(table)).toEqual(['item-4'])
  })

  it('selects all filtered rows or all page rows', () => {
    const table = setup({ enablePagination: true, initialState: { pagination: { pageIndex: 0, pageSize: 4 } } })

    table.toggleAllPageRowsSelected()
    expect(selectedIds(table)).toEqual(['item-0', 'item-1', 'item-2', 'item-3'])
    expect(table.getIsAllPageRowsSelected()).toBe(true)
    expect(table.getIsAllRowsSelected()).toBe(false)
    expect(table.getIsSomeRowsSelected()).toBe(true)

    table.toggleAllPageRowsSelected()
    expect(table.getIsSomePageRowsSelected()).toBe(false)

    table.getColumn('group')!.setFilterValue('b')
    table.toggleAllRowsSelected()
    expect(selectedIds(table)).toEqual(['item-1', 'item-3', 'item-5', 'item-7', 'item-9', 'item-11'])
    expect(table.getFilteredSelectedRowModel().rows).toHaveLength(6)

    table.getColumn('group')!.setFilterValue(undefined)
    expect(table.getIsAllRowsSelected()).toBe(false)
    expect(table.getFilteredSelectedRowModel().rows).toHaveLength(6)
  })

  it('selects a range of rows in display order', () => {
    const table = setup({ enableRowSelection: (r) => !r.original.locked })
    table.setSorting([{ id: 'id', desc: true }])

    table.setRowRangeSelected('item-5', 'item-2', true)
    // Sorted descending: item-9, item-8, item-7, item-6, item-5, item-4, item-3 (locked), item-2, …
    expect(selectedIds(table)).toEqual(['item-2', 'item-4', 'item-5'])

    table.setRowRangeSelected('item-4', 'item-5', false)
    expect(selectedIds(table)).toEqual(['item-2'])
    table.setRowRangeSelected('missing', 'item-5', true)
    expect(selectedIds(table)).toEqual(['item-2'])
  })

  it('keeps selection across data changes and ignores removed rows', () => {
    const table = setup({ initialState: { rowSelection: { 'item-1': true, 'item-9': true } } })
    table.setOptions({ ...table.options, data: items.slice(0, 5) })
    expect(selectedIds(table)).toEqual(['item-1'])
    expect(table.getState().rowSelection).toEqual({ 'item-1': true, 'item-9': true })
  })

  it('resets and supports controlled state', () => {
    const table = setup({ initialState: { rowSelection: { 'item-0': true } } })
    table.toggleAllRowsSelected(true)
    table.resetRowSelection()
    expect(selectedIds(table)).toEqual(['item-0'])
    table.resetRowSelection(true)
    expect(selectedIds(table)).toEqual([])

    const onRowSelectionChange = vi.fn()
    const controlled = setup({ state: { rowSelection: { 'item-5': true } }, onRowSelectionChange })
    row(controlled, 'item-6').toggleSelected()
    expect(onRowSelectionChange).toHaveBeenCalledWith({ 'item-5': true, 'item-6': true })
    expect(selectedIds(controlled)).toEqual(['item-5'])
  })

  it('reports no selection for empty tables', () => {
    const table = setup({ data: [] })
    expect(table.getIsAllRowsSelected()).toBe(false)
    expect(table.getIsSomeRowsSelected()).toBe(false)
  })
})
