import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Table, type ColumnDef } from '../src'
import { people, type Person } from './fixtures'

const columns: ColumnDef<Person>[] = [
  { accessorKey: 'id', header: 'ID', width: 60 },
  { accessorKey: 'name', header: 'Name', width: 200 },
  { accessorKey: 'age', header: 'Age' }
]

const headerTexts = () => screen.getAllByRole('columnheader').map((th) => th.textContent)

describe('column actions menu', () => {
  it('opens a menu with keyboard navigation and runs actions', async () => {
    render(<Table data={people} columns={columns} enableColumnActions />)
    const button = screen.getByRole('button', { name: 'Name column actions' })
    expect(button).toHaveAttribute('aria-haspopup', 'menu')

    fireEvent.click(button)
    const menu = screen.getByRole('menu', { name: 'Name column actions' })
    const items = within(menu).getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Sort ascending',
      'Sort descending',
      'Pin to left',
      'Pin to right',
      'Group by this column',
      'Hide column'
    ])
    expect(items[0]).toHaveFocus()

    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(items[5]).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'Home' })
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(items[1]).toHaveFocus()

    fireEvent.click(items[1])
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await waitFor(() => expect(button).toHaveFocus())
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'descending')

    fireEvent.click(button)
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map((item) => item.textContent)).toContain(
      'Clear sort'
    )
  })

  it('opens with ArrowDown and closes with Escape', async () => {
    render(<Table data={people} columns={columns} enableColumnActions />)
    const button = screen.getByRole('button', { name: 'Age column actions' })

    fireEvent.keyDown(button, { key: 'ArrowDown' })
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await waitFor(() => expect(button).toHaveFocus())
  })

  it('pins columns as sticky cells and hides columns', async () => {
    render(<Table data={people} columns={columns} enableColumnActions />)

    fireEvent.click(screen.getByRole('button', { name: 'Age column actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pin to left' }))
    expect(headerTexts()[0]).toBe('Age')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Age column actions' })).toHaveFocus())

    const ageHeader = screen.getAllByRole('columnheader')[0]
    expect(ageHeader).toHaveAttribute('data-pinned', 'left')
    expect(ageHeader).toHaveAttribute('data-pinned-edge')
    expect(ageHeader).toHaveStyle({ position: 'sticky', width: '150px' })
    expect(screen.getByText('36').closest('td')).toHaveAttribute('data-pinned', 'left')

    fireEvent.click(screen.getByRole('button', { name: 'Age column actions' }))
    expect(screen.getByRole('menuitem', { name: 'Unpin' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hide column' }))
    expect(headerTexts()).toEqual(['ID', 'Name'])
  })

  it('is hidden by default', () => {
    render(<Table data={people} columns={columns} />)
    expect(screen.queryByRole('button', { name: /column actions/ })).not.toBeInTheDocument()
  })
})

describe('column resizing', () => {
  it('uses a fixed layout with a colgroup sized from the columns', () => {
    const { container } = render(<Table data={people} columns={columns} enableColumnResizing />)
    const table = screen.getByRole('table')

    expect(table).toHaveStyle({ tableLayout: 'fixed', width: '410px' })
    expect(Array.from(container.querySelectorAll('col')).map((col) => col.style.width)).toEqual([
      '60px',
      '200px',
      '150px'
    ])
  })

  it('resizes with the keyboard and resets with Enter', () => {
    render(<Table data={people} columns={columns} enableColumnResizing />)
    const handle = screen.getByRole('separator', { name: 'Resize Name' })
    expect(handle).toHaveAttribute('aria-valuenow', '200')
    expect(handle).toHaveAttribute('aria-valuemin', '40')

    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(handle).toHaveAttribute('aria-valuenow', '210')
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true })
    expect(handle).toHaveAttribute('aria-valuenow', '160')
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(handle).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getByRole('table')).toHaveStyle({ width: '250px' })

    fireEvent.keyDown(handle, { key: 'Enter' })
    expect(handle).toHaveAttribute('aria-valuenow', '200')
  })

  it('resizes by dragging and resets on double-click', () => {
    render(<Table data={people} columns={columns} enableColumnResizing />)
    const handle = screen.getByRole('separator', { name: 'Resize Age' })

    fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 160, pointerId: 1 })
    fireEvent.pointerUp(handle, { pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 400, pointerId: 1 })

    // jsdom has no layout, so the drag starts from getSize() (150).
    expect(handle).toHaveAttribute('aria-valuenow', '210')
    fireEvent.doubleClick(handle)
    expect(handle).toHaveAttribute('aria-valuenow', '150')
  })

  it('does not render handles unless enabled', () => {
    render(<Table data={people} columns={columns} />)
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
    expect(screen.getByRole('table')).not.toHaveStyle({ tableLayout: 'fixed' })
  })
})

describe('sticky header', () => {
  it('marks the container and limits the scroll height', () => {
    render(<Table data={people} columns={columns} stickyHeader maxHeight={300} />)
    expect(screen.getByRole('table').closest('.tably-container')).toHaveAttribute('data-sticky-header')
    expect(screen.getByRole('table').parentElement).toHaveStyle({ maxHeight: '300px' })
  })
})
