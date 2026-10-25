import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Table, TableExportButton, type ColumnDef } from '../src'

interface Item {
  id: number
  name: string
  team: string
  score: number
}

const items: Item[] = [
  { id: 1, name: 'Ada', team: 'red', score: 10 },
  { id: 2, name: 'Linus', team: 'blue', score: 30 },
  { id: 3, name: 'Grace', team: 'red', score: 20 }
]

const columns: ColumnDef<Item>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'team', header: 'Team' },
  { id: 'actions', header: 'Actions', cell: ({ row }) => <button>Edit {row.original.name}</button> }
]

const cellAt = (row: number, col: number) =>
  document.querySelector<HTMLElement>(`[data-grid-row="${row}"][data-grid-col="${col}"]`)!
const key = (element: Element, keyName: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(element, { key: keyName, ...init })

describe('keyboard grid navigation', () => {
  it('makes the table a grid with a single Tab stop', () => {
    render(<Table data={items} columns={columns} enableKeyboardNavigation />)
    expect(screen.getByRole('grid')).toBeInTheDocument()

    const tabbable = Array.from(document.querySelectorAll<HTMLElement>('table *')).filter((el) => el.tabIndex === 0)
    expect(tabbable).toEqual([cellAt(-1, 0)])
    // Controls inside cells leave the Tab order.
    expect(screen.getByRole('button', { name: 'Edit Ada' }).tabIndex).toBe(-1)
    expect(screen.getByRole('button', { name: 'Name' }).tabIndex).toBe(-1)
  })

  it('moves between cells with arrows, Home / End and Ctrl+Home / End', () => {
    render(<Table data={items} columns={columns} enableKeyboardNavigation />)
    cellAt(-1, 0).focus()

    key(cellAt(-1, 0), 'ArrowDown')
    expect(cellAt(0, 0)).toHaveFocus()
    expect(cellAt(0, 0)).toHaveAttribute('tabindex', '0')
    expect(cellAt(-1, 0)).toHaveAttribute('tabindex', '-1')

    key(cellAt(0, 0), 'ArrowRight')
    expect(cellAt(0, 1)).toHaveFocus()
    key(cellAt(0, 1), 'End')
    expect(cellAt(0, 2)).toHaveFocus()
    key(cellAt(0, 2), 'ArrowRight')
    expect(cellAt(0, 2)).toHaveFocus()
    key(cellAt(0, 2), 'End', { ctrlKey: true })
    expect(cellAt(2, 2)).toHaveFocus()
    key(cellAt(2, 2), 'ArrowDown')
    expect(cellAt(2, 2)).toHaveFocus()
    key(cellAt(2, 2), 'Home', { ctrlKey: true })
    expect(cellAt(-1, 0)).toHaveFocus()
    key(cellAt(-1, 0), 'PageDown')
    expect(cellAt(2, 0)).toHaveFocus()
  })

  it('sorts headers with Enter', () => {
    render(<Table data={items} columns={columns} enableKeyboardNavigation />)
    cellAt(-1, 0).focus()
    key(cellAt(-1, 0), 'Enter')
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending')
  })

  it('enters cell controls with Enter / F2 and leaves them with Escape', () => {
    render(<Table data={items} columns={columns} enableKeyboardNavigation />)
    cellAt(1, 2).focus()
    key(cellAt(1, 2), 'F2')
    expect(screen.getByRole('button', { name: 'Edit Linus' })).toHaveFocus()
    key(screen.getByRole('button', { name: 'Edit Linus' }), 'Escape')
    expect(cellAt(1, 2)).toHaveFocus()
  })

  it('activates rows with Enter and toggles selection with Space', () => {
    const onRowClick = vi.fn()
    render(<Table data={items} columns={columns} enableKeyboardNavigation enableRowSelection onRowClick={onRowClick} />)
    // Column 0 is the selection column.
    cellAt(1, 1).focus()
    key(cellAt(1, 1), 'Enter')
    expect(onRowClick).toHaveBeenCalledWith(items[1], expect.anything())

    key(cellAt(1, 1), ' ')
    expect(cellAt(1, 1).closest('tr')).toHaveAttribute('aria-selected', 'true')
    // Rows are not separate Tab stops in grid mode.
    expect(cellAt(1, 1).closest('tr')).not.toHaveAttribute('tabindex')
  })

  it('expands and collapses tree rows with ArrowRight / ArrowLeft', () => {
    interface Node {
      name: string
      children?: Node[]
    }
    const tree: Node[] = [{ name: 'root', children: [{ name: 'child' }] }]
    render(
      <Table<Node>
        data={tree}
        columns={[{ accessorKey: 'name', header: 'Name' }]}
        getSubRows={(node) => node.children}
        enableKeyboardNavigation
      />
    )
    cellAt(0, 0).focus()
    key(cellAt(0, 0), 'ArrowRight')
    expect(screen.getByText('child')).toBeInTheDocument()
    key(cellAt(0, 0), 'ArrowLeft')
    expect(screen.queryByText('child')).not.toBeInTheDocument()
  })

  it('opens the column actions menu with Alt+ArrowDown', () => {
    render(<Table data={items} columns={columns} enableKeyboardNavigation enableColumnActions />)
    cellAt(-1, 1).focus()
    key(cellAt(-1, 1), 'ArrowDown', { altKey: true })
    expect(screen.getByRole('menu', { name: 'Team column actions' })).toBeInTheDocument()
  })

  it('scrolls to and focuses rows outside the rendered range', async () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ id: i, name: `Item ${i}`, team: 'x', score: i }))
    render(
      <Table data={many} columns={columns.slice(0, 2)} enableKeyboardNavigation enableVirtualization maxHeight={460} />
    )
    cellAt(0, 0).focus()
    act(() => {
      key(cellAt(0, 0), 'End', { ctrlKey: true })
    })
    const scroll = screen.getByRole('grid').parentElement!
    act(() => {
      fireEvent.scroll(scroll)
    })
    await waitFor(() => expect(cellAt(499, 1)).toHaveFocus())
  })
})

