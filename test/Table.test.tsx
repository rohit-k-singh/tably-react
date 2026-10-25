import { Component, forwardRef, memo, useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DefaultTable, { Table, type CellContext, type ColumnDef, type SortingState } from '../src'
import { people, type Person } from './fixtures'

const columns: ColumnDef<Person>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'age', header: 'Age', cell: ({ getValue }) => `${getValue()} yrs` }
]

const bodyRows = () => screen.getAllByRole('row').slice(1)
const cellTexts = (row: HTMLElement) => within(row).getAllByRole('cell').map((td) => td.textContent)

describe('Table', () => {
  it('is available as both a named and a default export', () => {
    expect(DefaultTable).toBe(Table)
  })

  it('renders headers and cells', () => {
    render(<Table data={people} columns={columns} aria-label="People" />)

    const table = screen.getByRole('table', { name: 'People' })
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Name', 'Age'])
    expect(bodyRows()).toHaveLength(3)
    expect(cellTexts(bodyRows()[0])).toEqual(['Ada', '36 yrs'])
  })

  it('defaults the header to the column id and formats raw values', () => {
    render(
      <Table
        data={people.slice(0, 2)}
        columns={[
          { accessorKey: 'address.city' },
          { accessorKey: 'active' },
          { accessorKey: 'tags' },
          { accessorKey: 'nickname' }
        ]}
      />
    )

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'address.city',
      'active',
      'tags',
      'nickname'
    ])
    expect(cellTexts(bodyRows()[0])).toEqual(['London', 'true', 'math, computing', ''])
    expect(cellTexts(bodyRows()[1])).toEqual(['Portland', 'false', 'kernel', 'torvalds'])
  })

  it('renders header and cell functions with their context', () => {
    render(
      <Table
        data={people.slice(0, 1)}
        columns={[
          { accessorKey: 'name', header: ({ column }) => `col:${column.id}` },
          { id: 'actions', header: 'Actions', cell: ({ row }) => <button>Edit {row.original.name}</button> }
        ]}
      />
    )

    expect(screen.getByRole('columnheader', { name: 'col:name' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Ada' })).toBeInTheDocument()
  })

  it('renders class, memo and forwardRef components as cells', () => {
    class ClassCell extends Component<CellContext<Person, any>> {
      render() {
        return <em>class {String(this.props.getValue())}</em>
      }
    }
    const MemoCell = memo(({ getValue }: { getValue: () => unknown }) => <em>memo {String(getValue())}</em>)
    const RefCell = forwardRef<HTMLElement, { getValue: () => unknown }>(({ getValue }, ref) => (
      <em ref={ref}>ref {String(getValue())}</em>
    ))

    render(
      <Table
        data={people.slice(0, 1)}
        columns={[
          { accessorKey: 'name', cell: ClassCell },
          { accessorKey: 'age', cell: MemoCell },
          { accessorKey: 'id', cell: RefCell }
        ]}
      />
    )

    expect(cellTexts(bodyRows()[0])).toEqual(['class Ada', 'memo 36', 'ref 1'])
  })

  it('applies container and column class names', () => {
    render(
      <Table
        data={people.slice(0, 1)}
        columns={[{ accessorKey: 'name', header: 'Name', className: 'name-cell', headerClassName: 'name-header' }]}
        className="custom"
      />
    )

    expect(screen.getByRole('table').parentElement).toHaveClass('tably-container', 'custom')
    expect(screen.getByRole('columnheader')).toHaveClass('tably-th', 'name-header')
    expect(screen.getByRole('cell')).toHaveClass('tably-td', 'name-cell')
  })

  it('shows the empty message when there is no data', () => {
    render(<Table data={[]} columns={columns} emptyMessage="Nothing here" />)

    expect(screen.getByText('Nothing here')).toHaveAttribute('colspan', '2')
  })

  it('keeps the header and shows a loading indicator while loading', () => {
    render(<Table data={people} columns={columns} loading />)

    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByText('Ada')).not.toBeInTheDocument()
  })

  it('calls onRowClick on click and on Enter / Space', () => {
    const onRowClick = vi.fn()
    render(<Table data={people} columns={columns} onRowClick={onRowClick} />)

    const row = screen.getByText('Linus').closest('tr')!
    expect(row).toHaveAttribute('tabindex', '0')

    fireEvent.click(row)
    fireEvent.keyDown(row, { key: 'Enter' })
    fireEvent.keyDown(row, { key: ' ' })
    fireEvent.keyDown(row, { key: 'a' })

    expect(onRowClick).toHaveBeenCalledTimes(3)
    expect(onRowClick).toHaveBeenCalledWith(people[1], expect.objectContaining({ id: '1', index: 1 }))
  })

  it('ignores Enter pressed on interactive content inside a row', () => {
    const onRowClick = vi.fn()
    render(
      <Table
        data={people.slice(0, 1)}
        columns={[{ id: 'actions', cell: () => <button>Edit</button> }]}
        onRowClick={onRowClick}
      />
    )

    fireEvent.keyDown(screen.getByRole('button', { name: 'Edit' }), { key: 'Enter' })
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('does not make rows focusable without onRowClick', () => {
    render(<Table data={people} columns={columns} />)

    expect(screen.getByText('Ada').closest('tr')).not.toHaveAttribute('tabindex')
  })

  it('keeps row elements when rows are reordered with getRowId', () => {
    const getRowId = (row: Person) => String(row.id)
    const { rerender } = render(<Table data={people} columns={columns} getRowId={getRowId} />)
    const adaRow = screen.getByText('Ada').closest('tr')

    rerender(<Table data={[...people].reverse()} columns={columns} getRowId={getRowId} />)

    expect(screen.getByText('Ada').closest('tr')).toBe(adaRow)
    expect(cellTexts(bodyRows()[0])[0]).toBe('Grace')
  })

  describe('sorting', () => {
    const firstColumn = () => bodyRows().map((row) => cellTexts(row)[0])

    it('sorts when a header button is clicked and sets aria-sort', () => {
      render(<Table data={people} columns={columns} />)
      const nameHeader = screen.getByRole('columnheader', { name: 'Name' })
      const nameButton = within(nameHeader).getByRole('button', { name: 'Name' })

      expect(nameHeader).not.toHaveAttribute('aria-sort')
      fireEvent.click(nameButton)
      expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
      expect(firstColumn()).toEqual(['Ada', 'Grace', 'Linus'])

      fireEvent.click(nameButton)
      expect(nameHeader).toHaveAttribute('aria-sort', 'descending')
      expect(firstColumn()).toEqual(['Linus', 'Grace', 'Ada'])

      fireEvent.click(nameButton)
      expect(nameHeader).not.toHaveAttribute('aria-sort')
      expect(firstColumn()).toEqual(['Ada', 'Linus', 'Grace'])
    })

    it('shows sort priority when sorting by several columns with Shift', () => {
      render(<Table data={people} columns={columns} />)

      fireEvent.click(screen.getByRole('button', { name: 'Name' }))
      fireEvent.click(screen.getByRole('button', { name: 'Age' }), { shiftKey: true })

      const ageHeader = screen.getByRole('columnheader', { name: /Age/ })
      expect(ageHeader).toHaveAttribute('aria-sort', 'ascending')
      expect(ageHeader.querySelector('.tably-sort-index')).toHaveTextContent('2')
      expect(screen.getByRole('columnheader', { name: /Name/ }).querySelector('.tably-sort-index')).toHaveTextContent(
        '1'
      )
    })

    it('renders plain headers for columns that cannot sort', () => {
      render(
        <Table
          data={people}
          columns={[{ accessorKey: 'name', header: 'Name', enableSorting: false }, { id: 'actions', header: 'Actions' }]}
        />
      )

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('supports controlled sorting', () => {
      const onSortingChange = vi.fn()

      function Controlled() {
        const [sorting, setSorting] = useState<SortingState>([{ id: 'age', desc: true }])
        return (
          <Table
            data={people}
            columns={columns}
            state={{ sorting }}
            onSortingChange={(next) => {
              onSortingChange(next)
              setSorting(next)
            }}
          />
        )
      }

      render(<Controlled />)
      expect(firstColumn()).toEqual(['Grace', 'Linus', 'Ada'])

      fireEvent.click(screen.getByRole('button', { name: 'Name' }))
      expect(onSortingChange).toHaveBeenCalledWith([{ id: 'name', desc: false }])
      expect(firstColumn()).toEqual(['Ada', 'Grace', 'Linus'])
    })
  })
})
