import type { ComponentClass, ExoticComponent, ReactNode } from 'react'
import type {
  FilteringColumn,
  FilteringColumnDef,
  FilteringInstance,
  FilteringOptions,
  FilteringTableState
} from './features/filtering'
import type {
  ColumnOrderInstance,
  VisibilityColumnDef,
  ColumnOrderOptions,
  ColumnOrderTableState,
  VisibilityColumn,
  VisibilityInstance,
  VisibilityOptions,
  VisibilityTableState
} from './features/columns'
import type {
  PinningColumn,
  PinningColumnDef,
  PinningInstance,
  PinningOptions,
  PinningTableState
} from './features/pinning'
import type {
  ExpandingInstance,
  ExpandingOptions,
  ExpandingRow,
  ExpandingTableState
} from './features/expanding'
import type {
  SelectionInstance,
  SelectionOptions,
  SelectionRow,
  SelectionTableState
} from './features/selection'
import type {
  SizingColumn,
  SizingColumnDef,
  SizingInstance,
  SizingOptions,
  SizingTableState
} from './features/sizing'
import type {
  PaginationInstance,
  PaginationOptions,
  PaginationTableState
} from './features/pagination'
import type {
  SortingColumn,
  SortingColumnDef,
  SortingInstance,
  SortingOptions,
  SortingTableState
} from './features/sorting'

/** Any object can be a table row. */
export type RowData = object

/** A new value, or a function deriving it from the previous value. */
export type Updater<T> = T | ((previous: T) => T)

type Primitive = string | number | boolean | bigint | symbol | null | undefined
type Leaf = Primitive | Date | RegExp | ((...args: any[]) => unknown) | ReadonlyArray<unknown>
type PrevDepth = [never, 0, 1, 2, 3]

/**
 * Dot-separated paths to every property of `T`, up to four levels deep,
 * e.g. `'name' | 'address' | 'address.city'`. Arrays, dates and functions are leaves.
 */
export type DeepKeys<T, Depth extends number = 4> = [Depth] extends [never]
  ? never
  : T extends Leaf
    ? never
    : {
        [K in keyof T & (string | number)]: NonNullable<T[K]> extends Leaf
          ? `${K}`
          : `${K}` | `${K}.${DeepKeys<NonNullable<T[K]>, PrevDepth[Depth]>}`
      }[keyof T & (string | number)]

/**
 * The type found at path `P` of `T`. Includes `undefined` / `null` when an
 * intermediate property along the path is optional or nullable.
 */
export type DeepValue<T, P> = P extends keyof T
  ? T[P]
  : P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? DeepValue<NonNullable<T[K]>, Rest> | Extract<T[K], null | undefined>
      : never
    : never

/**
 * Free-form metadata attached to a column definition. Extend it with
 * declaration merging to type your own fields:
 *
 * ```ts
 * declare module 'tably-react' {
 *   interface ColumnMeta<TData, TValue> { tooltip?: string }
 * }
 * ```
 */
// @ts-expect-error TS6205: the type parameters are only used by declaration merging.
export interface ColumnMeta<TData, TValue> {}

export interface HeaderContext<TData extends RowData> {
  table: TableInstance<TData>
  column: Column<TData>
  /** The header cell being rendered; undefined in the filter row. */
  header?: Header<TData>
}

export interface CellContext<TData extends RowData, TValue> {
  table: TableInstance<TData>
  column: Column<TData>
  row: Row<TData>
  cell: Cell<TData>
  /** The value returned by the column's accessor for this row. */
  getValue: () => TValue
}

/**
 * Static content, a function rendering content from a context, or a
 * component (including `memo` / `forwardRef`) receiving the context as props.
 */
export type Renderable<TContext> =
  | ReactNode
  | ((context: TContext) => ReactNode)
  | ComponentClass<TContext>
  | ExoticComponent<TContext>

