import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Table, type ColumnDef, type PaginationState } from '../src'

interface Item {
  id: number
}

const items: Item[] = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }))
const columns: ColumnDef<Item>[] = [{ accessorKey: 'id', header: 'ID' }]

const ids = () =>
  within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => row.textContent)

describe('Table pagination UI', () => {
  it('does not render pagination unless enabled', () => {
    render(<Table data={items} columns={columns} />)
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
    expect(ids()).toHaveLength(25)
  })

  it('navigates pages with the buttons', () => {
    render(<Table data={items} columns={columns} enablePagination />)
    const nav = screen.getByRole('navigation', { name: 'Pagination' })

    expect(screen.getByText('1–10 of 25')).toBeInTheDocument()
    expect(within(nav).getByText('Page 1 of 3')).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(within(nav).getByRole('button', { name: 'First page' })).toBeDisabled()

    fireEvent.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(ids()[0]).toBe('11')
    expect(screen.getByText('11–20 of 25')).toBeInTheDocument()

    fireEvent.click(within(nav).getByRole('button', { name: 'Last page' }))
    expect(ids()).toEqual(['21', '22', '23', '24', '25'])
    expect(screen.getByText('21–25 of 25')).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Next page' })).toBeDisabled()

    fireEvent.click(within(nav).getByRole('button', { name: 'First page' }))
    expect(ids()[0]).toBe('1')
  })

  it('changes the page size', () => {
    render(<Table data={items} columns={columns} enablePagination pageSizeOptions={[5, 25]} />)
    const select = screen.getByRole('combobox', { name: 'Rows per page' })

    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(['5', '10', '25'])
    fireEvent.change(select, { target: { value: '25' } })
    expect(ids()).toHaveLength(25)
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
  })

  it('hides the page size select with an empty list', () => {
    render(<Table data={items} columns={columns} enablePagination pageSizeOptions={[]} />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('works with server-side pagination', () => {
    function Server() {
      const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 5 })
      const start = pagination.pageIndex * pagination.pageSize
      return (
        <Table
          data={items.slice(start, start + pagination.pageSize)}
          columns={columns}
          enablePagination
          manualPagination
          rowCount={items.length}
          state={{ pagination }}
          onPaginationChange={setPagination}
        />
      )
    }

    render(<Server />)
    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(ids()).toEqual(['6', '7', '8', '9', '10'])
    expect(screen.getByText('6–10 of 25')).toBeInTheDocument()
  })

  it('shows the page without a total when the row count is unknown', () => {
    render(<Table data={items.slice(0, 10)} columns={columns} enablePagination manualPagination />)
    expect(screen.getByText('1–10')).toBeInTheDocument()
    expect(screen.getByText('Page 1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Last page' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
  })

  it('returns to the first page when a header is sorted', () => {
    render(<Table data={items} columns={columns} enablePagination />)
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.click(screen.getByRole('button', { name: 'ID' }))
    fireEvent.click(screen.getByRole('button', { name: 'ID' }))
    expect(ids()[0]).toBe('25')
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
  })
})
