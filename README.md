# tably-react

A customizable React table component written in TypeScript, with zero runtime dependencies.

- Fully typed columns, including nested `accessorKey` paths such as `'address.city'`
- Headless `useTable` hook for custom markup, plus a ready-made `<Table>` component
- No runtime dependencies; works with React 18 and 19
- Optional, framework-agnostic stylesheet themed with CSS variables
- ESM and CommonJS builds, server-rendering safe (`'use client'` included for React Server Components)
- Sorting: multi-column, natural string order, custom comparators, client or server side
- Accessible: sort buttons with `aria-sort`, keyboard-operable clickable rows, `aria-busy` while loading

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

## `<Table>` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `T[]` | required | Rows to display. |
| `columns` | `ColumnDef<T>[]` | required | Column definitions. |
| `getRowId` | `(row, index) => string` | row index | Stable id per row. Provide it when rows can be reordered, added or removed. |
| `initialState`, `state` | `Partial<TableState>` | | Uncontrolled starting state, and controlled state. |
| Feature options | | | See [Sorting](#sorting). |
| `onRowClick` | `(original, row) => void` | | Makes rows clickable and keyboard-operable (Enter / Space). Call `event.stopPropagation()` in buttons inside rows to avoid triggering it. |
| `loading` | `boolean` | `false` | Replaces the body with a loading indicator and sets `aria-busy`. |
| `emptyMessage` | `ReactNode` | `'No data available'` | Shown when there are no rows. |
| `className` | `string` | | Class added to the scroll container. |
| `aria-label` | `string` | | Accessible name for the table. |

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

Theme the table by overriding CSS variables on the container or any ancestor:

```css
.my-table {
  --tably-header-bg: #111827;
  --tably-header-color: #f9fafb;
  --tably-row-hover-bg: #eef2ff;
  --tably-cell-padding-y: 0.5rem;
}
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

To style from scratch, skip the stylesheet and target the class names: `tably-container`, `tably-table`, `tably-thead`,
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

## Migrating from 1.x

| 1.x | 2.x |
| --- | --- |
| `{ key: 'name', header: 'Name' }` | `{ accessorKey: 'name', header: 'Name' }` |
| `render: (value, row) => ...` | `cell: ({ getValue, row }) => ...` (`row.original` is the row object) |
| `onRowClick(row)` | `onRowClick(original, row)` |
| `TableColumn<T>` | `ColumnDef<T>` |

## License

[ISC](./LICENSE)
