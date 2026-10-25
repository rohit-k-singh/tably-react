import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Table, type ColumnDef } from '../src'

interface Item {
  id: string
  name: string
}

const items: Item[] = Array.from({ length: 6 }, (_, i) => ({ id: `item-${i}`, name: `Item ${i}` }))
const columns: ColumnDef<Item>[] = [{ accessorKey: 'name', header: 'Name' }]
const getRowId = (item: Item) => item.id

const body = () => screen.getAllByRole('rowgroup')[1]
const rowCheckbox = (index: number) => within(body()).getAllByRole('checkbox', { name: 'Select row' })[index]
const selectedNames = () =>
  within(body())
    .getAllByRole('row')
    .filter((row) => row.getAttribute('aria-selected') === 'true')
    .map((row) => row.textContent)

describe('Table row selection', () => {
  it('adds a checkbox column and marks selected rows', () => {
    const onRowSelectionChange = vi.fn()
    render(
      <Table data={items} columns={columns} getRowId={getRowId} enableRowSelection onRowSelectionChange={onRowSelectionChange} />
    )

    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    fireEvent.click(rowCheckbox(1))
    expect(rowCheckbox(1)).toBeChecked()
    const row = rowCheckbox(1).closest('tr')!
    expect(row).toHaveAttribute('aria-selected', 'true')
    expect(row).toHaveAttribute('data-selected')
    expect(within(body()).getAllByRole('row')[0]).toHaveAttribute('aria-selected', 'false')
    expect(onRowSelectionChange).toHaveBeenCalledWith({ 'item-1': true })
  })

  it('selects all with an indeterminate header checkbox', () => {
    render(<Table data={items} columns={columns} getRowId={getRowId} enableRowSelection />)
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' }) as HTMLInputElement

    fireEvent.click(rowCheckbox(0))
    expect(selectAll.indeterminate).toBe(true)
    expect(selectAll).not.toBeChecked()

    fireEvent.click(selectAll)
    expect(selectAll).toBeChecked()
    expect(selectAll.indeterminate).toBe(false)
    expect(selectedNames()).toHaveLength(6)

    fireEvent.click(selectAll)
    expect(selectedNames()).toHaveLength(0)
  })

  it('selects ranges with Shift-click', () => {
    render(<Table data={items} columns={columns} getRowId={getRowId} enableRowSelection />)

    fireEvent.click(rowCheckbox(1))
    fireEvent.click(rowCheckbox(4), { shiftKey: true })
    expect(selectedNames()).toEqual(['Item 1', 'Item 2', 'Item 3', 'Item 4'])

    // The last clicked row (Item 4) is the new anchor: Shift-clicking a selected row deselects the range.
    fireEvent.click(rowCheckbox(2), { shiftKey: true })
    expect(selectedNames()).toEqual(['Item 1'])
  })

  it('selects only the current page with selectAllScope="page"', () => {
    render(
      <Table
        data={items}
        columns={columns}
        getRowId={getRowId}
        enableRowSelection
        enablePagination
        initialState={{ pagination: { pageIndex: 0, pageSize: 4 } }}
        selectAllScope="page"
      />
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(selectedNames()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(selectedNames()).toHaveLength(4)
  })

  it('hides the header checkbox in single selection mode', () => {
    render(
      <Table data={items} columns={columns} getRowId={getRowId} enableRowSelection enableMultiRowSelection={false} />
    )
    expect(screen.queryByRole('checkbox', { name: 'Select all rows' })).not.toBeInTheDocument()
    fireEvent.click(rowCheckbox(0))
    fireEvent.click(rowCheckbox(3), { shiftKey: true })
    expect(selectedNames()).toEqual(['Item 3'])
  })

  it('disables checkboxes of rows that cannot be selected', () => {
    render(
      <Table data={items} columns={columns} getRowId={getRowId} enableRowSelection={(row) => row.index !== 2} />
    )
    expect(rowCheckbox(2)).toBeDisabled()
  })

  it('does not trigger onRowClick from the checkbox', () => {
    const onRowClick = vi.fn()
    render(<Table data={items} columns={columns} getRowId={getRowId} enableRowSelection onRowClick={onRowClick} />)
    fireEvent.click(rowCheckbox(0))
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('selects rows by clicking them, without the checkbox column', () => {
    render(
      <Table
        data={items}
        columns={columns}
        getRowId={getRowId}
        enableRowSelection
        hideSelectionColumn
        selectRowOnClick
      />
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    const rows = within(body()).getAllByRole('row')
    fireEvent.click(rows[2])
    fireEvent.keyDown(rows[3], { key: ' ' })
    expect(selectedNames()).toEqual(['Item 2', 'Item 3'])
    fireEvent.click(rows[2])
    expect(selectedNames()).toEqual(['Item 3'])
  })

  it('does not add aria-selected without selection', () => {
    render(<Table data={items} columns={columns} />)
    expect(within(body()).getAllByRole('row')[0]).not.toHaveAttribute('aria-selected')
  })
})
