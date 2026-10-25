# tably-react

A customizable React table component written in TypeScript, with zero runtime dependencies.

- Fully typed columns, including nested `accessorKey` paths such as `'address.city'`
- Headless `useTable` hook for custom markup, plus a ready-made `<Table>` component
- No runtime dependencies; works with React 18 and 19
- Optional, framework-agnostic stylesheet: light / dark / auto themes, three densities, striped and bordered rows,
  all adjustable with CSS variables
- Class name slots for every part (works with Tailwind), row props, and translatable texts
- ESM and CommonJS builds, server-rendering safe (`'use client'` included for React Server Components)
- Sorting: multi-column, natural string order, custom comparators, client or server side
- Filtering: global search, per-column filters with built-in controls, custom filter functions, client or server side
- Pagination: page navigation and page size, client or server side
- Accessible: sort buttons with `aria-sort`, keyboard-operable clickable rows, `aria-busy` while loading

> **Status: early release (0.x).** The API may still change between minor versions until 1.0.

## Installation

```bash
npm install tably-react
```

## Usage

```tsx
import { Table, type ColumnDef } from 'tably-react'
import 'tably-react/styles.css'

interface User {
  id: number
  name: string
  age: number
  address: { city: string }
}

const columns: ColumnDef<User>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'address.city', header: 'City' },
  { accessorKey: 'age', header: 'Age', cell: ({ getValue }) => `${getValue()} years` }, // getValue(): number
  { id: 'actions', header: '', cell: ({ row }) => <button onClick={() => edit(row.original)}>Edit</button> }
]

export function Users({ users }: { users: User[] }) {
  return <Table aria-label="Users" data={users} columns={columns} getRowId={(user) => String(user.id)} />
}
```

Define `columns` outside the component (or wrap it in `useMemo`) and keep `data` referentially stable, so rows are
only recomputed when they actually change.

## Columns

There are three kinds of column definitions:

| Kind | Required fields | Value |
| --- | --- | --- |
| Accessor key | `accessorKey` | Row property at a path, e.g. `'name'` or `'address.city'`. The path is type-checked. |
| Accessor function | `id`, `accessorFn` | Computed from the row: `accessorFn: (row, index) => row.price * row.quantity` |
| Display | `id` | No value; for content such as action buttons. |

Every column accepts:

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique id. Defaults to `accessorKey`. |
| `header` | `ReactNode \| (context) => ReactNode \| Component` | Header content. Defaults to the column id. Context: `{ table, column }`. |
| `cell` | `ReactNode \| (context) => ReactNode \| Component` | Cell content. Defaults to the formatted value. Context: `{ table, column, row, cell, getValue }`. |
| `align` | `'start' \| 'center' \| 'end'` | Alignment of the header and body cells, e.g. `'end'` for numbers. |
| `width`, `minWidth`, `maxWidth` | `number \| string` | Column size in pixels or any CSS length. |
| `className` | `string` | Class added to the column's body cells. |
| `headerClassName` | `string` | Class added to the column's header cell. |
| `meta` | `ColumnMeta` | Your own data. Type it with declaration merging (see below). |

Without a `cell` renderer, values are formatted as follows: strings and numbers as is, booleans as `true` / `false`,
dates with `toLocaleString()`, arrays joined with `, `, and `null` / `undefined` as an empty cell.

With `accessorKey`, `getValue()` is typed from the row property. For a typed `accessorFn`, use the column helper:

```ts
import { createColumnHelper } from 'tably-react'

const column = createColumnHelper<User>()

const columns = [
  column.accessor('address.city', { header: 'City' }),
  column.accessor((user) => user.age * 12, {
    id: 'months',
    header: 'Age (months)',
    cell: ({ getValue }) => getValue().toLocaleString() // getValue(): number
  }),
  column.display({ id: 'actions', cell: ({ row }) => <RowActions user={row.original} /> })
]
```

Type `meta` for every column with declaration merging:

