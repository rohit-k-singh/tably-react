import type { Column, RowData } from '../core/types'

/** Plain-text name of a column: its non-empty string header, or its id. */
export function columnLabel<TData extends RowData>(column: Column<TData>): string {
  const { header } = column.columnDef
  return typeof header === 'string' && header.trim() !== '' ? header : column.id
}
