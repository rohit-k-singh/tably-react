import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Table, useVirtualizer, type ColumnDef } from '../src'

interface Item {
  id: number
  name: string
}

const items: Item[] = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }))
const columns: ColumnDef<Item>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' }
]

describe('useVirtualizer', () => {
  const setup = (overrides: Partial<Parameters<typeof useVirtualizer>[0]> = {}) =>
    renderHook(() =>
      useVirtualizer({
        count: 100,
        estimateSize: () => 20,
        getScrollElement: () => null,
        overscan: 2,
        initialViewportHeight: 100,
        ...overrides
      })
    )

  it('returns the visible items plus overscan, and the surrounding space', () => {
    const { result } = setup()
    // 100px / 20px = 5 visible items (0–4), plus 2 overscan.
    expect(result.current.items.map((item) => item.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(result.current.totalSize).toBe(2000)
    expect(result.current.paddingStart).toBe(0)
    expect(result.current.paddingEnd).toBe(2000 - 7 * 20)
    expect(result.current.items[3]).toEqual({ index: 3, key: 3, start: 60, size: 20 })
  })

  it('uses per-item estimates and keys', () => {
    const { result } = setup({ estimateSize: (index) => (index % 2 ? 30 : 10), getItemKey: (index) => `k${index}` })
    expect(result.current.items[2]).toEqual({ index: 2, key: 'k2', start: 40, size: 10 })
    expect(result.current.totalSize).toBe(2000)
  })

  it('returns every item when disabled or empty', () => {
    expect(setup({ enabled: false }).result.current.items).toHaveLength(100)
    expect(setup({ enabled: false }).result.current.paddingEnd).toBe(0)
    expect(setup({ count: 0 }).result.current.items).toEqual([])
  })
})

describe('Table virtualization', () => {
  const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).queryAllByRole('row')

  it('renders only the rows in view, with spacers and ARIA row positions', () => {
    const { container } = render(
      <Table data={items} columns={columns} enableVirtualization maxHeight={460} estimateRowHeight={46} overscan={5} />
    )

    // 460px / 46px = 10 visible rows, plus 5 overscan below.
    expect(bodyRows()).toHaveLength(15)
    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '1001')
    expect(bodyRows()[0]).toHaveAttribute('aria-rowindex', '2')
    expect(screen.getAllByRole('row')[0]).toHaveAttribute('aria-rowindex', '1')

    const spacers = container.querySelectorAll('.tably-spacer')
    expect(spacers).toHaveLength(1)
    expect(spacers[0]).toHaveStyle({ height: `${(1000 - 15) * 46}px` })
    expect(spacers[0]).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('table').parentElement).toHaveStyle({ maxHeight: '460px' })
  })

  it('renders the rows at the scroll position', async () => {
    render(<Table data={items} columns={columns} enableVirtualization maxHeight={460} estimateRowHeight={46} overscan={2} />)
    const scroll = screen.getByRole('table').parentElement!

    act(() => {
      scroll.scrollTop = 46 * 500
      fireEvent.scroll(scroll)
    })
    await waitFor(() => expect(screen.getByText('Item 500')).toBeInTheDocument())
    expect(screen.queryByText('Item 0')).not.toBeInTheDocument()
    expect(screen.getByText('Item 500').closest('tr')).toHaveAttribute('aria-rowindex', '502')
  })

  it('keeps stripes and indexes with the data order', () => {
    render(<Table data={items.slice(0, 4)} columns={columns} striped enableVirtualization />)
    expect(bodyRows().map((row) => row.hasAttribute('data-stripe'))).toEqual([false, true, false, true])
  })

  it('uses a default height and leaves non-virtualized tables unchanged', () => {
    const { rerender } = render(<Table data={items.slice(0, 50)} columns={columns} enableVirtualization />)
    expect(screen.getByRole('table').parentElement).toHaveStyle({ maxHeight: '600px' })

    rerender(<Table data={items.slice(0, 50)} columns={columns} />)
    expect(bodyRows()).toHaveLength(50)
    expect(screen.getByRole('table')).not.toHaveAttribute('aria-rowcount')
    expect(bodyRows()[0]).not.toHaveAttribute('aria-rowindex')
  })
})