```ts
declare module 'tably-react' {
  interface ColumnMeta<TData, TValue> {
    tooltip?: string
  }
}
```

## Sorting

Every column with a value is sortable by default. Click a header to cycle ascending → descending → unsorted;
Shift-click to sort by several columns. Disable it per column with `enableSorting: false`, or for the whole table with
`enableSorting={false}`.

Column options:

| Option | Default | Description |
| --- | --- | --- |
| `enableSorting` | `true` | Allow sorting by this column. |
| `sortingFn` | `'auto'` | `'alphanumeric'`, `'alphanumericCaseSensitive'`, `'text'`, `'textCaseSensitive'`, `'datetime'`, `'basic'`, or `(rowA, rowB, columnId) => number`. `'auto'` uses `datetime` for dates, `alphanumeric` (natural order: "item 2" before "item 10") for strings and `basic` otherwise. |
| `sortDescFirst` | `false` | Sort descending on the first click. |
| `invertSorting` | `false` | Reverse the order, e.g. for rankings where lower is better. |
| `sortUndefined` | `'last'` | Where `null` / `undefined` go regardless of direction: `'first'`, `'last'`, or `false` to pass them to `sortingFn`. |

Table options:

| Option | Default | Description |
| --- | --- | --- |
| `initialState.sorting` | `[]` | Starting sort, e.g. `[{ id: 'age', desc: true }]`. |
| `state.sorting` / `onSortingChange` | | Control the sorting state yourself. |
| `enableSorting` | `true` | Allow sorting at all. |
| `enableMultiSort` | `true` | Allow sorting by several columns. |
| `maxMultiSortColCount` | unlimited | Maximum number of sorted columns. |
| `isMultiSortEvent` | Shift held | `(event) => boolean` deciding whether a click adds to the sort. |
| `enableSortingRemoval` | `true` | Whether the cycle returns to unsorted. |
| `sortDescFirst` | `false` | Sort descending on the first click, for every column. |
| `manualSorting` | `false` | Rows are sorted elsewhere (e.g. by your API); only the state is tracked. |

Server-side sorting:

```tsx
const [sorting, setSorting] = useState<SortingState>([])
const { data } = useQuery({ queryKey: ['users', sorting], queryFn: () => fetchUsers({ sorting }) })

<Table data={data ?? []} columns={columns} manualSorting state={{ sorting }} onSortingChange={setSorting} />
```

## Filtering

Add a search box and a row of column filters:

```tsx
import { Table, TableSearch } from 'tably-react'

<Table data={users} columns={columns} showColumnFilters toolbar={(table) => <TableSearch table={table} />} />
```

The global search matches every string and number column (case-insensitive substring). Column filters pick a
filter function and a control from the column's values:

| Values | Filter function | Default control |
| --- | --- | --- |
| Strings | `includesString` | Text input |
| Numbers | `inNumberRange` (`[min, max]`, either end optional) | Min / max inputs |
| Dates | `inDateRange` (`[from, to]`, a date-only `to` includes the whole day) | From / to date inputs |
| Booleans | `equals` | All / Yes / No select |
| Arrays | `arrIncludes` | Text input |

Other built-in functions: `includesStringSensitive`, `equalsString`, `weakEquals`, `arrIncludesAll`, `arrIncludesSome` and
`inArray` (the value is one of the selected items). Empty filter values (`''`, `undefined`, `[]`, `[undefined, undefined]`)
remove the filter.

Column options:

| Option | Default | Description |
| --- | --- | --- |
| `enableColumnFilter` | `true` | Allow filtering this column. |
| `filterFn` | `'auto'` | A built-in name or `(row, columnId, filterValue) => boolean`. Give a custom function an `autoRemove(value)` property to decide when a value clears the filter. |
| `enableGlobalFilter` | string / number columns | Include this column in the global search. |
| `filter` | built-in control | Custom control for the filter row: `({ column }) => <MySelect value={column.getFilterValue()} onChange={column.setFilterValue} />` |