describe('select and multi-select filters', () => {
  const filterColumns: ColumnDef<Item>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'team', header: 'Team', filterVariant: 'select' },
    { accessorKey: 'score', header: 'Score', filterVariant: 'multi-select' }
  ]
  const names = () =>
    within(screen.getAllByRole('rowgroup')[1])
      .getAllByRole('row')
      .map((row) => within(row).getAllByRole('cell')[0].textContent)

  it('lists distinct values with counts in a select', () => {
    render(<Table data={items} columns={filterColumns} showColumnFilters />)
    const select = screen.getByRole('combobox', { name: 'Filter Team' })
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All',
      'blue (1)',
      'red (2)'
    ])
    fireEvent.change(select, { target: { value: 'red' } })
    expect(names()).toEqual(['Ada', 'Grace'])
  })

  it('selects several values from a multi-select popover', () => {
    render(<Table data={items} columns={filterColumns} showColumnFilters />)
    const button = screen.getByRole('button', { name: 'Filter Score' })
    expect(button).toHaveTextContent('All')

    fireEvent.click(button)
    const dialog = screen.getByRole('dialog', { name: 'Filter Score' })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /10/ }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /30/ }))
    expect(names()).toEqual(['Ada', 'Linus'])
    expect(button).toHaveTextContent('2 selected')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Clear' }))
    expect(names()).toHaveLength(3)
  })

  it('shows the facet range in number filter placeholders', () => {
    render(<Table data={items} columns={[{ accessorKey: 'score', header: 'Score' }]} showColumnFilters />)
    expect(screen.getByRole('spinbutton', { name: 'Filter Score from' })).toHaveAttribute('placeholder', 'Min (10)')
    expect(screen.getByRole('spinbutton', { name: 'Filter Score to' })).toHaveAttribute('placeholder', 'Max (30)')
  })
})

describe('TableExportButton', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('downloads the CSV', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:csv')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(
      <Table
        data={items}
        columns={columns}
        toolbar={(table) => <TableExportButton table={table} filename="people.csv" />}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    expect(click).toHaveBeenCalledTimes(1)
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement
    expect(anchor.download).toBe('people.csv')
    const blob = createObjectURL.mock.calls[0][0]
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsText(blob)
    })
    expect(text.replace(/^\uFEFF/, '')).toBe('Name,Team\r\nAda,red\r\nLinus,blue\r\nGrace,red')
    // Starts with a UTF-8 byte order mark (EF BB BF) so Excel reads the file as UTF-8.
    const bytes = await new Promise<Uint8Array>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
      reader.readAsArrayBuffer(blob)
    })
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
  })
})
