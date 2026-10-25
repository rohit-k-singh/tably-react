# tably-react

A customizable React table component written in TypeScript, with zero runtime dependencies.

- Fully typed columns and rows
- No runtime dependencies; works with React 18 and 19
- Optional, framework-agnostic stylesheet themed with CSS variables
- ESM and CommonJS builds, server-rendering safe (`'use client'` included for React Server Components)
- Accessible: keyboard-operable clickable rows, `aria-busy` while loading

## Installation

```bash
npm install tably-react
```

## Usage

```tsx
import { Table, type TableColumn } from 'tably-react'
import 'tably-react/styles.css'

interface User {
  id: number
  name: string
  email: string
}

const columns: TableColumn<User>[] = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email', render: (value) => <a href={`mailto:${value}`}>{String(value)}</a> }
]

export function Users({ users }: { users: User[] }) {
  return (
    <Table
      aria-label="Users"
      data={users}
      columns={columns}
      getRowKey={(user) => user.id}
      onRowClick={(user) => console.log(user)}
    />
  )
}
```

## API

### `<Table>` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `T[]` | required | Rows to display. |
| `columns` | `TableColumn<T>[]` | required | Column definitions. |
| `getRowKey` | `(row, index) => Key` | row index | Stable key per row. Provide it when rows can be reordered, added or removed. |
| `onRowClick` | `(row, index) => void` | | Makes rows clickable and keyboard-focusable (Enter / Space). |
| `loading` | `boolean` | `false` | Replaces the body with a loading indicator and sets `aria-busy`. |
| `emptyMessage` | `ReactNode` | `'No data available'` | Shown when `data` is empty. |
| `className` | `string` | | Class added to the scroll container. |
| `aria-label` | `string` | | Accessible name for the table. |

### `TableColumn<T>`

| Field | Type | Description |
| --- | --- | --- |
| `key` | `keyof T` | Row property displayed in the column. |
| `header` | `ReactNode` | Header cell content. |
| `render` | `(value, row) => ReactNode` | Custom cell renderer. |
| `className` | `string` | Class added to each body cell in the column. |
| `headerClassName` | `string` | Class added to the column's header cell. |
| `sortable` | `boolean` | Reserved for sorting; not implemented yet. |

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

To style from scratch, skip the stylesheet and target the class names: `tably-container`, `tably-table`, `tably-thead`,
`tably-th`, `tably-tbody`, `tably-tr`, `tably-tr-clickable`, `tably-td`, `tably-empty`, `tably-loading`, `tably-spinner`.

## Development

```bash
npm install
npm run dev            # playground at http://localhost:5173
npm test               # unit tests (Vitest + Testing Library)
npm run typecheck
npm run build          # ESM + CJS + type declarations into dist/
npm run check:package  # validate the published package shape (publint, are-the-types-wrong)
```

## License

[ISC](./LICENSE)
