import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Table, TableLocaleProvider, TablePagination, TableSearch, useTable, type ColumnDef } from '../src'
import { people, type Person } from './fixtures'

const columns: ColumnDef<Person>[] = [
  { accessorKey: 'name', header: 'Name', width: 200, minWidth: '8rem' },
  { accessorKey: 'age', header: 'Age', align: 'end' }
]

const container = () => screen.getByRole('table').closest('.tably-container')!

describe('appearance options', () => {
  it('sets data attributes for theme, density and row styles', () => {
    const { rerender } = render(<Table data={people} columns={columns} />)
    for (const attribute of ['data-theme', 'data-density', 'data-striped', 'data-hover', 'data-bordered']) {
      expect(container()).not.toHaveAttribute(attribute)
    }

    rerender(<Table data={people} columns={columns} theme="dark" density="compact" striped highlightOnHover bordered />)
    expect(container()).toHaveAttribute('data-theme', 'dark')
    expect(container()).toHaveAttribute('data-density', 'compact')
    expect(container()).toHaveAttribute('data-striped')
    expect(container()).toHaveAttribute('data-hover')
    expect(container()).toHaveAttribute('data-bordered')

    rerender(<Table data={people} columns={columns} density="standard" />)
    expect(container()).not.toHaveAttribute('data-density')
  })

  it('applies column alignment and widths to header and body cells', () => {
    render(<Table data={people} columns={columns} />)

    const [nameHeader, ageHeader] = screen.getAllByRole('columnheader')
    expect(nameHeader).toHaveStyle({ width: '200px', minWidth: '8rem' })
    expect(ageHeader).toHaveAttribute('data-align', 'end')
    expect(screen.getByText('36')).toHaveAttribute('data-align', 'end')
    expect(screen.getByText('Ada')).toHaveStyle({ width: '200px' })
    expect(screen.getByText('Ada')).not.toHaveAttribute('data-align')
  })

  it('renders a caption that names the table', () => {
    render(<Table data={people} columns={columns} caption="Team members" />)
    expect(screen.getByRole('table', { name: 'Team members' })).toBeInTheDocument()
  })

  it('renders a custom loading indicator', () => {
    render(<Table data={people} columns={columns} loading loadingIndicator={<span>Fetching…</span>} />)
    expect(screen.getByText('Fetching…').closest('td')).toHaveClass('tably-loading')
  })
})

describe('class names and row props', () => {
  it('adds class names to every part of the table', () => {
    render(
      <Table
        data={people.slice(0, 1)}
        columns={columns}
        caption="Caption"
        showColumnFilters
        enablePagination
        toolbar="Tools"
        classNames={{
          container: 'c-container',
          toolbar: 'c-toolbar',
          scroll: 'c-scroll',
          table: 'c-table',
          caption: 'c-caption',
          thead: 'c-thead',
          headerRow: 'c-header-row',
          th: 'c-th',
          filterRow: 'c-filter-row',
          filterCell: 'c-filter-cell',
          tbody: 'c-tbody',
          tr: 'c-tr',
          td: 'c-td',
          footer: 'c-footer'
        }}
      />
    )

    for (const name of [
      'container',
      'toolbar',
      'scroll',
      'table',
      'caption',
      'thead',
      'header-row',
      'th',
      'filter-row',
      'filter-cell',
      'tbody',
      'tr',
      'td',
      'footer'
    ]) {
      expect(document.querySelector(`.c-${name}`), name).not.toBeNull()
    }
  })

  it('adds class names to empty and loading cells', () => {
    const { rerender } = render(<Table data={[]} columns={columns} classNames={{ empty: 'c-empty' }} />)
    expect(screen.getByText('No data available')).toHaveClass('c-empty')
    rerender(<Table data={[]} columns={columns} loading classNames={{ loading: 'c-loading' }} />)
    expect(screen.getByRole('status').closest('td')).toHaveClass('c-loading')
  })

  it('adds row class names and props, and composes row handlers', () => {
    const onClick = vi.fn()
    const onRowClick = vi.fn()
    render(
      <Table
        data={people}
        columns={columns}
        rowClassName={(row) => (row.original.active ? 'is-active' : undefined)}
        getRowProps={(row) => ({ 'data-person': row.original.id, className: 'extra', onClick })}
        onRowClick={onRowClick}
      />
    )

    const adaRow = screen.getByText('Ada').closest('tr')!
    expect(adaRow).toHaveClass('tably-tr', 'is-active', 'extra')
    expect(adaRow).toHaveAttribute('data-person', '1')
    expect(screen.getByText('Linus').closest('tr')).not.toHaveClass('is-active')

    fireEvent.click(adaRow)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onRowClick).toHaveBeenCalledWith(people[0], expect.anything())
  })

  it('lets a row handler prevent onRowClick', () => {
    const onRowClick = vi.fn()
    render(
      <Table
        data={people}
        columns={columns}
        getRowProps={() => ({ onClick: (event) => event.preventDefault() })}
        onRowClick={onRowClick}
      />
    )
    fireEvent.click(screen.getByText('Ada').closest('tr')!)
    expect(onRowClick).not.toHaveBeenCalled()
  })
})

