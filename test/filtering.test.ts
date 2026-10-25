import { describe, expect, it, vi } from 'vitest'
import { filterFns, type ColumnDef, type ColumnFiltersState, type TableOptions } from '../src'
import { createTestTable, people, type Person } from './fixtures'

const columns: ColumnDef<Person>[] = [
  { accessorKey: 'name' },
  { accessorKey: 'age' },
  { accessorKey: 'joined' },
  { accessorKey: 'active' },
  { accessorKey: 'address.city' },
  { accessorKey: 'tags' },
  { id: 'actions' }
]

function setup(options: Partial<TableOptions<Person>> = {}) {
  return createTestTable<Person>({ data: people, columns, ...options })
}

const names = (table: ReturnType<typeof setup>) => table.getRowModel().rows.map((row) => row.original.name)

describe('filter functions', () => {
  const row = (value: unknown) => ({ getValue: () => value }) as any
  const test = (name: keyof typeof filterFns, value: unknown, filter: unknown) => filterFns[name](row(value), 'x', filter)

  it('matches strings', () => {
    expect(test('includesString', 'Hello World', 'wor')).toBe(true)
    expect(test('includesString', null, '')).toBe(false)
    expect(test('includesString', 42, '4')).toBe(true)
    expect(test('includesStringSensitive', 'Hello', 'hello')).toBe(false)
    expect(test('equalsString', 'Hello', 'HELLO')).toBe(true)
    expect(test('equalsString', 'Hello', 'Hell')).toBe(false)
  })

  it('matches equality', () => {
    expect(test('equals', 1, 1)).toBe(true)
    expect(test('equals', 1, '1')).toBe(false)
    expect(test('weakEquals', 1, '1')).toBe(true)
  })

  it('matches arrays', () => {
    expect(test('arrIncludes', ['a', 'b'], 'a')).toBe(true)
    expect(test('arrIncludesAll', ['a', 'b'], ['a', 'b'])).toBe(true)
    expect(test('arrIncludesAll', ['a'], ['a', 'b'])).toBe(false)
    expect(test('arrIncludesSome', ['a'], ['a', 'b'])).toBe(true)
    expect(test('inArray', 'b', ['a', 'b'])).toBe(true)
    expect(test('inArray', 'c', ['a', 'b'])).toBe(false)
  })

  it('matches number ranges with optional ends or a single value', () => {
    expect(test('inNumberRange', 5, [1, 10])).toBe(true)
    expect(test('inNumberRange', 5, [6, undefined])).toBe(false)
    expect(test('inNumberRange', 5, [undefined, 5])).toBe(true)
    expect(test('inNumberRange', 5, 5)).toBe(true)
    expect(test('inNumberRange', null, [0, 10])).toBe(false)
  })

  it('matches date ranges, with date-only ends covering the whole local day', () => {
    const date = new Date(2024, 4, 1, 15, 30)
    expect(test('inDateRange', date, ['2024-05-01', '2024-05-01'])).toBe(true)
    expect(test('inDateRange', date, ['2024-05-02', undefined])).toBe(false)
    expect(test('inDateRange', date, [undefined, new Date(2024, 4, 1, 12)])).toBe(false)
    expect(test('inDateRange', '2024-05-01T10:00:00', [new Date(2024, 3, 1), undefined])).toBe(true)
    expect(test('inDateRange', undefined, ['2024-01-01', undefined])).toBe(false)
  })

  it('auto-removes empty filter values', () => {
    expect(filterFns.includesString.autoRemove!('')).toBe(true)
    expect(filterFns.includesString.autoRemove!('a')).toBe(false)
    expect(filterFns.inNumberRange.autoRemove!([undefined, ''])).toBe(true)
    expect(filterFns.inNumberRange.autoRemove!([0, undefined])).toBe(false)
    expect(filterFns.arrIncludesSome.autoRemove!([])).toBe(true)
  })
})

