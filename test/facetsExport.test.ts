import { describe, expect, it } from 'vitest'
import { getCsv, type ColumnDef, type TableOptions } from '../src'
import { createTestTable } from './fixtures'

interface Item {
  id: number
  name: string
  team: string
  score: number
  tags: string[]
  joined: Date
}

const items: Item[] = [
  { id: 1, name: 'Ada', team: 'red', score: 10, tags: ['a', 'b'], joined: new Date('2024-01-02T00:00:00Z') },
  { id: 2, name: 'Linus, Jr.', team: 'blue', score: 30, tags: ['b'], joined: new Date('2024-02-03T00:00:00Z') },
  { id: 3, name: 'Grace "Amazing"', team: 'red', score: 20, tags: [], joined: new Date('2024-03-04T00:00:00Z') },
  { id: 4, name: '=HYPERLINK("x")', team: 'green', score: -5, tags: ['c'], joined: new Date('2024-04-05T00:00:00Z') }
]

const columns: ColumnDef<Item>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'team', header: 'Team' },
  { accessorKey: 'score', header: 'Score' },
  { accessorKey: 'tags' },
  { accessorKey: 'joined', header: 'Joined' },
  { id: 'actions', header: 'Actions' }
]

function setup(options: Partial<TableOptions<Item>> = {}) {
  return createTestTable<Item>({ data: items, columns, getRowId: (item) => String(item.id), ...options })
}

describe('faceted values', () => {
  it('counts distinct values, including array items', () => {
    const table = setup()
    expect([...table.getColumn('team')!.getFacetedUniqueValues()]).toEqual([
      ['red', 2],
      ['blue', 1],
      ['green', 1]
    ])
    expect(table.getColumn('tags')!.getFacetedUniqueValues().get('b')).toBe(2)
    expect(table.getColumn('score')!.getFacetedMinMaxValues()).toEqual([-5, 30])
    expect(table.getColumn('name')!.getFacetedMinMaxValues()).toBeUndefined()
    expect(table.getColumn('actions')!.getFacetedUniqueValues().size).toBe(0)
  })

  it('applies every filter except the column’s own', () => {
    const table = setup()
    table.getColumn('team')!.setFilterValue('red')
    table.getColumn('score')!.setFilterValue([15, undefined])

    // Team options ignore the team filter but follow the score filter.
    expect([...table.getColumn('team')!.getFacetedUniqueValues().keys()]).toEqual(['blue', 'red'])
    // Score range follows the team filter only.
    expect(table.getColumn('score')!.getFacetedMinMaxValues()).toEqual([10, 20])
  })

  it('maps filter variants to filter functions', () => {
    const table = setup({
      columns: [
        { accessorKey: 'team', filterVariant: 'select' },
        { accessorKey: 'name', filterVariant: 'multi-select' }
      ]
    })
    table.getColumn('team')!.setFilterValue('red')
    expect(table.getRowModel().rows).toHaveLength(2)
    table.getColumn('team')!.setFilterValue(undefined)
    table.getColumn('name')!.setFilterValue(['Ada', 'Linus, Jr.'])
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual(['1', '2'])
  })
})

describe('getCsv', () => {
  it('exports visible value columns with quoting and formula escaping', () => {
    const table = setup()
    expect(getCsv(table).split('\r\n')).toEqual([
      'Name,Team,Score,tags,Joined',
      'Ada,red,10,"a, b",2024-01-02T00:00:00.000Z',
      '"Linus, Jr.",blue,30,b,2024-02-03T00:00:00.000Z',
      '"Grace ""Amazing""",red,20,,2024-03-04T00:00:00.000Z',
      `"'=HYPERLINK(""x"")",green,-5,c,2024-04-05T00:00:00.000Z`
    ])
  })

  it('follows sorting, filters, visibility and order', () => {
    const table = setup({
      initialState: {
        sorting: [{ id: 'score', desc: true }],
        columnVisibility: { tags: false, joined: false },
        columnOrder: ['score']
      }
    })
    table.getColumn('team')!.setFilterValue('red')
    expect(getCsv(table)).toBe('Score,Name,Team\r\n20,"Grace ""Amazing""",red\r\n10,Ada,red')
  })

  it('exports the page or the selection', () => {
    const table = setup({
      enablePagination: true,
      enableRowSelection: true,
      initialState: { pagination: { pageIndex: 1, pageSize: 2 }, rowSelection: { '1': true, '4': true } }
    })
    const names = (csv: string) => csv.split('\r\n').slice(1).map((line) => line.split(',')[0])

    expect(names(getCsv(table, { rows: 'page' }))).toEqual(['"Grace ""Amazing"""', `"'=HYPERLINK(""x"")"`])
    expect(names(getCsv(table, { rows: 'selected', escapeFormulae: false }))).toEqual(['Ada', '"=HYPERLINK(""x"")"'])
    expect(getCsv(table).split('\r\n')).toHaveLength(5)
  })

  it('accepts custom columns, values, headers and delimiters', () => {
    const table = setup()
    const csv = getCsv(table, {
      columns: [table.getColumn('name')!, table.getColumn('score')!],
      getHeader: (column) => column.id.toUpperCase(),
      getValue: (row, column) => (column.id === 'score' ? row.original.score * 2 : row.getValue(column.id)),
      delimiter: ';',
      includeHeaders: false
    })
    expect(csv.split('\r\n')[1]).toBe('Linus, Jr.;60')
  })

  it('skips group rows', () => {
    const table = setup({ initialState: { grouping: ['team'], expanded: true } })
    expect(getCsv(table).split('\r\n')).toHaveLength(5)
  })
})
