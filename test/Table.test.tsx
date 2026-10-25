import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DefaultTable, { Table, type TableColumn } from '../src'

interface User {
  id: number
  name: string
  age: number
}

const users: User[] = [
  { id: 1, name: 'Ada', age: 36 },
  { id: 2, name: 'Linus', age: 54 }
]

const columns: TableColumn<User>[] = [
  { key: 'name', header: 'Name' },
  { key: 'age', header: 'Age', render: (value) => `${value} yrs`, className: 'age-cell' }
]

describe('Table', () => {
  it('is available as both a named and a default export', () => {
    expect(DefaultTable).toBe(Table)
  })

  it('renders headers and cells', () => {
    render(<Table data={users} columns={columns} aria-label="Users" />)

    const table = screen.getByRole('table', { name: 'Users' })
    const headers = within(table).getAllByRole('columnheader')
    expect(headers.map((th) => th.textContent)).toEqual(['Name', 'Age'])

    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getAllByRole('cell').map((td) => td.textContent)).toEqual(['Ada', '36 yrs'])
  })

  it('passes the value and row to custom renderers', () => {
    const renderCell = vi.fn((value: User[keyof User]) => String(value))
    render(<Table data={users} columns={[{ key: 'age', header: 'Age', render: renderCell }]} />)

    expect(renderCell).toHaveBeenCalledWith(36, users[0])
    expect(renderCell).toHaveBeenCalledWith(54, users[1])
  })

  it('applies column class names', () => {
    render(<Table data={users} columns={columns} className="custom" />)

    expect(screen.getByText('36 yrs')).toHaveClass('tably-td', 'age-cell')
    expect(screen.getByRole('table').parentElement).toHaveClass('tably-container', 'custom')
  })

  it('shows the empty message when there is no data', () => {
    render(<Table data={[]} columns={columns} emptyMessage="Nothing here" />)

    const cell = screen.getByText('Nothing here')
    expect(cell).toHaveAttribute('colspan', '2')
  })

  it('keeps the header and shows a loading indicator while loading', () => {
    render(<Table data={users} columns={columns} loading />)

    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByText('Ada')).not.toBeInTheDocument()
  })

  it('calls onRowClick on click and on Enter / Space', () => {
    const onRowClick = vi.fn()
    render(<Table data={users} columns={columns} onRowClick={onRowClick} />)

    const row = screen.getByText('Linus').closest('tr')!
    expect(row).toHaveAttribute('tabindex', '0')

    fireEvent.click(row)
    fireEvent.keyDown(row, { key: 'Enter' })
    fireEvent.keyDown(row, { key: ' ' })
    fireEvent.keyDown(row, { key: 'a' })

    expect(onRowClick).toHaveBeenCalledTimes(3)
    expect(onRowClick).toHaveBeenCalledWith(users[1], 1)
  })

  it('does not make rows focusable without onRowClick', () => {
    render(<Table data={users} columns={columns} />)

    expect(screen.getByText('Ada').closest('tr')).not.toHaveAttribute('tabindex')
  })

  it('keeps row identity when rows are reordered with getRowKey', () => {
    const { rerender } = render(<Table data={users} columns={columns} getRowKey={(row) => row.id} />)
    const adaRow = screen.getByText('Ada').closest('tr')

    rerender(<Table data={[...users].reverse()} columns={columns} getRowKey={(row) => row.id} />)

    expect(screen.getByText('Ada').closest('tr')).toBe(adaRow)
  })
})
