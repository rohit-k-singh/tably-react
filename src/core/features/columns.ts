import { makeStateUpdater } from '../state'
import type { Column, Header, HeaderGroup, RowData, TableInstance, Updater } from '../types'
import { memo } from '../utils'

/** Column ids mapped to `false` are hidden; every other column is visible. */
export type ColumnVisibilityState = Record<string, boolean>

/** Leaf column ids in display order. Columns not listed follow, in definition order. */
export type ColumnOrderState = string[]

export interface VisibilityTableState {
  columnVisibility: ColumnVisibilityState
}

export interface ColumnOrderTableState {
  columnOrder: ColumnOrderState
}

export interface VisibilityColumnDef {
  /** Allows hiding this column. Defaults to `true`. */
  enableHiding?: boolean
}

export interface VisibilityOptions {
  onColumnVisibilityChange?: (columnVisibility: ColumnVisibilityState) => void
  /** Allows hiding columns. Defaults to `true`. */
  enableHiding?: boolean
}

export interface ColumnOrderOptions {
  onColumnOrderChange?: (columnOrder: ColumnOrderState) => void
}

export interface VisibilityColumn {
  /** Whether the column is shown. A group is visible when any of its columns is. */
  getIsVisible: () => boolean
  getCanHide: () => boolean
  /** Shows or hides the column (all of its columns, for a group). Toggles without an argument. */
  toggleVisibility: (visible?: boolean) => void
}

export interface VisibilityInstance {
  setColumnVisibility: (updater: Updater<ColumnVisibilityState>) => void
  /** Resets to the initial visibility, or shows every column with `true`. */
  resetColumnVisibility: (defaultState?: boolean) => void
  /** Shows or hides every column that can be hidden. */
  toggleAllColumnsVisible: (visible?: boolean) => void
  getIsAllColumnsVisible: () => boolean
  getIsSomeColumnsVisible: () => boolean
}

export interface ColumnOrderInstance<TData extends RowData> {
  setColumnOrder: (updater: Updater<ColumnOrderState>) => void
  /** Resets to the initial order, or to definition order with `true`. */
  resetColumnOrder: (defaultState?: boolean) => void
  /** Non-group columns (visible or not) in display order. */
  getOrderedLeafColumns: () => Column<TData>[]
  /** Moves a column to `toIndex` in the display order of all leaf columns. */
  moveColumn: (columnId: string, toIndex: number) => void
}

export function createVisibilityColumnApi<TData extends RowData>(
  table: TableInstance<TData>,
  column: Column<TData>
): VisibilityColumn {
  return {
    getIsVisible: () => {
      if (column.columns.length > 0) return column.columns.some((child) => child.getIsVisible())
      return table.getState().columnVisibility[column.id] !== false
    },
    getCanHide: () => (column.columnDef.enableHiding ?? true) && (table.options.enableHiding ?? true),
    toggleVisibility: (visible) => {
      const leaves = column.getLeafColumns().filter((leaf) => leaf.getCanHide())
      if (leaves.length === 0) return
      const next = visible ?? !column.getIsVisible()
      table.setColumnVisibility((previous) => {
        const updated = { ...previous }
        for (const leaf of leaves) updated[leaf.id] = next
        return updated
      })
    }
  }
}

export function createVisibilityTableApi<TData extends RowData>(table: TableInstance<TData>): VisibilityInstance {
  const update = makeStateUpdater(table, 'columnVisibility')
  const hideable = () => table.getAllLeafColumns().filter((column) => column.getCanHide())

  return {
    setColumnVisibility: (updater) => {
      const next = update(updater)
      table.options.onColumnVisibilityChange?.(next)
    },
    resetColumnVisibility: (defaultState) =>
      table.setColumnVisibility(defaultState ? {} : table.initialState.columnVisibility),
    toggleAllColumnsVisible: (visible) => {
      const next = visible ?? !table.getIsAllColumnsVisible()
      table.setColumnVisibility((previous) => {
        const updated = { ...previous }
        for (const column of hideable()) updated[column.id] = next
        return updated
      })
    },
    getIsAllColumnsVisible: () => table.getAllLeafColumns().every((column) => column.getIsVisible()),
    getIsSomeColumnsVisible: () => table.getAllLeafColumns().some((column) => column.getIsVisible())
  }
}

