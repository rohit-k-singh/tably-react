import { describe, expect, it, vi } from 'vitest'
import type { ColumnDef, TableOptions } from '../src'
import { createTestTable } from './fixtures'

interface Node {
  name: string
  size: number
  children?: Node[]
}

const tree: Node[] = [
  {
    name: 'src',
    size: 30,
    children: [
      { name: 'index.ts', size: 2 },
      { name: 'core', size: 20, children: [{ name: 'table.ts', size: 12 }, { name: 'rows.ts', size: 8 }] },
      { name: 'styles.css', size: 8 }
    ]
  },
  { name: 'README.md', size: 5 },
  { name: 'test', size: 10, children: [{ name: 'core.test.ts', size: 10 }] }
]

const columns: ColumnDef<Node>[] = [{ accessorKey: 'name' }, { accessorKey: 'size' }]

function setup(options: Partial<TableOptions<Node>> = {}) {
  return createTestTable<Node>({ data: tree, columns, getSubRows: (node) => node.children, ...options })
}

const names = (table: ReturnType<typeof setup>) => table.getRowModel().rows.map((row) => row.original.name)

describe('tree rows', () => {
  it('builds sub rows with depth, parents and ids', () => {
    const table = setup()
    const core = table.getCoreRowModel()

    expect(core.rows.map((row) => row.id)).toEqual(['0', '1', '2'])
    expect(core.flatRows.map((row) => row.id)).toEqual(['0', '0.0', '0.1', '0.1.0', '0.1.1', '0.2', '1', '2', '2.0'])
    const rowsTs = core.rowsById['0.1.1']
    expect(rowsTs.depth).toBe(2)
    expect(rowsTs.index).toBe(1)
    expect(rowsTs.getParentRow()!.original.name).toBe('core')
    expect(rowsTs.getParentRows().map((row) => row.id)).toEqual(['0', '0.1'])
    expect(core.rowsById['0'].getLeafRows().map((row) => row.id)).toEqual(['0.0', '0.1', '0.1.0', '0.1.1', '0.2'])
  })

  it('passes the parent row to getRowId', () => {
    const table = setup({ getRowId: (node, _index, parent) => (parent ? `${parent.id}/${node.name}` : node.name) })
    expect(table.getCoreRowModel().flatRows.map((row) => row.id)).toContain('src/core/table.ts')
  })

  it('shows top-level rows until rows are expanded', () => {
    const table = setup()
    expect(names(table)).toEqual(['src', 'README.md', 'test'])

    table.getCoreRowModel().rowsById['0'].toggleExpanded()
    expect(names(table)).toEqual(['src', 'index.ts', 'core', 'styles.css', 'README.md', 'test'])

    table.getCoreRowModel().rowsById['0.1'].toggleExpanded()
    expect(names(table)).toContain('table.ts')

    table.getCoreRowModel().rowsById['0'].toggleExpanded()
    expect(names(table)).toEqual(['src', 'README.md', 'test'])
  })

  it('expands everything and collapses single rows from that state', () => {
    const onExpandedChange = vi.fn()
    const table = setup({ onExpandedChange })

    table.toggleAllRowsExpanded()
    expect(table.getState().expanded).toBe(true)
    expect(names(table)).toHaveLength(9)
    expect(table.getIsAllRowsExpanded()).toBe(true)

    table.getCoreRowModel().rowsById['0.1'].toggleExpanded(false)
    expect(names(table)).not.toContain('table.ts')
    expect(table.getIsAllRowsExpanded()).toBe(false)
    expect(table.getIsSomeRowsExpanded()).toBe(true)
    expect(onExpandedChange).toHaveBeenLastCalledWith({ '0': true, '2': true })

    table.toggleAllRowsExpanded(false)
    expect(table.getIsSomeRowsExpanded()).toBe(false)
  })

  it('only expands rows that can expand', () => {
    const table = setup()
    const readme = table.getCoreRowModel().rowsById['1']
    expect(readme.getCanExpand()).toBe(false)
    readme.toggleExpanded()
    expect(table.getState().expanded).toEqual({})

    expect(setup({ enableExpanding: false }).getCoreRowModel().rowsById['0'].getCanExpand()).toBe(false)
    expect(setup({ getRowCanExpand: () => true }).getCoreRowModel().rowsById['1'].getCanExpand()).toBe(true)
  })

  it('sorts every level', () => {
    const table = setup({ initialState: { sorting: [{ id: 'size', desc: false }], expanded: true } })
    expect(names(table)).toEqual([
      'README.md',
      'test',
      'core.test.ts',
      'src',
      'index.ts',
      'styles.css',
      'core',
      'rows.ts',
      'table.ts'
    ])
  })

  it('keeps ancestors of matching rows when filtering', () => {
    const table = setup({ initialState: { expanded: true } })

    table.setGlobalFilter('rows')
    expect(names(table)).toEqual(['src', 'core', 'rows.ts'])

    table.setGlobalFilter('core')
    expect(names(table)).toEqual(['src', 'core', 'test', 'core.test.ts'])
    // "core" matches but none of its children do, so it has no visible children.
    expect(table.getRowModel().rowsById['0.1'].subRows).toEqual([])
    expect(table.getRowModel().rowsById['0.1'].getCanExpand()).toBe(false)
  })

  it('paginates top-level rows with their expanded sub rows', () => {
    const table = setup({
      enablePagination: true,
      initialState: { pagination: { pageIndex: 0, pageSize: 2 }, expanded: { '0': true } }
    })
    expect(table.getPageCount()).toBe(2)
    expect(names(table)).toEqual(['src', 'index.ts', 'core', 'styles.css', 'README.md'])
    table.nextPage()
    expect(names(table)).toEqual(['test'])
  })

  it('leaves rows as they are with manualExpanding', () => {
    const table = setup({ manualExpanding: true, initialState: { expanded: true } })
    expect(names(table)).toEqual(['src', 'README.md', 'test'])
  })

  it('resets the expanded state', () => {
    const table = setup({ initialState: { expanded: { '2': true } } })
    table.toggleAllRowsExpanded(true)
    table.resetExpanded()
    expect(table.getState().expanded).toEqual({ '2': true })
    table.resetExpanded(true)
    expect(table.getState().expanded).toEqual({})
  })
})

