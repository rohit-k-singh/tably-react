import type {
  AccessorFnColumnDef,
  AccessorKeyColumnDef,
  ColumnDefBase,
  DeepKeys,
  DisplayColumnDef,
  RowData
} from './types'

export interface ColumnHelper<TData extends RowData> {
  /** A column reading `key` from each row, typed from the row property. */
  accessor<TKey extends DeepKeys<TData>>(
    key: TKey,
    def?: Omit<AccessorKeyColumnDef<TData, TKey>, 'accessorKey'>
  ): AccessorKeyColumnDef<TData, TKey>
  /** A column computing its value from each row, typed from the function's return type. */
  accessor<TValue>(
    accessorFn: (row: TData, index: number) => TValue,
    def: Omit<AccessorFnColumnDef<TData, TValue>, 'accessorFn'>
  ): AccessorFnColumnDef<TData, TValue>
  /** A column without a value, e.g. for row actions. */
  display(def: DisplayColumnDef<TData>): DisplayColumnDef<TData>
}

/**
 * Builds column definitions with full type inference for cell values:
 *
 * ```ts
 * const column = createColumnHelper<User>()
 * const columns = [
 *   column.accessor('address.city', { header: 'City' }),
 *   column.accessor((user) => user.age * 12, { id: 'months', cell: ({ getValue }) => getValue().toFixed(0) })
 * ]
 * ```
 */
export function createColumnHelper<TData extends RowData>(): ColumnHelper<TData> {
  return {
    accessor: (keyOrFn: string | ((row: TData, index: number) => unknown), def?: ColumnDefBase<TData, unknown>) =>
      typeof keyOrFn === 'function' ? { ...def, accessorFn: keyOrFn } : { ...def, accessorKey: keyOrFn },
    display: (def) => def
  } as ColumnHelper<TData>
}
