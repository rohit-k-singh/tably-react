import { describe, expect, it, vi } from 'vitest'
import { aggregationFns, type ColumnDef, type TableOptions } from '../src'
import { createTestTable } from './fixtures'

interface Sale {
  id: number
  region: string
  product: string
  amount: number
}

const sales: Sale[] = [
  { id: 1, region: 'EU', product: 'A', amount: 10 },
  { id: 2, region: 'US', product: 'B', amount: 40 },
  { id: 3, region: 'EU', product: 'B', amount: 20 },
  { id: 4, region: 'EU', product: 'A', amount: 5 },
  { id: 5, region: 'APAC', product: 'A', amount: 1 }
]

const columns: ColumnDef<Sale>[] = [
  { accessorKey: 'region' },
  { accessorKey: 'product' },
  { accessorKey: 'amount', aggregationFn: 'sum' },
  { id: 'count', accessorFn: (row) => row.id, aggregationFn: 'count' }
]

function setup(options: Partial<TableOptions<Sale>> = {}) {
  return createTestTable<Sale>({ data: sales, columns, getRowId: (row) => String(row.id), ...options })
}

const describeRows = (table: ReturnType<typeof setup>) =>
  table
    .getRowModel()
    .rows.map((row) => (row.getIsGrouped() ? `${row.groupingValue}:${row.getValue('amount')}` : row.id))

describe('aggregation functions', () => {
  const rows = [3, 1, undefined, 8, 1].map((value) => ({ getValue: () => value })) as any
  it.each([
    ['sum', 13],
    ['min', 1],
    ['max', 8],
    ['extent', [1, 8]],
    ['mean', 3.25],
    ['median', 2],
    ['unique', [3, 1, undefined, 8]],
    ['uniqueCount', 4],
    ['count', 5]
  ] as const)('%s', (name, expected) => {
    expect(aggregationFns[name]('x', rows)).toEqual(expected)
  })

  it('returns undefined without numbers', () => {
    expect(aggregationFns.mean('x', [])).toBeUndefined()
    expect(aggregationFns.median('x', [])).toBeUndefined()
  })
})