Table options and props:

| Option | Default | Description |
| --- | --- | --- |
| `initialState.columnFilters` / `initialState.globalFilter` | | Starting filters, e.g. `[{ id: 'age', value: [18, 65] }]`. |
| `state.columnFilters` + `onColumnFiltersChange`, `state.globalFilter` + `onGlobalFilterChange` | | Control the filters yourself. |
| `enableFilters`, `enableColumnFilters`, `enableGlobalFilter` | `true` | Turn filtering off entirely, or one kind of it. |
| `globalFilterFn` | `'includesString'` | How the search matches each column value. |
| `manualFiltering` | `false` | Rows are filtered elsewhere (e.g. by your API); only the state is tracked. |
| `showColumnFilters` | `false` | Show the filter row (`<Table>` only). |
| `filterDebounceMs` | `200` | Delay before typed column filters apply (`<Table>` only). |
| `toolbar` | | Content above the table, as a node or `(table) => node` (`<Table>` only). |
| `noResultsMessage` | `'No matching results'` | Shown when filters match no rows (`<Table>` only). |

`<TableSearch>` accepts `table`, `placeholder`, `debounceMs` (default `200`), `className` and `aria-label` (default
`"Search"`). `<ColumnFilter table column />` is the default filter control, for use in your own layouts.

In code, use `column.setFilterValue(value)`, `column.getFilterValue()`, `table.setGlobalFilter(value)`,
`table.resetColumnFilters()` and `table.resetGlobalFilter()`.

## Pagination

```tsx
<Table data={users} columns={columns} enablePagination />
```

This splits rows into pages of 10 and adds a footer with a page size select, the visible range ("11–20 of 57") and
first / previous / next / last buttons. Sorting or filtering returns to the first page (turn that off with
`autoResetPageIndex={false}`). When the data shrinks, the last available page is shown.

| Option | Default | Description |
| --- | --- | --- |
| `enablePagination` | `false` | Split rows into pages. |
| `initialState.pagination` | `{ pageIndex: 0, pageSize: 10 }` | Starting page (zero-based) and page size. |
| `state.pagination` + `onPaginationChange` | | Control the pagination yourself. |
| `pageSizeOptions` | `[10, 20, 50, 100]` | Page size choices; `[]` hides the select (`<Table>` only). |
| `autoResetPageIndex` | `true` | Go back to the first page when sorting or filters change. |
| `manualPagination` | `false` | `data` is the current page, loaded elsewhere (e.g. by your API). |
| `rowCount` / `pageCount` | | Total rows or pages, for manual pagination. Without either, the total is shown as unknown. |

Server-side pagination, sorting and filtering together:

```tsx
const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
const [sorting, setSorting] = useState<SortingState>([])
const [globalFilter, setGlobalFilter] = useState('')
const { data } = useQuery({
  queryKey: ['users', pagination, sorting, globalFilter],
  queryFn: () => fetchUsers({ pagination, sorting, search: globalFilter })
})

<Table
  data={data?.rows ?? []}
  rowCount={data?.total}
  columns={columns}
  enablePagination
  manualPagination
  manualSorting
  manualFiltering
  state={{ pagination, sorting, globalFilter }}
  onPaginationChange={setPagination}
  onSortingChange={setSorting}
  onGlobalFilterChange={setGlobalFilter}
  toolbar={(table) => <TableSearch table={table} />}
  loading={!data}
/>
```

In code: `table.nextPage()`, `previousPage()`, `firstPage()`, `lastPage()`, `setPageIndex(i)`, `setPageSize(n)`,
`getPageIndex()`, `getPageCount()`, `getRowCount()`, `getCanNextPage()` and `getCanPreviousPage()`.
`<TablePagination table />` is the footer component, for custom layouts; it accepts `pageSizeOptions` and
`showFirstLastButtons`.

