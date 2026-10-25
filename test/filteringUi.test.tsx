import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Table, TableSearch, type ColumnDef } from '../src'
import { people, type Person } from './fixtures'

const columns: ColumnDef<Person>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'age', header: 'Age' },
  { accessorKey: 'active', header: 'Active' },
  { accessorKey: 'joined', header: 'Joined', cell: ({ getValue }) => getValue().toISOString().slice(0, 10) },
  { id: 'actions', header: 'Actions', cell: () => 'edit' }
]

const names = () =>
  within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0].textContent)
    .filter((name) => name !== 'No matching results')

afterEach(() => {
  vi.useRealTimers()
})

describe('Table filtering UI', () => {
  it('renders the toolbar with access to the table', () => {
    render(<Table data={people} columns={columns} toolbar={(table) => <span>{table.getRowModel().rows.length} rows</span>} />)

    expect(screen.getByText('3 rows').closest('.tably-toolbar')).toBeInTheDocument()
  })

  it('searches all columns from TableSearch after the debounce delay', () => {
    vi.useFakeTimers()
    render(<Table data={people} columns={columns} toolbar={(table) => <TableSearch table={table} />} />)

    const search = screen.getByRole('searchbox', { name: 'Search' })
    fireEvent.change(search, { target: { value: 'gra' } })
    expect(search).toHaveValue('gra')
    expect(names()).toEqual(['Ada', 'Linus', 'Grace'])

    act(() => vi.advanceTimersByTime(200))
    expect(names()).toEqual(['Grace'])
  })

  it('shows the no-results message when filters match nothing', () => {
    render(
      <Table
        data={people}
        columns={columns}
        initialState={{ globalFilter: 'zzz' }}
        noResultsMessage="Nothing matches"
        toolbar={(table) => <TableSearch table={table} debounceMs={0} />}
      />
    )

    expect(screen.getByText('Nothing matches')).toHaveClass('tably-no-results')
    expect(screen.getByRole('searchbox')).toHaveValue('zzz')

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
    expect(names()).toHaveLength(3)
  })

  it('renders default filter controls for filterable columns', () => {
    render(<Table data={people} columns={columns} showColumnFilters filterDebounceMs={0} />)

    expect(screen.getByRole('searchbox', { name: 'Filter Name' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Filter Age from' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filter Active' })).toBeInTheDocument()
    expect(screen.getByLabelText('Filter Joined from')).toHaveAttribute('type', 'date')
    expect(screen.queryByLabelText(/Filter Actions/)).not.toBeInTheDocument()
  })

  it('filters with text, range and boolean controls', () => {
    render(<Table data={people} columns={columns} showColumnFilters filterDebounceMs={0} />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter Name' }), { target: { value: 'a' } })
    expect(names()).toEqual(['Ada', 'Grace'])

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Filter Age from' }), { target: { value: '40' } })
    expect(names()).toEqual(['Grace'])

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Filter Age from' }), { target: { value: '' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter Active' }), { target: { value: 'true' } })
    expect(names()).toEqual(['Ada', 'Grace'])

    fireEvent.change(screen.getByLabelText('Filter Joined to'), { target: { value: '2019-12-31' } })
    expect(names()).toEqual(['Grace'])

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter Active' }), { target: { value: '' } })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter Name' }), { target: { value: '' } })
    expect(names()).toEqual(['Linus', 'Grace'])
  })

  it('renders a custom filter control from the column definition', () => {
    render(
      <Table
        data={people}
        showColumnFilters
        columns={[
          {
            accessorKey: 'name',
            header: 'Name',
            filterFn: 'equalsString',
            filter: ({ column }) => (
              <button onClick={() => column.setFilterValue('linus')}>Only Linus</button>
            )
          }
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Only Linus' }))
    expect(names()).toEqual(['Linus'])
  })

  it('updates filter inputs when the state is reset from outside', () => {
    render(
      <Table
        data={people}
        columns={columns}
        showColumnFilters
        filterDebounceMs={0}
        toolbar={(table) => <button onClick={() => table.resetColumnFilters(true)}>Clear</button>}
      />
    )
    const input = screen.getByRole('searchbox', { name: 'Filter Name' })

    fireEvent.change(input, { target: { value: 'ada' } })
    expect(names()).toEqual(['Ada'])

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(input).toHaveValue('')
    expect(names()).toHaveLength(3)
  })
})
