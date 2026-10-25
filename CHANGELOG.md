# tably-react

## 0.0.1

First release of the rewritten package. Versioning restarts at 0.x, so the API may still change between minor
versions; the 1.0.x releases were an early prototype (see "Migrating from the 1.0.x prototype" in the README).

### Features

- Headless engine (`createTable`, `useTable`) and a ready-made `<Table>` component, with no runtime dependencies.
- Typed column definitions: `accessorKey` with type-checked nested paths, `accessorFn`, display columns,
  `createColumnHelper`, typed `ColumnMeta`.
- Sorting: multi-column, natural string order, built-in and custom sorting functions, server-side mode.
- Filtering: global search, column filters with built-in controls, built-in and custom filter functions,
  server-side mode.
- Pagination: client and server-side, page size select, automatic reset to the first page.
- Every state slice can be controlled (`state` + `on*Change`) or left to the table (`initialState`).
- Default stylesheet with light, dark and auto themes, three densities, striped, hover and bordered rows, all
  adjustable with CSS variables; zero-specificity selectors.
- `classNames` slots, `rowClassName`, `getRowProps`, column `align` and widths.
- Translatable texts (`localeText`, `TableLocaleProvider`).
- React 18 and 19, ESM and CommonJS, server rendering and React Server Components (`'use client'`).
- Column groups with multi-level headers (`columns` in a column definition), `getHeaderGroups()` and
  `row.getVisibleCells()` for custom markup.
- Column visibility and ordering state, `TableColumnsMenu`, and drag-and-drop header reordering
  (`enableColumnDragging`).
- Column resizing (`enableColumnResizing`) with pointer and keyboard handles, column pinning, a column actions menu
  (`enableColumnActions`) and a sticky header (`stickyHeader` + `maxHeight`).
- Row selection (`enableRowSelection`): checkbox column, select all (filtered rows or page) with an indeterminate
  state, Shift-click ranges, single selection, `selectRowOnClick`, and selected row models.
- Expanding rows: tree data (`getSubRows`) with per-level sorting, ancestor-preserving filtering and sub row selection,
  and detail panels (`renderDetailPanel`).
- Grouping by one or more columns with aggregation (`aggregationFn`, `aggregatedCell`), grouping from the column
  actions menu, column footers (`footer`) and `column.getAggregatedValue()`.
- Row virtualization (`enableVirtualization`) with measured row heights, and the `useVirtualizer` hook.
- Keyboard grid navigation (`enableKeyboardNavigation`), faceted values (`getFacetedUniqueValues`,
  `getFacetedMinMaxValues`) with `filterVariant` select / multi-select controls, and CSV export (`getCsv`,
  `downloadCsv`, `TableExportButton`).
- End-to-end tests in Chromium, Firefox and WebKit with axe accessibility checks, a bundle size budget, and
  automatic releases to npm (with provenance) on every push to `main` that changes the package.
