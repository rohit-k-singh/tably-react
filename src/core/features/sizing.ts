import { makeStateUpdater } from '../state'
import type { Column, RowData, TableInstance, Updater } from '../types'

/** Column widths in pixels set by resizing, keyed by column id. */
export type ColumnSizingState = Record<string, number>

export interface SizingTableState {
  columnSizing: ColumnSizingState
}

export interface SizingColumnDef {
  /** Allows resizing this column. Defaults to `true`. */
  enableResizing?: boolean
}

export interface SizingOptions {
  onColumnSizingChange?: (columnSizing: ColumnSizingState) => void
  /** Lets users resize columns. Uses fixed column widths. Defaults to `false`. */
  enableColumnResizing?: boolean
  /** Width of columns without a numeric `width`. Defaults to 150. */
  defaultColumnWidth?: number
}

export interface SizingColumn {
  /** Width in pixels: the resized width, the numeric `width`, or `defaultColumnWidth`, within the min / max. */
  getSize: () => number
  getMinSize: () => number
  getMaxSize: () => number
  getCanResize: () => boolean
  /** Sets the width, clamped to the min / max. */
  setSize: (size: number) => void
  /** Returns to the defined width. */
  resetSize: () => void
  /** Whether the column was resized. */
  getIsResized: () => boolean
}

export interface SizingInstance {
  setColumnSizing: (updater: Updater<ColumnSizingState>) => void
  /** Resets to the initial sizes, or to the defined widths with `true`. */
  resetColumnSizing: (defaultState?: boolean) => void
  /** Sum of the visible column widths. */
  getTotalSize: () => number
}

export const DEFAULT_COLUMN_WIDTH = 150
export const DEFAULT_MIN_COLUMN_WIDTH = 40

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function createSizingColumnApi<TData extends RowData>(
  table: TableInstance<TData>,
  column: Column<TData>
): SizingColumn {
  const { columnDef } = column

  const api: SizingColumn = {
    getMinSize: () => (typeof columnDef.minWidth === 'number' ? columnDef.minWidth : DEFAULT_MIN_COLUMN_WIDTH),
    getMaxSize: () => (typeof columnDef.maxWidth === 'number' ? columnDef.maxWidth : Number.POSITIVE_INFINITY),
    getSize: () => {
      if (column.columns.length > 0) {
        return column
          .getLeafColumns()
          .filter((leaf) => leaf.getIsVisible())
          .reduce((sum, leaf) => sum + leaf.getSize(), 0)
      }
      const size =
        table.getState().columnSizing[column.id] ??
        (typeof columnDef.width === 'number' ? columnDef.width : table.options.defaultColumnWidth ?? DEFAULT_COLUMN_WIDTH)
      return clamp(size, api.getMinSize(), api.getMaxSize())
    },
    getCanResize: () =>
      column.columns.length === 0 && (columnDef.enableResizing ?? true) && !!table.options.enableColumnResizing,
    setSize: (size) => {
      const next = Math.round(clamp(size, api.getMinSize(), api.getMaxSize()))
      table.setColumnSizing((previous) => (previous[column.id] === next ? previous : { ...previous, [column.id]: next }))
    },
    resetSize: () =>
      table.setColumnSizing((previous) => {
        if (!(column.id in previous)) return previous
        const { [column.id]: _removed, ...rest } = previous
        return rest
      }),
    getIsResized: () => column.id in table.getState().columnSizing
  }
  return api
}

export function createSizingTableApi<TData extends RowData>(table: TableInstance<TData>): SizingInstance {
  const update = makeStateUpdater(table, 'columnSizing')
  return {
    setColumnSizing: (updater) => {
      const previous = table.getState().columnSizing
      const next = update(updater)
      if (next !== previous) table.options.onColumnSizingChange?.(next)
    },
    resetColumnSizing: (defaultState) =>
      table.setColumnSizing(defaultState ? {} : table.initialState.columnSizing),
    getTotalSize: () => table.getVisibleLeafColumns().reduce((sum, column) => sum + column.getSize(), 0)
  }
}
