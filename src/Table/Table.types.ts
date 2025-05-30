import { ReactNode } from 'react'

export interface TableColumn<T = Record<string, any>> {
  key: keyof T
  header: string
  render?: (value: T[keyof T], row: T) => ReactNode
  sortable?: boolean
  className?: string
}

export interface TableProps<T = Record<string, any>> {
  data: T[]
  columns: TableColumn<T>[]
  className?: string
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
}