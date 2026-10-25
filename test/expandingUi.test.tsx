import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Table, type ColumnDef } from '../src'

interface Node {
  name: string
  size: number
  children?: Node[]
}

const tree: Node[] = [
  { name: 'src', size: 30, children: [{ name: 'index.ts', size: 2 }, { name: 'core', size: 20, children: [{ name: 'table.ts', size: 12 }] }] },
  { name: 'README.md', size: 5 }
]
const columns: ColumnDef<Node>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'size', header: 'Size' }
]

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row')
const firstCells = () => bodyRows().map((row) => within(row).getAllByRole('cell')[0])
const names = () => firstCells().map((cell) => cell.textContent)

describe('tree data', () => {
  it('renders expand buttons in the first column, indented by depth', () => {
    render(<Table data={tree} columns={columns} getSubRows={(node) => node.children} />)

    expect(names()).toEqual(['src', 'README.md'])
    const [src, readme] = firstCells()
    expect(src).toHaveClass('tably-tree-cell')
    expect(within(readme).queryByRole('button')).not.toBeInTheDocument()

    fireEvent.click(within(src).getByRole('button', { name: 'Expand row' }))
    expect(names()).toEqual(['src', 'index.ts', 'core', 'README.md'])
    expect(within(src).getByRole('button', { name: 'Collapse row' })).toHaveAttribute('aria-expanded', 'true')
    expect(firstCells()[2].style.getPropertyValue('--tably-depth')).toBe('1')
    expect(bodyRows()[2]).toHaveAttribute('data-depth', '1')
  })

  it('expands and collapses everything from the header', () => {
    render(<Table data={tree} columns={columns} getSubRows={(node) => node.children} />)

    fireEvent.click(screen.getByRole('button', { name: 'Expand all rows' }))
    expect(names()).toEqual(['src', 'index.ts', 'core', 'table.ts', 'README.md'])
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all rows' }))
    expect(names()).toEqual(['src', 'README.md'])
  })

  it('puts the tree in the first data column after the selection column', () => {
    render(<Table data={tree} columns={columns} getSubRows={(node) => node.children} enableRowSelection />)
    const cells = within(bodyRows()[0]).getAllByRole('cell')
    expect(cells[0]).not.toHaveClass('tably-tree-cell')
    expect(cells[1]).toHaveClass('tably-tree-cell')
  })

  it('shows partially selected parents as indeterminate', () => {
    render(
      <Table
        data={tree}
        columns={columns}
        getSubRows={(node) => node.children}
        enableRowSelection
        initialState={{ expanded: true }}
      />
    )
    const checkboxes = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('checkbox') as HTMLInputElement[]

    fireEvent.click(checkboxes()[1])
    expect(checkboxes()[0].indeterminate).toBe(true)

    fireEvent.click(checkboxes()[0])
    expect(checkboxes().slice(0, 4).every((box) => box.checked)).toBe(true)
  })

  it('does not toggle rows from the expand button click', () => {
    render(<Table data={tree} columns={columns} getSubRows={(node) => node.children} enableRowSelection selectRowOnClick />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand row' })[0])
    expect(bodyRows()[0]).toHaveAttribute('aria-selected', 'false')
  })
})

describe('detail panels', () => {
  const flat: Node[] = [
    { name: 'a', size: 1 },
    { name: 'b', size: 2 }
  ]

  it('adds an expand column and renders the panel under expanded rows', () => {
    render(
      <Table data={flat} columns={columns} renderDetailPanel={(row) => <p>Details of {row.original.name}</p>} />
    )

    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
    const toggle = screen.getAllByRole('button', { name: 'Expand row' })[1]
    fireEvent.click(toggle)

    const panel = screen.getByText('Details of b')
    const detailRow = panel.closest('tr')!
    expect(detailRow).toHaveClass('tably-detail-row')
    expect(panel.closest('td')).toHaveAttribute('colspan', '3')
    expect(toggle).toHaveAttribute('aria-controls', detailRow.id)
    expect(bodyRows().indexOf(detailRow)).toBe(2)

    toggle.focus()
    fireEvent.click(toggle)
    expect(toggle).toHaveFocus()
    expect(screen.queryByText('Details of b')).not.toBeInTheDocument()
  })

  it('limits which rows can expand with getRowCanExpand', () => {
    render(
      <Table
        data={flat}
        columns={columns}
        getRowCanExpand={(row) => row.original.size > 1}
        renderDetailPanel={() => 'details'}
      />
    )
    expect(screen.getAllByRole('button', { name: 'Expand row' })).toHaveLength(1)
  })

  it('expands every panel from the header', () => {
    render(<Table data={flat} columns={columns} renderDetailPanel={(row) => `details ${row.original.name}`} />)
    fireEvent.click(screen.getByRole('button', { name: 'Expand all rows' }))
    expect(screen.getByText('details a')).toBeInTheDocument()
    expect(screen.getByText('details b')).toBeInTheDocument()
  })
})
