import { describe, expect, it, vi } from 'vitest'
import type { ColumnDef, TableOptions } from '../src'
import { createTestTable, people, type Person } from './fixtures'

const columns: ColumnDef<Person>[] = [
  { accessorKey: 'id', width: 60 },
  { header: 'Person', columns: [{ accessorKey: 'name', width: '20%' }, { accessorKey: 'age', minWidth: 80, maxWidth: 200 }] },
  { accessorKey: 'address.city', enablePinning: false, enableResizing: false },
  { id: 'actions', width: 90 }
]

function setup(options: Partial<TableOptions<Person>> = {}) {
  return createTestTable<Person>({ data: people, columns, enableColumnResizing: true, ...options })
}

const ids = (columns: { id: string }[]) => columns.map((column) => column.id)

describe('column sizing', () => {
  it('uses numeric widths, then defaultColumnWidth, within the min and max', () => {
    const table = setup({ defaultColumnWidth: 120 })
    expect(table.getColumn('id')!.getSize()).toBe(60)
    expect(table.getColumn('name')!.getSize()).toBe(120)
    expect(table.getColumn('age')!.getMinSize()).toBe(80)
    expect(table.getColumn('id')!.getMinSize()).toBe(40)
    expect(table.getColumn('Person')!.getSize()).toBe(240)
    expect(table.getTotalSize()).toBe(60 + 120 + 120 + 120 + 90)
  })

  it('resizes within limits, reports changes and resets', () => {
    const onColumnSizingChange = vi.fn()
    const table = setup({ onColumnSizingChange })
    const age = table.getColumn('age')!

    age.setSize(500)
    expect(age.getSize()).toBe(200)
    age.setSize(10.6)
    expect(age.getSize()).toBe(80)
    expect(age.getIsResized()).toBe(true)
    expect(onColumnSizingChange).toHaveBeenLastCalledWith({ age: 80 })

    onColumnSizingChange.mockClear()
    age.setSize(80)
    expect(onColumnSizingChange).not.toHaveBeenCalled()

    age.resetSize()
    expect(age.getSize()).toBe(150)
    expect(age.getIsResized()).toBe(false)

    table.getColumn('id')!.setSize(100)
    table.resetColumnSizing()
    expect(table.getState().columnSizing).toEqual({})
  })

  it('only resizes leaf columns when resizing is enabled', () => {
    expect(setup().getColumn('age')!.getCanResize()).toBe(true)
    expect(setup().getColumn('address.city')!.getCanResize()).toBe(false)
    expect(setup().getColumn('Person')!.getCanResize()).toBe(false)
    expect(setup({ enableColumnResizing: false }).getColumn('age')!.getCanResize()).toBe(false)
  })

  it('excludes hidden columns from the total size', () => {
    const table = setup({ initialState: { columnVisibility: { name: false } } })
    expect(table.getColumn('Person')!.getSize()).toBe(150)
    expect(table.getTotalSize()).toBe(60 + 150 + 150 + 90)
  })
})

describe('column pinning', () => {
  it('moves pinned columns to the sides of the display order', () => {
    const table = setup()
    table.getColumn('actions')!.pin('left')
    table.getColumn('id')!.pin('right')

    expect(ids(table.getLeftLeafColumns())).toEqual(['actions'])
    expect(ids(table.getCenterLeafColumns())).toEqual(['name', 'age', 'address.city'])
    expect(ids(table.getRightLeafColumns())).toEqual(['id'])
    expect(ids(table.getVisibleLeafColumns())).toEqual(['actions', 'name', 'age', 'address.city', 'id'])
    expect(table.getIsSomeColumnsPinned()).toBe(true)
  })

  it('computes sticky offsets and the innermost pinned column', () => {
    const table = setup({ initialState: { columnPinning: { left: ['id', 'name'], right: ['age', 'actions'] } } })

    expect(table.getColumn('id')!.getPinnedOffset()).toBe(0)
    expect(table.getColumn('name')!.getPinnedOffset()).toBe(60)
    expect(table.getColumn('actions')!.getPinnedOffset()).toBe(0)
    expect(table.getColumn('age')!.getPinnedOffset()).toBe(90)
    expect(table.getColumn('address.city')!.getPinnedOffset()).toBe(0)

    expect(table.getColumn('name')!.getIsLastPinned()).toBe(true)
    expect(table.getColumn('id')!.getIsLastPinned()).toBe(false)
    expect(table.getColumn('age')!.getIsLastPinned()).toBe(true)
  })

  it('appends newly right-pinned columns at the far right', () => {
    const table = setup()
    table.getColumn('id')!.pin('right')
    table.getColumn('actions')!.pin('right')
    expect(ids(table.getRightLeafColumns())).toEqual(['id', 'actions'])
  })

  it('pins and unpins groups through their columns', () => {
    const table = setup()
    const group = table.getColumn('Person')!

    group.pin('left')
    expect(table.getState().columnPinning.left).toEqual(['name', 'age'])
    expect(group.getIsPinned()).toBe('left')

    table.getColumn('age')!.pin('right')
    expect(group.getIsPinned()).toBe(false)

    group.pin(false)
    expect(table.getState().columnPinning).toEqual({ left: [], right: [] })
  })

  it('splits group headers around pinned columns', () => {
    const table = setup({ initialState: { columnPinning: { left: ['age'], right: [] } } })
    expect(table.getHeaderGroups()[0].headers.map((header) => `${header.column.id}:${header.colSpan}`)).toEqual([
      'Person:1',
      'id:1',
      'Person:1',
      'address.city:1',
      'actions:1'
    ])
  })

  it('splits a group at the boundary between pinned and unpinned columns', () => {
    const table = setup({ initialState: { columnPinning: { left: ['name'], right: [] } } })
    expect(table.getHeaderGroups()[0].headers.map((header) => `${header.column.id}:${header.colSpan}`)).toEqual([
      'Person:1',
      'id:1',
      'Person:1',
      'address.city:1',
      'actions:1'
    ])
    expect(table.getHeaderGroups()[0].headers.map((header) => header.id)).toEqual([
      '0_Person',
      '0_id',
      '0_Person_1',
      '0_address.city',
      '0_actions'
    ])

    const unpinned = setup({ initialState: { columnOrder: ['name', 'age'] } })
    expect(unpinned.getHeaderGroups()[0].headers[0].colSpan).toBe(2)
  })

  it('respects enablePinning and reports changes', () => {
    const onColumnPinningChange = vi.fn()
    const table = setup({ onColumnPinningChange })

    expect(table.getColumn('address.city')!.getCanPin()).toBe(false)
    table.getColumn('address.city')!.pin('left')
    expect(onColumnPinningChange).not.toHaveBeenCalled()

    table.getColumn('id')!.pin('left')
    expect(onColumnPinningChange).toHaveBeenCalledWith({ left: ['id'], right: [] })
    table.resetColumnPinning()
    expect(table.getIsSomeColumnsPinned()).toBe(false)

    const disabled = setup({ enableColumnPinning: false })
    disabled.getColumn('id')!.pin('left')
    expect(disabled.getColumn('id')!.getCanPin()).toBe(false)
    expect(disabled.getIsSomeColumnsPinned()).toBe(false)
  })

  it('ignores hidden pinned columns', () => {
    const table = setup({
      initialState: { columnPinning: { left: ['id', 'name'], right: [] }, columnVisibility: { id: false } }
    })
    expect(ids(table.getLeftLeafColumns())).toEqual(['name'])
    expect(table.getColumn('name')!.getPinnedOffset()).toBe(0)
  })
})