describe('locale text', () => {
  const german = {
    empty: 'Keine Daten',
    searchLabel: 'Suche',
    searchPlaceholder: 'Suchen…',
    filterLabel: (column: string) => `${column} filtern`,
    rowsPerPage: 'Zeilen pro Seite',
    pageRange: (from: number, to: number, total: number) => `${from}–${to} von ${total}`,
    pageStatus: (page: number, count: number) => `Seite ${page} von ${count}`,
    nextPage: 'Nächste Seite'
  }

  it('translates the table, toolbar search, filters and pagination', () => {
    render(
      <Table
        data={people}
        columns={columns}
        localeText={german}
        showColumnFilters
        enablePagination
        toolbar={(table) => <TableSearch table={table} />}
      />
    )

    expect(screen.getByRole('searchbox', { name: 'Suche' })).toHaveAttribute('placeholder', 'Suchen…')
    expect(screen.getByRole('searchbox', { name: 'Name filtern' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Zeilen pro Seite' })).toBeInTheDocument()
    expect(screen.getByText('1–3 von 3')).toBeInTheDocument()
    expect(screen.getByText('Seite 1 von 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nächste Seite' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument()
  })

  it('prefers emptyMessage over locale text', () => {
    const { rerender } = render(<Table data={[]} columns={columns} localeText={german} />)
    expect(screen.getByText('Keine Daten')).toBeInTheDocument()
    rerender(<Table data={[]} columns={columns} localeText={german} emptyMessage="Leer" />)
    expect(screen.getByText('Leer')).toBeInTheDocument()
  })

  it('applies a provider to standalone components and merges nested providers', () => {
    function Headless() {
      const table = useTable({ data: people, columns, enablePagination: true })
      return (
        <>
          <TableSearch table={table} />
          <TablePagination table={table} />
        </>
      )
    }

    render(
      <TableLocaleProvider localeText={german}>
        <TableLocaleProvider localeText={{ nextPage: 'Weiter' }}>
          <Headless />
        </TableLocaleProvider>
      </TableLocaleProvider>
    )

    expect(screen.getByRole('searchbox', { name: 'Suche' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation')
    expect(within(nav).getByRole('button', { name: 'Weiter' })).toBeInTheDocument()
    expect(within(nav).getByText('Seite 1 von 1')).toBeInTheDocument()
  })
})

describe('stylesheet', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

  const splitTopLevel = (selector: string) => {
    const parts: string[] = []
    let depth = 0
    let current = ''
    for (const char of selector) {
      if (char === '(') depth++
      if (char === ')') depth--
      if (char === ',' && depth === 0) {
        parts.push(current)
        current = ''
      } else {
        current += char
      }
    }
    return [...parts, current]
  }

  it('keeps every rule at zero specificity', () => {
    const selectors = css
      .split('}')
      .map((block) => block.split('{')[0].trim())
      .filter((selector) => selector && !selector.startsWith('@') && !/^(to|from|\d+%)$/.test(selector))
    for (const selector of selectors) {
      for (const part of splitTopLevel(selector)) {
        expect(part.trim(), selector).toMatch(/^:where\(/)
      }
    }
  })

  it('reads every public variable with a fallback, so it can be set on any ancestor', () => {
    const declarations = css.match(/--tably-[a-z-]+\s*:/g)
    expect(declarations).toBeNull()
    for (const [, name] of css.matchAll(/var\(--tably-([a-z-]+)\)/g)) {
      expect(name).toBe('font-family')
    }
  })
})
