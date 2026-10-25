import type { Column, RowData, TableInstance } from '../core/types'
import { flexRender } from '../react/flexRender'
import { cx } from './cx'

export function HeaderCell<TData extends RowData>({
  table,
  column
}: {
  table: TableInstance<TData>
  column: Column<TData>
}) {
  const { header, headerClassName } = column.columnDef
  const content = header === undefined ? column.id : flexRender(header, { table, column })
  const canSort = column.getCanSort()
  const sorted = column.getIsSorted()
  const { sorting } = table.getState()

  return (
    <th
      scope="col"
      className={cx('tably-th', canSort && 'tably-th-sortable', headerClassName)}
      aria-sort={sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      {canSort ? (
        <button type="button" className="tably-sort-button" onClick={column.getToggleSortingHandler()}>
          {content}
          <SortIndicator direction={sorted} />
          {sorted && sorting.length > 1 && (
            <span className="tably-sort-index" aria-hidden="true">
              {column.getSortIndex() + 1}
            </span>
          )}
        </button>
      ) : (
        content
      )}
    </th>
  )
}

function SortIndicator({ direction }: { direction: false | 'asc' | 'desc' }) {
  return (
    <svg
      className="tably-sort-indicator"
      data-direction={direction || 'none'}
      viewBox="0 0 10 14"
      width="10"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <path className="tably-sort-indicator-asc" d="M5 1 9 6H1z" />
      <path className="tably-sort-indicator-desc" d="M5 13 1 8h8z" />
    </svg>
  )
}
