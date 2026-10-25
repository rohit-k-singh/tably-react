import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Table, type ColumnDef } from '../src'

interface Sale {
  id: number
  region: string
  amount: number
}

const sales: Sale[] = [
  { id: 1, region: 'EU', amount: 10 },
  { id: 2, region: 'US', amount: 40 },
  { id: 3, region: 'EU', amount: 20 }
]

const columns: ColumnDef<Sale>[] = [
  { accessorKey: 'region', header: 'Region' },
  { accessorKey: 'amount', header: 'Amount', aggregationFn: 'sum', footer: ({ column }) => `Total ${column.getAggregatedValue()}` },
  { id: 'actions', header: 'Actions', cell: () => <button>Edit</button> }
]

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row')
const texts = (row: HTMLElement) => within(row).getAllByRole('cell').map((cell) => cell.textContent)

describe('Table grouping', () => {
  it('renders group rows with a toggle, value, count and aggregates', () => {
    render(<Table data={sales} columns={columns} initialState={{ grouping: ['region'] }} />)

    const [eu, us] = bodyRows()
    expect(eu).toHaveClass('tably-group-row')
    expect(eu).toHaveAttribute('data-grouped')
    expect(texts(eu)).toEqual(['EU(2)', '30', ''])
    expect(texts(us)).toEqual(['US(1)', '40', ''])

    fireEvent.click(within(eu).getByRole('button', { name: 'Expand row' }))
    expect(bodyRows().map((row) => texts(row))).toEqual([
      ['EU(2)', '30', ''],
      ['', '10', 'Edit'],
      ['', '20', 'Edit'],
      ['US(1)', '40', '']
    ])
  })

  it('counts top-level rows in the pagination range when groups are expanded', () => {
    render(
      <Table data={sales} columns={columns} enablePagination initialState={{ grouping: ['region'], expanded: true }} />
    )
    expect(bodyRows()).toHaveLength(5)
    expect(screen.getByText('1–2 of 2')).toBeInTheDocument()
  })

  it('renders custom aggregated cells', () => {
    render(
      <Table
        data={sales}
        columns={[columns[0], { ...columns[1], aggregatedCell: ({ getValue }) => `Σ ${getValue()}` } as ColumnDef<Sale>]}
        initialState={{ grouping: ['region'] }}
      />
    )
    expect(texts(bodyRows()[0])).toEqual(['EU(2)', 'Σ 30'])
  })

  it('groups and ungroups from the column actions menu', () => {
    render(<Table data={sales} columns={columns} enableColumnActions />)

    fireEvent.click(screen.getByRole('button', { name: 'Region column actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Group by this column' }))
    expect(bodyRows()).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Region column actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ungroup' }))
    expect(bodyRows()).toHaveLength(3)
  })
})

describe('Table footer', () => {
  it('renders a footer row when columns define footers', () => {
    render(<Table data={sales} columns={columns} />)
    const footer = screen.getAllByRole('rowgroup')[2]
    expect(footer.tagName).toBe('TFOOT')
    expect(within(footer).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['', 'Total 70', ''])
  })

  it('updates footer aggregates with the filters', () => {
    render(<Table data={sales} columns={columns} initialState={{ globalFilter: 'EU' }} />)
    expect(screen.getByText('Total 30')).toBeInTheDocument()
  })

  it('renders no footer without footers', () => {
    render(<Table data={sales} columns={[columns[0]]} />)
    expect(document.querySelector('tfoot')).toBeNull()
  })
})