export interface ColumnDefBase<TData extends RowData, TValue>
  extends SortingColumnDef<TData>,
    FilteringColumnDef<TData>,
    VisibilityColumnDef,
    SizingColumnDef,
    PinningColumnDef {
  /** Header cell content. Defaults to the column id. */
  header?: Renderable<HeaderContext<TData>>
  /** Body cell content. Defaults to the formatted cell value. */
  cell?: Renderable<CellContext<TData, TValue>>
  /** Horizontal alignment of the header and body cells, e.g. `'end'` for numbers. */
  align?: 'start' | 'center' | 'end'
  /**
   * Column width: a number of pixels or any CSS length. Numbers are also the
   * starting width for resizing and pinning (strings use `defaultColumnWidth` there).
   */
  width?: number | string
  /** Minimum width; numbers also limit resizing (default 40 px). */
  minWidth?: number | string
  /** Maximum width; numbers also limit resizing. */
  maxWidth?: number | string
  /** Class name added to every body cell of the column. */
  className?: string
  /** Class name added to the header cell of the column. */
  headerClassName?: string
  /**
   * Filter control shown in the filter row (`<Table showColumnFilters>`).
   * Defaults to an input matching the column's filter function.
   */
  filter?: Renderable<HeaderContext<TData>>
  meta?: ColumnMeta<TData, TValue>
}

export interface AccessorKeyColumnDef<TData extends RowData, TKey extends DeepKeys<TData>>
  extends ColumnDefBase<TData, DeepValue<TData, TKey>> {
  /** Path of the row property displayed in the column, e.g. `'address.city'`. */
  accessorKey: TKey
  /** Unique column id. Defaults to `accessorKey`. */
  id?: string
  accessorFn?: never
  columns?: never
}

export interface AccessorFnColumnDef<TData extends RowData, TValue>
  extends ColumnDefBase<TData, TValue> {
  /** Derives the column value from a row. */
  accessorFn: (row: TData, index: number) => TValue
  /** Unique column id. */
  id: string
  accessorKey?: never
  columns?: never
}

/** A column without a value, e.g. for row actions. */
export interface DisplayColumnDef<TData extends RowData> extends ColumnDefBase<TData, unknown> {
  /** Unique column id. */
  id: string
  accessorKey?: never
  accessorFn?: never
  columns?: never
}

/** A header spanning several columns. */
export interface GroupColumnDef<TData extends RowData> extends ColumnDefBase<TData, unknown> {
  /** The grouped columns, which can be groups themselves. */
  columns: ColumnDef<TData>[]
  /** Unique column id. Defaults to `header` when it is a string. */
  id?: string
  accessorKey?: never
  accessorFn?: never
}

type AccessorKeyColumnDefs<TData extends RowData> = {
  [K in DeepKeys<TData>]: AccessorKeyColumnDef<TData, K>
}[DeepKeys<TData>]

/**
 * A column definition. With `accessorKey`, the cell's `getValue()` is typed
 * from the row property; for typed `accessorFn` columns use `createColumnHelper`.
 */
export type ColumnDef<TData extends RowData> =
  | AccessorKeyColumnDefs<TData>
  | AccessorFnColumnDef<TData, any>
  | DisplayColumnDef<TData>
  | GroupColumnDef<TData>

/** Any column definition, with the per-column value type erased. */
export interface AnyColumnDef<TData extends RowData> extends ColumnDefBase<TData, any> {
  id?: string
  accessorKey?: string
  accessorFn?: (row: TData, index: number) => unknown
  columns?: ColumnDef<TData>[]
}

export interface Column<TData extends RowData>
  extends SortingColumn<TData>,
    FilteringColumn<TData>,
    VisibilityColumn,
    SizingColumn,
    PinningColumn {
  id: string
  /** The definition this column was created from. */
  columnDef: AnyColumnDef<TData>
  /** Position among its siblings in the column definitions. */
  index: number
  /** Nesting level: 0 for top-level columns, 1 inside a group, and so on. */
  depth: number
  /** The group containing this column. */
  parent?: Column<TData>
  /** Child columns of a group; empty for other columns. */
  columns: Column<TData>[]
  /** The non-group columns under this column, or the column itself. */
  getLeafColumns: () => Column<TData>[]
  /** Reads this column's value from a row. Undefined for display and group columns. */
  accessorFn?: (row: TData, index: number) => unknown
}

/** A cell in a header row. Group headers span the visible columns they contain. */
export interface Header<TData extends RowData> {
  id: string
  column: Column<TData>
  /** Number of columns the header spans. */
  colSpan: number
  /** Number of header rows the header spans; columns outside groups span every row below their level. */
  rowSpan: number
  /** Header row this header belongs to. */
  depth: number
  /** The visible leaf columns under this header, in display order. */
  leafColumns: Column<TData>[]
  getContext: () => HeaderContext<TData>
}

export interface HeaderGroup<TData extends RowData> {
  id: string
  depth: number
  headers: Header<TData>[]
}

