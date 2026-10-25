import { createEvent, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Table, TableColumnsMenu, type ColumnDef } from '../src'
import { people, type Person } from './fixtures'

const columns: ColumnDef<Person>[] = [
  { accessorKey: 'id', header: 'ID' },
  {
    header: 'Person',
    columns: [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'age', header: 'Age' }
    ]
  },
  { accessorKey: 'address.city', header: 'City' }
]

const headerTexts = () => screen.getAllByRole('columnheader').map((th) => th.textContent)
const firstRowCells = () =>
  within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row')[0].querySelectorAll('td')

describe('grouped headers', () => {
  it('renders group headers spanning their columns', () => {
    render(<Table data={people} columns={columns} />)
    const [headerRow1, headerRow2] = within(screen.getAllByRole('rowgroup')[0]).getAllByRole('row')

    const group = within(headerRow1).getByRole('columnheader', { name: 'Person' })
    expect(group).toHaveAttribute('colspan', '2')
    expect(group).toHaveAttribute('scope', 'colgroup')
    expect(group).toHaveClass('tably-th-group')
    expect(within(headerRow1).getByRole('columnheader', { name: 'ID' })).toHaveAttribute('rowspan', '2')
    expect(within(headerRow2).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Name', 'Age'])
    expect(firstRowCells()).toHaveLength(4)
  })
})

describe('TableColumnsMenu', () => {
  const renderWithMenu = () =>
    render(<Table data={people} columns={columns} toolbar={(table) => <TableColumnsMenu table={table} />} />)

  it('opens a dialog listing columns and hides unchecked ones', () => {
    renderWithMenu()
    const button = screen.getByRole('button', { name: 'Columns' })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(button)
    const menu = screen.getByRole('dialog', { name: 'Columns' })
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(within(menu).getByRole('checkbox', { name: 'ID' })).toHaveFocus()

    fireEvent.click(within(menu).getByRole('checkbox', { name: /Age/ }))
    expect(headerTexts()).toEqual(['ID', 'Person', 'City', 'Name'])
    expect(screen.getByRole('columnheader', { name: 'Person' })).not.toHaveAttribute('colspan')
    expect(firstRowCells()).toHaveLength(3)

    fireEvent.click(within(menu).getByRole('button', { name: 'Show all' }))
    expect(firstRowCells()).toHaveLength(4)
  })

  it('reorders columns and resets', () => {
    renderWithMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }))
    const menu = screen.getByRole('dialog')

    expect(within(menu).getByRole('button', { name: 'Move ID up' })).toBeDisabled()
    fireEvent.click(within(menu).getByRole('button', { name: 'Move City up' }))
    expect(Array.from(firstRowCells()).map((td) => td.textContent)).toEqual(['1', 'Ada', 'London', '36'])

    fireEvent.click(within(menu).getByRole('checkbox', { name: 'ID' }))
    fireEvent.click(within(menu).getByRole('button', { name: 'Reset' }))
    expect(Array.from(firstRowCells()).map((td) => td.textContent)).toEqual(['1', 'Ada', '36', 'London'])
  })

  it('closes on Escape, returning focus, and on outside clicks', () => {
    renderWithMenu()
    const button = screen.getByRole('button', { name: 'Columns' })

    fireEvent.click(button)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()

    fireEvent.click(button)
    fireEvent.pointerDown(screen.getByRole('dialog'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('disables columns that cannot hide', () => {
    render(
      <Table
        data={people}
        columns={[{ accessorKey: 'name', header: 'Name', enableHiding: false }]}
        toolbar={(table) => <TableColumnsMenu table={table} enableOrdering={false} />}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }))
    expect(screen.getByRole('checkbox', { name: 'Name' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Move/ })).not.toBeInTheDocument()
  })
})

describe('column dragging', () => {
  const drag = (source: HTMLElement, target: HTMLElement) => {
    const dataTransfer = { setData: () => {}, effectAllowed: '', dropEffect: '' }
    fireEvent(source, Object.assign(createEvent.dragStart(source), { dataTransfer }))
    fireEvent(target, Object.assign(createEvent.dragOver(target), { dataTransfer }))
    expect(target).toHaveAttribute('data-drop-target')
    fireEvent(target, Object.assign(createEvent.drop(target), { dataTransfer }))
    fireEvent(source, Object.assign(createEvent.dragEnd(source), { dataTransfer }))
  }

  it('moves a column onto the position of the header it is dropped on', () => {
    render(<Table data={people} columns={columns} enableColumnDragging />)
    const city = screen.getByRole('columnheader', { name: 'City' })
    expect(city).toHaveAttribute('draggable', 'true')
    expect(screen.getByRole('columnheader', { name: 'Person' })).not.toHaveAttribute('draggable')

    drag(city, screen.getByRole('columnheader', { name: 'ID' }))
    expect(Array.from(firstRowCells()).map((td) => td.textContent)).toEqual(['London', '1', 'Ada', '36'])
  })

  it('is off by default', () => {
    render(<Table data={people} columns={columns} />)
    expect(screen.getByRole('columnheader', { name: 'City' })).not.toHaveAttribute('draggable')
  })
})