export function createColumnOrderTableApi<TData extends RowData>(
  table: TableInstance<TData>
): ColumnOrderInstance<TData> {
  const update = makeStateUpdater(table, 'columnOrder')

  const api: ColumnOrderInstance<TData> = {
    setColumnOrder: (updater) => {
      const next = update(updater)
      table.options.onColumnOrderChange?.(next)
    },
    resetColumnOrder: (defaultState) => api.setColumnOrder(defaultState ? [] : table.initialState.columnOrder),
    getOrderedLeafColumns: memo(
      () => [table.getAllLeafColumns(), table.getState().columnOrder],
      (leaves, columnOrder) => orderColumns(leaves, columnOrder)
    ),
    moveColumn: (columnId, toIndex) => {
      const ids = api.getOrderedLeafColumns().map((column) => column.id)
      const from = ids.indexOf(columnId)
      if (from === -1) return
      const target = Math.max(0, Math.min(toIndex, ids.length - 1))
      if (target === from) return
      ids.splice(from, 1)
      ids.splice(target, 0, columnId)
      api.setColumnOrder(ids)
    }
  }
  return api
}

/** Applies a column order: listed ids first, then the rest in definition order. */
export function orderColumns<TData extends RowData>(
  columns: Column<TData>[],
  columnOrder: ColumnOrderState
): Column<TData>[] {
  if (columnOrder.length === 0) return columns
  const byId = new Map(columns.map((column) => [column.id, column]))
  const ordered: Column<TData>[] = []
  for (const id of columnOrder) {
    const column = byId.get(id)
    if (column) {
      ordered.push(column)
      byId.delete(id)
    }
  }
  return [...ordered, ...columns.filter((column) => byId.has(column.id))]
}

/**
 * Builds header rows for the given leaf columns. Group headers span the
 * adjacent visible leaves they contain (a group split by reordering or
 * pinning gets one header per run). Columns shallower than the deepest one span the remaining
 * header rows, so there are no empty placeholder cells.
 */
export function buildHeaderGroups<TData extends RowData>(
  table: TableInstance<TData>,
  leaves: Column<TData>[]
): HeaderGroup<TData>[] {
  if (leaves.length === 0) return [{ id: '0', depth: 0, headers: [] }]
  const maxDepth = Math.max(...leaves.map((leaf) => leaf.depth))
  const chains = leaves.map((leaf) => {
    const chain: Column<TData>[] = []
    for (let column: Column<TData> | undefined = leaf; column; column = column.parent) chain.unshift(column)
    return chain
  })

  const pinnedSides = leaves.map((leaf) => leaf.getIsPinned())
  const groups: HeaderGroup<TData>[] = []
  for (let depth = 0; depth <= maxDepth; depth++) {
    const headers: Header<TData>[] = []
    const idCounts = new Map<string, number>()
    let previous: { header: Header<TData>; leafIndex: number } | undefined

    leaves.forEach((leaf, leafIndex) => {
      if (leaf.depth < depth) return
      const column = chains[leafIndex][depth]

      // Extend the previous header over this leaf when it is the same group, adjacent,
      // and on the same side of the pinned / unpinned boundary.
      if (
        previous &&
        previous.header.column === column &&
        previous.leafIndex === leafIndex - 1 &&
        pinnedSides[leafIndex] === pinnedSides[leafIndex - 1] &&
        column !== leaf
      ) {
        previous.header.colSpan++
        previous.header.leafColumns.push(leaf)
        previous.leafIndex = leafIndex
        return
      }

      // Ids stay stable when columns move, so React keeps the header elements (and focus).
      const count = idCounts.get(column.id) ?? 0
      idCounts.set(column.id, count + 1)
      const header: Header<TData> = {
        id: count === 0 ? `${depth}_${column.id}` : `${depth}_${column.id}_${count}`,
        column,
        colSpan: 1,
        rowSpan: column === leaf ? maxDepth - depth + 1 : 1,
        depth,
        leafColumns: [leaf],
        getContext: () => ({ table, column, header })
      }
      headers.push(header)
      previous = { header, leafIndex }
    })

    groups.push({ id: String(depth), depth, headers })
  }
  return groups
}