export interface Row<TData extends RowData> extends SelectionRow, ExpandingRow {
  /**
   * Unique row id from `getRowId`. Defaults to the row index, and to
   * `${parentId}.${index}` for sub rows.
   */
  id: string
  /** Position of the row among its siblings (in `data`, or in its parent's sub rows). */
  index: number
  /** Nesting level: 0 for top-level rows. */
  depth: number
  /** Id of the parent row, for sub rows. */
  parentId?: string
  /** Child rows from `getSubRows`, filtered and sorted like the top-level rows in processed row models. */
  subRows: Row<TData>[]
  getParentRow: () => Row<TData> | undefined
  /** Ancestors from the top-level row down to the parent. */
  getParentRows: () => Row<TData>[]
  /** All descendants, depth first. */
  getLeafRows: () => Row<TData>[]
  /** The row object passed in `data`. */
  original: TData
  /** Value of the given column for this row. Cached after the first read. */
  getValue: <TValue = unknown>(columnId: string) => TValue
  /** One cell per leaf column, in definition order. */
  getCells: () => Cell<TData>[]
  /** Cells of the visible columns, in display order. */
  getVisibleCells: () => Cell<TData>[]
}

export interface Cell<TData extends RowData> {
  /** `${row.id}_${column.id}` */
  id: string
  row: Row<TData>
  column: Column<TData>
  getValue: <TValue = unknown>() => TValue
  getContext: () => CellContext<TData, unknown>
}

export interface RowModel<TData extends RowData> {
  /** Top-level rows (in the expanded row model: every visible row, flattened). */
  rows: Row<TData>[]
  /** Every row including sub rows, depth first. */
  flatRows: Row<TData>[]
  rowsById: Record<string, Row<TData>>
}

export interface TableState
  extends SortingTableState,
    FilteringTableState,
    PaginationTableState,
    VisibilityTableState,
    ColumnOrderTableState,
    SizingTableState,
    PinningTableState,
    SelectionTableState,
    ExpandingTableState {}

export interface TableOptions<TData extends RowData>
  extends SortingOptions,
    FilteringOptions<TData>,
    PaginationOptions,
    VisibilityOptions,
    ColumnOrderOptions,
    SizingOptions,
    PinningOptions,
    SelectionOptions<TData>,
    ExpandingOptions<TData> {
  /** Rows to display. Keep the reference stable (state or `useMemo`) to avoid recomputation. */
  data: TData[]
  /** Column definitions. Keep the reference stable (module scope or `useMemo`). */
  columns: ColumnDef<TData>[]
  /**
   * Returns a unique, stable id for a row. Defaults to the row index (and
   * `${parent.id}.${index}` for sub rows).
   */
  getRowId?: (row: TData, index: number, parent?: Row<TData>) => string
  /** Controlled state. Any slice set here overrides the internal state. */
  state?: Partial<TableState>
  /** Starting values for uncontrolled state. */
  initialState?: Partial<TableState>
}

export interface ResolvedTableOptions<TData extends RowData> extends TableOptions<TData> {
  state: TableState
  /** Receives every state change; used by framework adapters to store uncontrolled state. */
  onStateChange: (updater: Updater<TableState>) => void
}

export interface TableInstance<TData extends RowData>
  extends SortingInstance<TData>,
    FilteringInstance<TData>,
    PaginationInstance<TData>,
    VisibilityInstance,
    ColumnOrderInstance<TData>,
    SizingInstance,
    PinningInstance<TData>,
    SelectionInstance<TData>,
    ExpandingInstance<TData> {
  options: ResolvedTableOptions<TData>
  setOptions: (options: ResolvedTableOptions<TData>) => void
  getState: () => TableState
  /** Initial state, including `initialState` overrides. */
  initialState: TableState
  /** Top-level columns; groups hold their children in `columns`. */
  getAllColumns: () => Column<TData>[]
  /** Every column, including groups, flattened. */
  getAllFlatColumns: () => Column<TData>[]
  /** Every non-group column, in definition order. */
  getAllLeafColumns: () => Column<TData>[]
  /** Visible non-group columns in display order: pinned left, unpinned, pinned right. */
  getVisibleLeafColumns: () => Column<TData>[]
  /** Header rows for the visible columns, top to bottom. */
  getHeaderGroups: () => HeaderGroup<TData>[]
  /** Finds a column (including groups) by id. */
  getColumn: (columnId: string) => Column<TData> | undefined
  /** Every row in `data`, before any processing. */
  getCoreRowModel: () => RowModel<TData>
  /** The rows to render, after all processing: the current page, with expanded sub rows flattened in. */
  getRowModel: () => RowModel<TData>
}