describe('grouping', () => {
  it('groups rows by a column with aggregated values', () => {
    const table = setup({ initialState: { grouping: ['region'] } })
    expect(describeRows(table)).toEqual(['EU:35', 'US:40', 'APAC:1'])

    const eu = table.getRowModel().rows[0]
    expect(eu.id).toBe('region:EU')
    expect(eu.groupingColumnId).toBe('region')
    expect(eu.getValue('region')).toBe('EU')
    expect(eu.getValue('product')).toBeUndefined()
    expect(eu.getValue('count')).toBe(3)
    expect(eu.subRows.map((row) => row.id)).toEqual(['1', '3', '4'])
    expect(eu.subRows[0].depth).toBe(1)
    expect(eu.subRows[0].getParentRow()).toBe(table.getGroupedRowModel().rowsById['region:EU'])
  })

  it('shows grouped rows when a group is expanded', () => {
    const table = setup({ initialState: { grouping: ['region'], expanded: { 'region:EU': true } } })
    expect(describeRows(table)).toEqual(['EU:35', '1', '3', '4', 'US:40', 'APAC:1'])
  })

  it('nests groups by several columns', () => {
    const table = setup({ initialState: { grouping: ['region', 'product'], expanded: true } })
    expect(describeRows(table)).toEqual(['EU:35', 'A:15', '1', '4', 'B:20', '3', 'US:40', 'B:40', '2', 'APAC:1', 'A:1', '5'])
    expect(table.getRowModel().rows[1].id).toBe('region:EU>product:A')
  })

  it('sorts groups by their aggregated values', () => {
    const table = setup({ initialState: { grouping: ['region'], sorting: [{ id: 'amount', desc: true }] } })
    expect(describeRows(table)).toEqual(['US:40', 'EU:35', 'APAC:1'])
  })

  it('groups the filtered rows', () => {
    const table = setup({ initialState: { grouping: ['region'] } })
    table.getColumn('product')!.setFilterValue('A')
    expect(describeRows(table)).toEqual(['EU:15', 'APAC:1'])
  })

  it('paginates groups', () => {
    const table = setup({ enablePagination: true, initialState: { grouping: ['region'], pagination: { pageIndex: 0, pageSize: 2 } } })
    expect(table.getPageCount()).toBe(2)
    expect(describeRows(table)).toEqual(['EU:35', 'US:40'])
  })

  it('moves grouped columns to the start, removes them, or leaves them', () => {
    const ids = (table: ReturnType<typeof setup>) => table.getVisibleLeafColumns().map((column) => column.id)
    expect(ids(setup({ initialState: { grouping: ['product'] } }))).toEqual(['product', 'region', 'amount', 'count'])
    expect(ids(setup({ initialState: { grouping: ['product'] }, groupedColumnMode: 'remove' }))).toEqual([
      'region',
      'amount',
      'count'
    ])
    expect(ids(setup({ initialState: { grouping: ['product'] }, groupedColumnMode: false }))).toEqual([
      'region',
      'product',
      'amount',
      'count'
    ])
  })

  it('marks grouped, aggregated and placeholder cells', () => {
    const table = setup({ initialState: { grouping: ['region'], expanded: true } })
    const [group, leaf] = table.getRowModel().rows
    const cell = (row: typeof group, id: string) => row.getCells().find((c) => c.column.id === id)!

    expect(cell(group, 'region').getIsGrouped()).toBe(true)
    expect(cell(group, 'amount').getIsAggregated()).toBe(true)
    expect(cell(group, 'product').getIsAggregated()).toBe(false)
    expect(cell(leaf, 'region').getIsPlaceholder()).toBe(true)
    expect(cell(leaf, 'amount').getIsPlaceholder()).toBe(false)
  })

  it('toggles grouping, reports changes, resets and respects enableGrouping', () => {
    const onGroupingChange = vi.fn()
    const table = setup({ onGroupingChange, enablePagination: true, initialState: { pagination: { pageIndex: 1, pageSize: 2 } } })

    table.getColumn('region')!.toggleGrouping()
    table.getColumn('product')!.toggleGrouping()
    expect(onGroupingChange).toHaveBeenLastCalledWith(['region', 'product'])
    expect(table.getColumn('product')!.getGroupedIndex()).toBe(1)
    expect(table.getState().pagination.pageIndex).toBe(0)

    table.getColumn('region')!.toggleGrouping()
    expect(table.getState().grouping).toEqual(['product'])
    table.resetGrouping()
    expect(table.getState().grouping).toEqual([])

    const disabled = setup({ columns: [{ accessorKey: 'region', enableGrouping: false }, { id: 'x' }] })
    disabled.getColumn('region')!.toggleGrouping()
    expect(disabled.getState().grouping).toEqual([])
    expect(disabled.getColumn('x')!.getCanGroup()).toBe(false)
  })

  it('selects the rows of a group without storing the group row', () => {
    const table = setup({ enableRowSelection: true, initialState: { grouping: ['region'] } })
    table.getRowModel().rows[0].toggleSelected()
    expect(table.getState().rowSelection).toEqual({ '1': true, '3': true, '4': true })
    expect(table.getRowModel().rows[0].getIsAllSubRowsSelected()).toBe(true)
  })

  it('leaves rows as they are with manualGrouping', () => {
    expect(describeRows(setup({ manualGrouping: true, initialState: { grouping: ['region'] } }))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5'
    ])
  })
})

describe('getAggregatedValue', () => {
  it('aggregates the filtered rows, or given rows', () => {
    const table = setup()
    expect(table.getColumn('amount')!.getAggregatedValue()).toBe(76)
    table.getColumn('region')!.setFilterValue('EU')
    expect(table.getColumn('amount')!.getAggregatedValue()).toBe(35)
    expect(table.getColumn('amount')!.getAggregatedValue(table.getCoreRowModel().rows.slice(0, 2))).toBe(50)
    expect(table.getColumn('product')!.getAggregatedValue()).toBeUndefined()
  })

  it('uses custom aggregation functions', () => {
    const table = setup({ columns: [{ accessorKey: 'amount', aggregationFn: (_id, rows) => rows.length * 100 }] })
    expect(table.getColumn('amount')!.getAggregatedValue()).toBe(500)
  })
})