describe('column filtering', () => {
  it('picks a filter function from the column values', () => {
    const table = setup()
    expect(table.getColumn('name')!.getFilterFn()).toBe(filterFns.includesString)
    expect(table.getColumn('age')!.getFilterFn()).toBe(filterFns.inNumberRange)
    expect(table.getColumn('joined')!.getFilterFn()).toBe(filterFns.inDateRange)
    expect(table.getColumn('tags')!.getFilterFn()).toBe(filterFns.arrIncludes)
    expect(table.getColumn('active')!.getFilterFn()).toBe(filterFns.equals)
  })

  it('filters rows by column values', () => {
    const table = setup()

    table.getColumn('name')!.setFilterValue('a')
    expect(names(table)).toEqual(['Ada', 'Grace'])

    table.getColumn('age')!.setFilterValue([40, undefined])
    expect(names(table)).toEqual(['Grace'])
    expect(table.getState().columnFilters).toEqual([
      { id: 'name', value: 'a' },
      { id: 'age', value: [40, undefined] }
    ])
  })

  it('filters booleans, arrays, dates and nested values', () => {
    expect(names(setup({ initialState: { columnFilters: [{ id: 'active', value: false }] } }))).toEqual(['Linus'])
    expect(names(setup({ initialState: { columnFilters: [{ id: 'tags', value: 'kernel' }] } }))).toEqual(['Linus'])
    expect(
      names(setup({ initialState: { columnFilters: [{ id: 'joined', value: ['2019-01-01', '2020-12-31'] }] } }))
    ).toEqual(['Ada', 'Grace'])
    expect(names(setup({ initialState: { columnFilters: [{ id: 'address.city', value: 'port' }] } }))).toEqual([
      'Linus'
    ])
  })

  it('updates, reads and removes filter values', () => {
    const table = setup()
    const name = table.getColumn('name')!

    name.setFilterValue('a')
    name.setFilterValue((previous: string) => `${previous}d`)
    expect(name.getFilterValue()).toBe('ad')
    expect(name.getIsFiltered()).toBe(true)
    expect(names(table)).toEqual(['Ada'])

    name.setFilterValue('')
    expect(name.getIsFiltered()).toBe(false)
    expect(table.getState().columnFilters).toEqual([])
    expect(names(table)).toHaveLength(3)
  })

  it('uses named and custom filter functions', () => {
    const startsWith = vi.fn((row, id, value) => String(row.getValue(id)).startsWith(value))
    const table = setup({
      columns: [
        { accessorKey: 'name', filterFn: startsWith },
        { accessorKey: 'age', filterFn: 'weakEquals' }
      ]
    })

    table.getColumn('name')!.setFilterValue('Gr')
    expect(names(table)).toEqual(['Grace'])
    table.getColumn('name')!.setFilterValue(undefined)
    table.getColumn('age')!.setFilterValue('54')
    expect(names(table)).toEqual(['Linus'])
  })

  it('ignores filters on columns that cannot filter', () => {
    const table = setup({
      columns: [{ accessorKey: 'name', enableColumnFilter: false }, { id: 'actions' }],
      initialState: { columnFilters: [{ id: 'name', value: 'Ada' }, { id: 'missing', value: 'x' }] }
    })
    expect(table.getColumn('name')!.getCanFilter()).toBe(false)
    expect(table.getColumn('actions')!.getCanFilter()).toBe(false)
    expect(names(table)).toHaveLength(3)
    expect(setup({ enableColumnFilters: false }).getColumn('name')!.getCanFilter()).toBe(false)
    expect(setup({ enableFilters: false }).getColumn('name')!.getCanFilter()).toBe(false)
  })

  it('supports controlled state and resets', () => {
    const onColumnFiltersChange = vi.fn()
    const columnFilters: ColumnFiltersState = [{ id: 'name', value: 'a' }]
    const table = setup({ state: { columnFilters }, onColumnFiltersChange })

    expect(names(table)).toEqual(['Ada', 'Grace'])
    table.getColumn('age')!.setFilterValue([50, 60])
    expect(onColumnFiltersChange).toHaveBeenCalledWith([...columnFilters, { id: 'age', value: [50, 60] }])
    expect(table.getState().columnFilters).toBe(columnFilters)

    const uncontrolled = setup({ initialState: { columnFilters } })
    uncontrolled.setColumnFilters([])
    uncontrolled.resetColumnFilters()
    expect(uncontrolled.getState().columnFilters).toEqual(columnFilters)
    uncontrolled.resetColumnFilters(true)
    expect(uncontrolled.getState().columnFilters).toEqual([])
  })

  it('keeps all rows with manualFiltering', () => {
    const table = setup({ manualFiltering: true, initialState: { columnFilters: [{ id: 'name', value: 'Ada' }] } })
    expect(names(table)).toHaveLength(3)
  })
})

describe('global filtering', () => {
  it('searches string and number columns, case-insensitively', () => {
    const table = setup()

    table.setGlobalFilter('LON')
    expect(names(table)).toEqual(['Ada'])
    table.setGlobalFilter('54')
    expect(names(table)).toEqual(['Linus'])
    table.setGlobalFilter('')
    expect(names(table)).toHaveLength(3)
  })

  it('skips columns of other types unless enabled, and columns that opt out', () => {
    const table = setup()
    expect(table.getColumn('active')!.getCanGlobalFilter()).toBe(false)
    expect(table.getColumn('tags')!.getCanGlobalFilter()).toBe(false)
    expect(table.getColumn('actions')!.getCanGlobalFilter()).toBe(false)

    const custom = setup({
      columns: [{ accessorKey: 'name', enableGlobalFilter: false }, { accessorKey: 'tags', enableGlobalFilter: true }]
    })
    custom.setGlobalFilter('kern')
    expect(names(custom)).toEqual(['Linus'])
    custom.setGlobalFilter('Ada')
    expect(names(custom)).toEqual([])
  })

  it('combines with column filters', () => {
    const table = setup()
    table.setGlobalFilter('lin') // Linus by name, Grace by city (Arlington)
    expect(names(table)).toEqual(['Linus', 'Grace'])
    table.getColumn('age')!.setFilterValue([undefined, 60])
    expect(names(table)).toEqual(['Linus'])
  })

  it('supports a custom global filter function, controlled state and reset', () => {
    const onGlobalFilterChange = vi.fn()
    const table = setup({
      globalFilterFn: 'equalsString',
      initialState: { globalFilter: 'grace' },
      onGlobalFilterChange
    })
    expect(names(table)).toEqual(['Grace'])

    table.setGlobalFilter('gra')
    expect(names(table)).toEqual([])
    expect(onGlobalFilterChange).toHaveBeenCalledWith('gra')

    table.resetGlobalFilter()
    expect(table.getState().globalFilter).toBe('grace')
    table.resetGlobalFilter(true)
    expect(table.getState().globalFilter).toBeUndefined()
    expect(setup({ enableGlobalFilter: false }).getColumn('name')!.getCanGlobalFilter()).toBe(false)
  })

  it('sorts the filtered rows', () => {
    const table = setup({ initialState: { sorting: [{ id: 'age', desc: true }], globalFilter: 'n' } })
    expect(names(table)).toEqual(['Grace', 'Linus', 'Ada'])
    table.getColumn('age')!.setFilterValue([undefined, 60])
    expect(names(table)).toEqual(['Linus', 'Ada'])
    expect(table.getPreSortedRowModel()).toBe(table.getFilteredRowModel())
  })
})
