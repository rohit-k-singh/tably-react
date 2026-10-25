import { describe, expect, it, vi } from 'vitest'
import { sortingFns, type ColumnDef, type SortingState, type TableOptions } from '../src'
import { createTestTable, people, type Person } from './fixtures'

interface Item {
  name: string
  size?: number | null
  date?: Date | string
  flag?: boolean
}

const items: Item[] = [
  { name: 'item 10', size: 3, date: new Date('2024-03-01'), flag: true },
  { name: 'Item 2', size: undefined, date: '2024-01-15', flag: false },
  { name: 'item 1', size: 1, date: new Date('2024-02-10'), flag: true },
  { name: 'apple', size: null, date: new Date('2023-12-31'), flag: false }
]

const itemColumns: ColumnDef<Item>[] = [
  { accessorKey: 'name' },
  { accessorKey: 'size' },
  { accessorKey: 'date' },
  { accessorKey: 'flag' }
]

function setup(options: Partial<TableOptions<Item>> = {}) {
  return createTestTable<Item>({ data: items, columns: itemColumns, ...options })
}

const names = (table: ReturnType<typeof setup>) => table.getRowModel().rows.map((row) => row.original.name)

describe('sorting', () => {
  it('leaves rows in data order without sorting', () => {
    expect(names(setup())).toEqual(['item 10', 'Item 2', 'item 1', 'apple'])
  })

  it('sorts strings naturally and case-insensitively by default', () => {
    const table = setup({ initialState: { sorting: [{ id: 'name', desc: false }] } })
    expect(names(table)).toEqual(['apple', 'item 1', 'Item 2', 'item 10'])
  })

  it('sorts descending', () => {
    const table = setup({ initialState: { sorting: [{ id: 'name', desc: true }] } })
    expect(names(table)).toEqual(['item 10', 'Item 2', 'item 1', 'apple'])
  })

  it('puts undefined and null last in both directions by default', () => {
    const asc = setup({ initialState: { sorting: [{ id: 'size', desc: false }] } })
    const desc = setup({ initialState: { sorting: [{ id: 'size', desc: true }] } })

    expect(names(asc)).toEqual(['item 1', 'item 10', 'Item 2', 'apple'])
    expect(names(desc)).toEqual(['item 10', 'item 1', 'Item 2', 'apple'])
  })

  it('can put missing values first', () => {
    const table = setup({
      columns: [{ accessorKey: 'name' }, { accessorKey: 'size', sortUndefined: 'first' }],
      initialState: { sorting: [{ id: 'size', desc: false }] }
    })
    expect(names(table)).toEqual(['Item 2', 'apple', 'item 1', 'item 10'])
  })

  it('detects dates, including date strings, with the datetime sorting fn', () => {
    const table = setup({
      columns: [{ accessorKey: 'name' }, { accessorKey: 'date' }],
      initialState: { sorting: [{ id: 'date', desc: false }] }
    })
    expect(table.getColumn('date')!.getSortingFn()).toBe(sortingFns.datetime)
    expect(names(table)).toEqual(['apple', 'Item 2', 'item 1', 'item 10'])
  })

  it('sorts booleans with the basic sorting fn', () => {
    const table = setup({ initialState: { sorting: [{ id: 'flag', desc: false }] } })
    expect(table.getColumn('flag')!.getSortingFn()).toBe(sortingFns.basic)
    expect(names(table)).toEqual(['Item 2', 'apple', 'item 10', 'item 1'])
  })

  it('supports named and custom sorting fns', () => {
    const byLength = vi.fn((a, b, id) => String(a.getValue(id)).length - String(b.getValue(id)).length)
    const table = setup({
      columns: [{ accessorKey: 'name', sortingFn: byLength }],
      initialState: { sorting: [{ id: 'name', desc: false }] }
    })
    expect(names(table)).toEqual(['apple', 'Item 2', 'item 1', 'item 10'])
    expect(byLength).toHaveBeenCalled()

    const caseSensitive = setup({
      columns: [{ accessorKey: 'name', sortingFn: 'textCaseSensitive' }],
      initialState: { sorting: [{ id: 'name', desc: false }] }
    })
    expect(caseSensitive.getColumn('name')!.getSortingFn()).toBe(sortingFns.textCaseSensitive)
  })

  it('inverts sorting for a column', () => {
    const table = setup({
      columns: [{ accessorKey: 'name' }, { accessorKey: 'size', invertSorting: true }],
      initialState: { sorting: [{ id: 'size', desc: false }] }
    })
    expect(names(table)).toEqual(['item 10', 'item 1', 'Item 2', 'apple'])
  })

  it('sorts by several columns in priority order', () => {
    const table = createTestTable<Person>({
      data: [...people, { ...people[0], id: 4, name: 'Bea', active: false }],
      columns: [{ accessorKey: 'active' }, { accessorKey: 'name' }],
      initialState: {
        sorting: [
          { id: 'active', desc: true },
          { id: 'name', desc: false }
        ]
      }
    })
    expect(table.getRowModel().rows.map((row) => row.original.name)).toEqual(['Ada', 'Grace', 'Bea', 'Linus'])
  })

  it('cycles asc → desc → unsorted when toggled', () => {
    const table = setup()
    const column = table.getColumn('name')!

    expect(column.getNextSortingOrder()).toBe('asc')
    column.toggleSorting()
    expect(column.getIsSorted()).toBe('asc')
    column.toggleSorting()
    expect(column.getIsSorted()).toBe('desc')
    column.toggleSorting()
    expect(column.getIsSorted()).toBe(false)
  })

  it('respects sortDescFirst and enableSortingRemoval', () => {
    const table = setup({
      columns: [{ accessorKey: 'name', sortDescFirst: true }],
      enableSortingRemoval: false
    })
    const column = table.getColumn('name')!

    column.toggleSorting()
    expect(column.getIsSorted()).toBe('desc')
    column.toggleSorting()
    expect(column.getIsSorted()).toBe('asc')
    column.toggleSorting()
    expect(column.getIsSorted()).toBe('desc')
  })

  it('replaces the sort unless multi-sorting', () => {
    const table = setup()
    table.getColumn('name')!.toggleSorting()
    table.getColumn('size')!.toggleSorting()
    expect(table.getState().sorting).toEqual([{ id: 'size', desc: false }])

    table.getColumn('name')!.toggleSorting(true, true)
    expect(table.getState().sorting).toEqual([
      { id: 'size', desc: false },
      { id: 'name', desc: true }
    ])
    expect(table.getColumn('name')!.getSortIndex()).toBe(1)

    table.getColumn('size')!.clearSorting()
    expect(table.getState().sorting).toEqual([{ id: 'name', desc: true }])
  })

  it('adds to the sort on shift-click and limits the number of sorted columns', () => {
    const table = setup({ maxMultiSortColCount: 2 })
    table.getColumn('name')!.getToggleSortingHandler()({ shiftKey: false })
    table.getColumn('size')!.getToggleSortingHandler()({ shiftKey: true })
    table.getColumn('date')!.getToggleSortingHandler()({ shiftKey: true })

    expect(table.getState().sorting.map((s) => s.id)).toEqual(['size', 'date'])
  })

  it('ignores multi-sort events when multi-sorting is disabled', () => {
    const table = setup({ enableMultiSort: false })
    table.getColumn('name')!.toggleSorting(false, true)
    table.getColumn('size')!.toggleSorting(false, true)

    expect(table.getState().sorting).toEqual([{ id: 'size', desc: false }])
  })

  it('does not sort columns that cannot sort', () => {
    const table = setup({
      columns: [{ accessorKey: 'name', enableSorting: false }, { id: 'actions' }],
      initialState: { sorting: [{ id: 'name', desc: true }] }
    })

    expect(table.getColumn('name')!.getCanSort()).toBe(false)
    expect(table.getColumn('actions')!.getCanSort()).toBe(false)
    expect(names(table)).toEqual(['item 10', 'Item 2', 'item 1', 'apple'])

    table.getColumn('name')!.getToggleSortingHandler()()
    expect(table.getState().sorting).toEqual([{ id: 'name', desc: true }])
    expect(setup({ enableSorting: false }).getColumn('size')!.getCanSort()).toBe(false)
  })

  it('ignores sorting state for unknown columns', () => {
    const table = setup({ initialState: { sorting: [{ id: 'missing', desc: false }] } })
    expect(names(table)).toEqual(['item 10', 'Item 2', 'item 1', 'apple'])
  })

  it('keeps data order with manualSorting', () => {
    const table = setup({ manualSorting: true, initialState: { sorting: [{ id: 'name', desc: false }] } })
    expect(names(table)).toEqual(['item 10', 'Item 2', 'item 1', 'apple'])
    expect(table.getColumn('name')!.getIsSorted()).toBe('asc')
  })

  it('calls onSortingChange and supports controlled state', () => {
    const onSortingChange = vi.fn()
    const sorting: SortingState = [{ id: 'name', desc: true }]
    const table = setup({ state: { sorting }, onSortingChange })

    table.getColumn('name')!.toggleSorting()
    expect(onSortingChange).toHaveBeenCalledWith([])
    // Controlled state wins until the owner passes the new value.
    expect(table.getState().sorting).toBe(sorting)
  })

  it('resets to the initial state or to no sorting', () => {
    const initial: SortingState = [{ id: 'size', desc: false }]
    const table = setup({ initialState: { sorting: initial } })

    table.setSorting([{ id: 'name', desc: false }])
    table.resetSorting()
    expect(table.getState().sorting).toEqual(initial)
    table.resetSorting(true)
    expect(table.getState().sorting).toEqual([])
  })

  it('reuses the sorted row model until inputs change', () => {
    const table = setup({ initialState: { sorting: [{ id: 'name', desc: false }] } })
    const model = table.getRowModel()
    expect(table.getRowModel()).toBe(model)

    table.setSorting([{ id: 'name', desc: true }])
    expect(table.getRowModel()).not.toBe(model)
  })
})
