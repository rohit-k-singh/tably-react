import { describe, expect, it, vi } from 'vitest'
import type { ColumnDef, HeaderGroup, TableOptions } from '../src'
import { createTestTable, people, type Person } from './fixtures'

const columns: ColumnDef<Person>[] = [
  { accessorKey: 'id', header: 'ID' },
  {
    header: 'Person',
    columns: [
      { accessorKey: 'name', header: 'Name' },
      {
        id: 'details',
        header: 'Details',
        columns: [{ accessorKey: 'age' }, { accessorKey: 'active', enableHiding: false }]
      }
    ]
  },
  { accessorKey: 'address.city', header: 'City' }
]

function setup(options: Partial<TableOptions<Person>> = {}) {
  return createTestTable<Person>({ data: people, columns, ...options })
}

const describeGroups = (groups: HeaderGroup<Person>[]) =>
  groups.map((group) =>
    group.headers.map(
      (header) =>
        `${header.column.id}${header.colSpan > 1 ? `:c${header.colSpan}` : ''}${header.rowSpan > 1 ? `:r${header.rowSpan}` : ''}`
    )
  )
const visibleIds = (table: ReturnType<typeof setup>) => table.getVisibleLeafColumns().map((column) => column.id)

describe('column groups', () => {
  it('builds a column tree with leaf and flat views', () => {
    const table = setup()
    const person = table.getColumn('Person')!

    expect(table.getAllColumns().map((column) => column.id)).toEqual(['id', 'Person', 'address.city'])
    expect(person.columns.map((column) => column.id)).toEqual(['name', 'details'])
    expect(person.getLeafColumns().map((column) => column.id)).toEqual(['name', 'age', 'active'])
    expect(table.getColumn('age')!.depth).toBe(2)
    expect(table.getColumn('age')!.parent!.id).toBe('details')
    expect(table.getAllLeafColumns().map((column) => column.id)).toEqual(['id', 'name', 'age', 'active', 'address.city'])
    expect(table.getAllFlatColumns()).toHaveLength(7)
  })

  it('requires an id for groups without a string header', () => {
    const table = setup({ columns: [{ header: () => 'x', columns: [{ accessorKey: 'name' }] } as ColumnDef<Person>] })
    expect(() => table.getAllColumns()).toThrow(/index 0 needs an "id"/)
  })

  it('builds header rows with spans and no placeholders', () => {
    expect(describeGroups(setup().getHeaderGroups())).toEqual([
      ['id:r3', 'Person:c3', 'address.city:r3'],
      ['name:r2', 'details:c2'],
      ['age', 'active']
    ])
  })

  it('builds a single header row without groups', () => {
    const table = setup({ columns: [{ accessorKey: 'name' }, { accessorKey: 'age' }] })
    expect(describeGroups(table.getHeaderGroups())).toEqual([['name', 'age']])
  })

  it('splits a group whose columns are not adjacent', () => {
    const table = setup({ initialState: { columnOrder: ['name', 'id', 'age', 'active'] } })
    expect(describeGroups(table.getHeaderGroups())).toEqual([
      ['Person', 'id:r3', 'Person:c2', 'address.city:r3'],
      ['name:r2', 'details:c2'],
      ['age', 'active']
    ])
  })

  it('does not sort or filter by group columns', () => {
    const group = setup().getColumn('Person')!
    expect(group.getCanSort()).toBe(false)
    expect(group.getCanFilter()).toBe(false)
  })

  it('returns visible cells in display order', () => {
    const table = setup({ initialState: { columnOrder: ['address.city'], columnVisibility: { age: false } } })
    const row = table.getRowModel().rows[0]
    expect(row.getCells()).toHaveLength(5)
    expect(row.getVisibleCells().map((cell) => cell.getValue())).toEqual(['London', 1, 'Ada', true])
  })
})

describe('column visibility', () => {
  it('hides columns and shrinks group spans', () => {
    const table = setup()
    table.getColumn('age')!.toggleVisibility(false)

    expect(visibleIds(table)).toEqual(['id', 'name', 'active', 'address.city'])
    expect(describeGroups(table.getHeaderGroups())[0]).toEqual(['id:r3', 'Person:c2', 'address.city:r3'])
    expect(table.getColumn('details')!.getIsVisible()).toBe(true)
  })

  it('hides a whole group except columns that cannot hide', () => {
    const table = setup()
    table.getColumn('Person')!.toggleVisibility()

    expect(visibleIds(table)).toEqual(['id', 'active', 'address.city'])
    expect(table.getColumn('Person')!.getIsVisible()).toBe(true)
    expect(table.getColumn('active')!.getCanHide()).toBe(false)
  })

  it('toggles every column, reports changes and resets', () => {
    const onColumnVisibilityChange = vi.fn()
    const table = setup({ onColumnVisibilityChange, initialState: { columnVisibility: { id: false } } })
    expect(table.getIsAllColumnsVisible()).toBe(false)

    table.toggleAllColumnsVisible(false)
    expect(visibleIds(table)).toEqual(['active'])
    expect(table.getIsSomeColumnsVisible()).toBe(true)
    expect(onColumnVisibilityChange).toHaveBeenLastCalledWith({
      id: false,
      name: false,
      age: false,
      'address.city': false
    })

    table.toggleAllColumnsVisible()
    expect(table.getIsAllColumnsVisible()).toBe(true)
    table.resetColumnVisibility()
    expect(visibleIds(table)).not.toContain('id')
    table.resetColumnVisibility(true)
    expect(table.getIsAllColumnsVisible()).toBe(true)
  })

  it('respects enableHiding on the table', () => {
    const table = setup({ enableHiding: false })
    table.getColumn('name')!.toggleVisibility(false)
    expect(table.getColumn('name')!.getCanHide()).toBe(false)
    expect(visibleIds(table)).toContain('name')
  })
})

describe('column order', () => {
  it('orders listed columns first and keeps the rest in definition order', () => {
    const table = setup({ initialState: { columnOrder: ['address.city', 'missing', 'age'] } })
    expect(visibleIds(table)).toEqual(['address.city', 'age', 'id', 'name', 'active'])
  })

  it('moves a column and reports the full order', () => {
    const onColumnOrderChange = vi.fn()
    const table = setup({ onColumnOrderChange })

    table.moveColumn('address.city', 0)
    expect(visibleIds(table)).toEqual(['address.city', 'id', 'name', 'age', 'active'])
    expect(onColumnOrderChange).toHaveBeenCalledWith(['address.city', 'id', 'name', 'age', 'active'])

    table.moveColumn('id', 99)
    expect(visibleIds(table)).toEqual(['address.city', 'name', 'age', 'active', 'id'])

    onColumnOrderChange.mockClear()
    table.moveColumn('id', 4)
    table.moveColumn('missing', 0)
    expect(onColumnOrderChange).not.toHaveBeenCalled()

    table.resetColumnOrder()
    expect(visibleIds(table)).toEqual(['id', 'name', 'age', 'active', 'address.city'])
  })
})