describe('tree selection', () => {
  it('selects sub rows with their parent and reports partial selection', () => {
    const table = setup({ enableRowSelection: true })
    const src = table.getCoreRowModel().rowsById['0']

    src.toggleSelected()
    expect(table.getSelectedRowModel().rows.map((row) => row.id)).toEqual(['0', '0.0', '0.1', '0.1.0', '0.1.1', '0.2'])
    expect(src.getIsAllSubRowsSelected()).toBe(true)

    table.getCoreRowModel().rowsById['0.1.0'].toggleSelected()
    expect(src.getIsSomeSelected()).toBe(true)
    expect(src.getIsAllSubRowsSelected()).toBe(false)
    expect(table.getCoreRowModel().rowsById['0.1'].getIsSomeSelected()).toBe(true)

    src.toggleSelected(false)
    expect(table.getSelectedRowModel().rows).toEqual([])
  })

  it('can select rows without their sub rows', () => {
    const table = setup({ enableRowSelection: true, enableSubRowSelection: false })
    table.getCoreRowModel().rowsById['0'].toggleSelected()
    expect(table.getSelectedRowModel().rows.map((row) => row.id)).toEqual(['0'])
  })

  it('selects all rows at every level', () => {
    const table = setup({ enableRowSelection: true })
    table.toggleAllRowsSelected()
    expect(table.getSelectedRowModel().rows).toHaveLength(9)
    expect(table.getIsAllRowsSelected()).toBe(true)
  })
})
