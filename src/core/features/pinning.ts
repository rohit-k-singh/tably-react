import { makeStateUpdater } from '../state'
import type { Column, RowData, TableInstance, Updater } from '../types'

export type ColumnPinningPosition = 'left' | 'right'

/** Ids of the columns pinned to each side, in display order (left to right). */
export interface ColumnPinningState {
  left: string[]
  right: string[]
}

export interface PinningTableState {
  columnPinning: ColumnPinningState
}

export interface PinningColumnDef {
  /** Allows pinning this column. Defaults to `true`. */
  enablePinning?: boolean
}

export interface PinningOptions {
  onColumnPinningChange?: (columnPinning: ColumnPinningState) => void
  /** Allows pinning columns. Defaults to `true`. */
  enableColumnPinning?: boolean
}

export interface PinningColumn {
  getCanPin: () => boolean
  /** The side the column is pinned to. A group is pinned when all its visible columns are. */
  getIsPinned: () => ColumnPinningPosition | false
  /** Pins the column (all of its columns, for a group) to a side, or unpins it with `false`. */
  pin: (position: ColumnPinningPosition | false) => void
  /** Distance in pixels from the pinned side, for sticky positioning. */
  getPinnedOffset: () => number
  /** Whether this is the innermost pinned column on its side, e.g. to draw a separating shadow. */
  getIsLastPinned: () => boolean
}

export interface PinningInstance<TData extends RowData> {
  setColumnPinning: (updater: Updater<ColumnPinningState>) => void
  /** Resets to the initial pinning, or unpins everything with `true`. */
  resetColumnPinning: (defaultState?: boolean) => void
  getIsSomeColumnsPinned: () => boolean
  /** Visible columns pinned left, from the left edge. */
  getLeftLeafColumns: () => Column<TData>[]
  /** Visible unpinned columns. */
  getCenterLeafColumns: () => Column<TData>[]
  /** Visible columns pinned right, in display order. */
  getRightLeafColumns: () => Column<TData>[]
}

export function getDefaultColumnPinning(): ColumnPinningState {
  return { left: [], right: [] }
}

export function createPinningColumnApi<TData extends RowData>(
  table: TableInstance<TData>,
  column: Column<TData>
): PinningColumn {
  const leafSide = (id: string): ColumnPinningPosition | false => {
    const { left, right } = table.getState().columnPinning
    return left.includes(id) ? 'left' : right.includes(id) ? 'right' : false
  }

  const api: PinningColumn = {
    getCanPin: () =>
      column.getLeafColumns().some((leaf) => leaf.columnDef.enablePinning ?? true) &&
      (table.options.enableColumnPinning ?? true),

    getIsPinned: () => {
      const leaves = column.getLeafColumns().filter((leaf) => leaf.getIsVisible())
      if (leaves.length === 0) return false
      const side = leafSide(leaves[0].id)
      return side && leaves.every((leaf) => leafSide(leaf.id) === side) ? side : false
    },

    pin: (position) => {
      const ids = column
        .getLeafColumns()
        .filter((leaf) => leaf.columnDef.enablePinning ?? true)
        .map((leaf) => leaf.id)
      if (ids.length === 0 || !(table.options.enableColumnPinning ?? true)) return

      table.setColumnPinning((previous) => {
        const left = previous.left.filter((id) => !ids.includes(id))
        const right = previous.right.filter((id) => !ids.includes(id))
        if (position === 'left') left.push(...ids)
        if (position === 'right') right.push(...ids)
        return { left, right }
      })
    },

    getPinnedOffset: () => {
      const side = leafSide(column.id)
      if (!side) return 0
      const columns = side === 'left' ? table.getLeftLeafColumns() : [...table.getRightLeafColumns()].reverse()
      let offset = 0
      for (const other of columns) {
        if (other.id === column.id) break
        offset += other.getSize()
      }
      return offset
    },

    getIsLastPinned: () => {
      const side = leafSide(column.id)
      if (side === 'left') {
        const left = table.getLeftLeafColumns()
        return left[left.length - 1]?.id === column.id
      }
      if (side === 'right') return table.getRightLeafColumns()[0]?.id === column.id
      return false
    }
  }
  return api
}

export function createPinningTableApi<TData extends RowData>(
  table: TableInstance<TData>,
  getVisibleOrderedLeafColumns: () => Column<TData>[]
): PinningInstance<TData> {
  const update = makeStateUpdater(table, 'columnPinning')

  const pinned = (side: ColumnPinningPosition) => {
    const byId = new Map(getVisibleOrderedLeafColumns().map((column) => [column.id, column]))
    return table
      .getState()
      .columnPinning[side].map((id) => byId.get(id))
      .filter((column): column is Column<TData> => column !== undefined)
  }

  return {
    setColumnPinning: (updater) => {
      const next = update(updater)
      table.options.onColumnPinningChange?.(next)
    },
    resetColumnPinning: (defaultState) =>
      table.setColumnPinning(defaultState ? getDefaultColumnPinning() : table.initialState.columnPinning),
    getIsSomeColumnsPinned: () => {
      const { left, right } = table.getState().columnPinning
      return left.length > 0 || right.length > 0
    },
    getLeftLeafColumns: () => pinned('left'),
    getRightLeafColumns: () => pinned('right'),
    getCenterLeafColumns: () => {
      const { left, right } = table.getState().columnPinning
      return getVisibleOrderedLeafColumns().filter((column) => !left.includes(column.id) && !right.includes(column.id))
    }
  }
}
