import { describe, expect, it, vi } from 'vitest'
import { createColumnHelper, createTable, type ColumnDef, type TableState } from '../src'
import { functionalUpdate, getByPath, memo } from '../src/core/utils'
import { people, type Person } from './fixtures'

function setup(columns: ColumnDef<Person>[], options: { getRowId?: (row: Person) => string } = {}) {
  return createTable<Person>({
    data: people,
    columns,
    ...options,
    state: {} as TableState,
    onStateChange: () => {}
  })
}

describe('getByPath', () => {
  it('reads top-level and nested paths', () => {
    expect(getByPath(people[0], 'name')).toBe('Ada')
    expect(getByPath(people[0], 'address.geo.lat')).toBe(51.5)
  })

  it('returns undefined through missing intermediate values', () => {
    expect(getByPath(people[1], 'address.geo.lat')).toBeUndefined()
    expect(getByPath(null, 'a')).toBeUndefined()
  })

  it('prefers a literal key containing a dot', () => {
    expect(getByPath({ 'a.b': 1, a: { b: 2 } }, 'a.b')).toBe(1)
  })
})

describe('memo', () => {
  it('recomputes only when a dependency changes', () => {
    let dep = 1
    const compute = vi.fn((value: number) => value * 2)
    const get = memo(() => [dep], compute)

    expect(get()).toBe(2)
    expect(get()).toBe(2)
    dep = 2
    expect(get()).toBe(4)
    expect(compute).toHaveBeenCalledTimes(2)
  })
})

describe('functionalUpdate', () => {
  it('accepts values and updater functions', () => {
    expect(functionalUpdate(2, 1)).toBe(2)
    expect(functionalUpdate((n: number) => n + 1, 1)).toBe(2)
  })
})

describe('createTable', () => {
  it('derives column ids from accessorKey or id', () => {
    const table = setup([
      { accessorKey: 'name' },
      { accessorKey: 'address.city', id: 'city' },
      { id: 'double', accessorFn: (row) => row.age * 2 },
      { id: 'actions' }
    ])

    expect(table.getAllColumns().map((column) => column.id)).toEqual(['name', 'city', 'double', 'actions'])
    expect(table.getColumn('city')?.index).toBe(1)
    expect(table.getColumn('missing')).toBeUndefined()
  })

  it('throws on missing or duplicate column ids', () => {
    expect(() => setup([{ header: 'x' } as ColumnDef<Person>]).getAllColumns()).toThrow(/needs an "id"/)
    expect(() => setup([{ accessorKey: 'name' }, { accessorKey: 'name' }]).getAllColumns()).toThrow(
      /duplicate column id "name"/
    )
  })

  it('creates rows with values from every accessor type', () => {
    const table = setup([
      { accessorKey: 'name' },
      { accessorKey: 'address.geo.lat' },
      { id: 'double', accessorFn: (row, index) => row.age * 2 + index },
      { id: 'actions' }
    ])
    const [first, second] = table.getRowModel().rows

    expect(first.id).toBe('0')
    expect(first.original).toBe(people[0])
    expect(first.getValue('name')).toBe('Ada')
    expect(first.getValue('address.geo.lat')).toBe(51.5)
    expect(second.getValue('address.geo.lat')).toBeUndefined()
    expect(second.getValue('double')).toBe(109)
    expect(first.getValue('actions')).toBeUndefined()
  })

  it('caches accessor results per row', () => {
    const accessorFn = vi.fn((row: Person) => row.age)
    const table = setup([{ id: 'age', accessorFn }])
    const [row] = table.getRowModel().rows

    row.getValue('age')
    row.getValue('age')
    row.getCells()[0].getValue()
    expect(accessorFn).toHaveBeenCalledTimes(1)
  })

  it('uses getRowId for row and cell ids', () => {
    const table = setup([{ accessorKey: 'name' }], { getRowId: (row) => `person-${row.id}` })
    const { rows, rowsById } = table.getRowModel()

    expect(rows[0].id).toBe('person-1')
    expect(rowsById['person-2'].original.name).toBe('Linus')
    expect(rows[0].getCells()[0].id).toBe('person-1_name')
  })

  it('exposes a render context for cells', () => {
    const table = setup([{ accessorKey: 'name' }])
    const cell = table.getRowModel().rows[0].getCells()[0]
    const context = cell.getContext()

    expect(context.table).toBe(table)
    expect(context.row).toBe(cell.row)
    expect(context.column).toBe(cell.column)
    expect(context.getValue()).toBe('Ada')
  })

  it('reuses row models until data or columns change', () => {
    const columns: ColumnDef<Person>[] = [{ accessorKey: 'name' }]
    const table = setup(columns)
    const model = table.getRowModel()

    expect(table.getRowModel()).toBe(model)
    table.setOptions({ ...table.options, data: people.slice(0, 1) })
    expect(table.getRowModel()).not.toBe(model)
    expect(table.getRowModel().rows).toHaveLength(1)
  })
})

describe('createColumnHelper', () => {
  it('builds accessor and display column definitions', () => {
    const column = createColumnHelper<Person>()
    const byKey = column.accessor('address.city', { header: 'City' })
    const byFn = column.accessor((row) => row.age, { id: 'age' })
    const display = column.display({ id: 'actions' })

    expect(byKey).toEqual({ header: 'City', accessorKey: 'address.city' })
    expect(byFn.id).toBe('age')
    expect(typeof byFn.accessorFn).toBe('function')
    expect(display).toEqual({ id: 'actions' })
  })
})