## `<Table>` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `T[]` | required | Rows to display. |
| `columns` | `ColumnDef<T>[]` | required | Column definitions. |
| `getRowId` | `(row, index) => string` | row index | Stable id per row. Provide it when rows can be reordered, added or removed. |
| `initialState`, `state` | `Partial<TableState>` | | Uncontrolled starting state, and controlled state. |
| Feature options | | | See [Sorting](#sorting), [Filtering](#filtering) and [Pagination](#pagination). |
| `onRowClick` | `(original, row) => void` | | Makes rows clickable and keyboard-operable (Enter / Space). Call `event.stopPropagation()` in buttons inside rows to avoid triggering it. |
| `loading` | `boolean` | `false` | Replaces the body with a loading indicator and sets `aria-busy`. |
| `emptyMessage` | `ReactNode` | `'No data available'` | Shown when there are no rows. |
| `className` | `string` | | Class added to the outer container. |
| `classNames` | `TableClassNames` | | Classes for each part: `container`, `toolbar`, `scroll`, `table`, `caption`, `thead`, `headerRow`, `th`, `filterRow`, `filterCell`, `tbody`, `tr`, `td`, `empty`, `loading`, `footer`. |
| `rowClassName` | `string \| (row) => string` | | Class for each body row. |
| `getRowProps` | `(row) => attributes` | | Extra attributes or handlers for each body row. Calling `event.preventDefault()` in its `onClick` skips `onRowClick`. |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` | Theme of the default stylesheet; `'auto'` follows the OS. |
| `density` | `'compact' \| 'standard' \| 'comfortable'` | `'standard'` | Cell spacing. |
| `striped`, `highlightOnHover`, `bordered` | `boolean` | `false` | Alternate row backgrounds, highlight the hovered row, borders between columns. |
| `caption` | `ReactNode` | | Visible caption, also the table's accessible name. |
| `loadingIndicator` | `ReactNode` | spinner | Replaces the loading spinner. |
| `localeText` | `Partial<TableLocaleText>` | English | Built-in texts. See [Translation](#translation). |
| `aria-label` | `string` | | Accessible name for the table. |

## Translation

Every built-in text can be replaced, per table with `localeText` or for a whole app with `TableLocaleProvider`
(which also covers `TableSearch` and `TablePagination` used on their own):

```tsx
import { TableLocaleProvider } from 'tably-react'

<TableLocaleProvider
  localeText={{
    empty: 'Keine Daten',
    noResults: 'Keine Treffer',
    searchLabel: 'Suche',
    searchPlaceholder: 'Suchen…',
    filterLabel: (column) => `${column} filtern`,
    rowsPerPage: 'Zeilen pro Seite',
    pageRange: (from, to, total) => (total === -1 ? `${from}–${to}` : `${from}–${to} von ${total}`),
    pageStatus: (page, count) => (count === -1 ? `Seite ${page}` : `Seite ${page} von ${count}`),
    previousPage: 'Vorherige Seite',
    nextPage: 'Nächste Seite'
  }}
>
  <App />
</TableLocaleProvider>
```

See `TableLocaleText` for the full list; `defaultLocaleText` holds the English defaults.

## Headless usage

`useTable` contains all the table logic without any markup, so you can render the table however you like:

```tsx
import { flexRender, useTable } from 'tably-react'

function MyTable({ data }: { data: User[] }) {
  const table = useTable({ data, columns })

  return (
    <table>
      <thead>
        <tr>
          {table.getAllColumns().map((column) => (
            <th key={column.id} onClick={column.getToggleSortingHandler()}>
              {flexRender(column.columnDef.header ?? column.id, { table, column })}
              {column.getIsSorted() === 'asc' ? ' ▲' : column.getIsSorted() === 'desc' ? ' ▼' : null}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getCells().map((cell) => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell ?? String(cell.getValue() ?? ''), cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

`createTable` is the same engine without React, for use in other frameworks or on the server. It expects the full
state in `options.state` (start from `getDefaultTableState()`) and reports changes through `options.onStateChange`.

## Styling

`tably-react/styles.css` is optional. Every rule in it has zero specificity (`:where(...)`), so any class you add,
whether plain CSS, CSS modules or Tailwind utilities, takes precedence without `!important`.

Pick a built-in look with props:

```tsx
<Table data={users} columns={columns} theme="auto" density="compact" striped highlightOnHover bordered />
```

`theme="auto"` follows the OS setting. Alternatively, put `data-tably-theme="dark"` on any ancestor (e.g. `<html>`) to
switch every table inside it to dark, unless the table sets `theme="light"`.

Adjust colors and spacing with CSS variables, on the table (`className`) or any ancestor, e.g. `:root`. They apply to
both themes:

```css
:root {
  --tably-header-bg: #111827;
  --tably-header-color: #f9fafb;
  --tably-row-hover-bg: #eef2ff;
  --tably-cell-padding-y: 0.5rem;
}
```

With Tailwind, use `classNames` (and skip the stylesheet if you style everything yourself):

```tsx
<Table
  data={users}
  columns={columns}
  classNames={{
    container: 'rounded-lg border border-gray-200',
    th: 'bg-gray-50 px-4 py-2 text-left text-sm font-semibold',
    td: 'px-4 py-2 text-sm',
    tr: 'border-t border-gray-100 hover:bg-gray-50'
  }}
/>
```

| Variable | Purpose |
| --- | --- |
| `--tably-font-family`, `--tably-font-size` | Typography |
| `--tably-color`, `--tably-bg`, `--tably-muted-color` | Text, background, and empty / loading text colors |
| `--tably-border-color`, `--tably-radius` | Borders and corner radius |
| `--tably-header-bg`, `--tably-header-color`, `--tably-header-font-weight` | Header cells |
| `--tably-cell-padding-y`, `--tably-cell-padding-x` | Cell padding (density) |
| `--tably-row-hover-bg`, `--tably-focus-ring` | Interactive rows |
| `--tably-spinner-color`, `--tably-spinner-size` | Loading indicator |
| `--tably-sort-indicator-color`, `--tably-sort-indicator-active-color` | Sort arrows |
| `--tably-input-bg`, `--tably-input-border-color`, `--tably-input-radius` | Search and filter inputs |
| `--tably-stripe-bg` | Background of alternate rows with `striped` |

To style from scratch, skip the stylesheet and target the class names: `tably-container`, `tably-toolbar`,
`tably-search`, `tably-scroll`, `tably-footer`, `tably-pagination`, `tably-page-size`, `tably-page-range`, `tably-page-nav`,
`tably-page-button`, `tably-page-status`, `tably-caption`, `tably-table`, `tably-filter-row`, `tably-filter-cell`, `tably-input`, `tably-no-results`, `tably-thead`,
`tably-th`, `tably-th-sortable`, `tably-sort-button`, `tably-sort-indicator`, `tably-sort-index`, `tably-tbody`, `tably-tr`, `tably-tr-clickable`, `tably-td`, `tably-empty`, `tably-loading`, `tably-spinner`.

## Development

```bash
npm install
npm run dev            # playground at http://localhost:5173
npm test               # unit tests (Vitest + Testing Library)
npm run typecheck
npm run build          # ESM + CJS + type declarations into dist/
npm run check:package  # validate the published package shape (publint, are-the-types-wrong)
```

## Migrating from the 1.0.x prototype

The 1.0.x releases were an early prototype. 0.0.1 restarts versioning with a new API:

| 1.0.x | 0.0.1 |
| --- | --- |
| `{ key: 'name', header: 'Name' }` | `{ accessorKey: 'name', header: 'Name' }` |
| `render: (value, row) => ...` | `cell: ({ getValue, row }) => ...` (`row.original` is the row object) |
| `onRowClick(row)` | `onRowClick(original, row)` |
| `TableColumn<T>` | `ColumnDef<T>` |

## License

[ISC](./LICENSE)
