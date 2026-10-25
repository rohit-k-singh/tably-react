import type { Key, ReactNode } from 'react'

export interface TableColumn<T = Record<string, any>> {
  /** Property of the row object displayed in this column. */
  key: keyof T
  /** Content of the column header cell. */
  header: ReactNode
  /** Custom cell renderer. Defaults to rendering the raw value. */
  render?: (value: T[keyof T], row: T) => ReactNode
  /**
   * Reserved for column sorting, which is not implemented yet.
   * Setting it currently has no effect.
   */
  sortable?: boolean
  /** Class name added to every body cell of this column. */
  className?: string
  /** Class name added to the header cell of this column. */
  headerClassName?: string
}

export interface TableProps<T = Record<string, any>> {
  data: T[]
  columns: TableColumn<T>[]
  /** Class name added to the scroll container wrapping the table. */
  className?: string
  /** Shows a loading indicator instead of the table body. */
  loading?: boolean
  /** Content shown when `data` is empty. */
  emptyMessage?: ReactNode
  /** Called when a row is clicked, or activated with Enter / Space. */
  onRowClick?: (row: T, index: number) => void
  /**
   * Returns a stable, unique key for a row. Defaults to the row index.
   * Provide this whenever rows can be reordered, inserted or removed.
   */
  getRowKey?: (row: T, index: number) => Key
  /** Accessible label for the table. */
  'aria-label'?: string
}
