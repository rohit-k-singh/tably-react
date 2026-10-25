import { useState, type CSSProperties, type DragEvent } from 'react'
import type { Header, RowData, TableInstance } from '../core/types'
import { flexRender } from '../react/flexRender'
import { cx } from './cx'

export interface HeaderDragging {
  draggedColumnId: string | undefined
  onDragStart: () => void
  onDragEnd: () => void
  onDrop: () => void
}

export function HeaderCell<TData extends RowData>({
  table,
  header,
  className,
  style,
  dragging
}: {
  table: TableInstance<TData>
  header: Header<TData>
  className?: string
  style?: CSSProperties
  dragging?: HeaderDragging
}) {
  const { column } = header
  const { header: content, headerClassName, align } = column.columnDef
  const rendered = content === undefined ? column.id : flexRender(content, header.getContext())
  const isGroup = column.columns.length > 0
  const canSort = column.getCanSort()
  const sorted = column.getIsSorted()
  const { sorting } = table.getState()
  const [isDropTarget, setIsDropTarget] = useState(false)

  const dragProps = dragging && {
    draggable: true,
    'data-dragging': dragging.draggedColumnId === column.id || undefined,
    'data-drop-target': (isDropTarget && dragging.draggedColumnId !== column.id) || undefined,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', column.id)
      dragging.onDragStart()
    },
    onDragEnd: () => {
      setIsDropTarget(false)
      dragging.onDragEnd()
    },
    onDragOver: (event: DragEvent) => {
      if (dragging.draggedColumnId === undefined) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setIsDropTarget(true)
    },
    onDragLeave: () => setIsDropTarget(false),
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      setIsDropTarget(false)
      dragging.onDrop()
    }
  }

  return (
    <th
      scope={isGroup ? 'colgroup' : 'col'}
      colSpan={header.colSpan > 1 ? header.colSpan : undefined}
      rowSpan={header.rowSpan > 1 ? header.rowSpan : undefined}
      className={cx(
        'tably-th',
        isGroup && 'tably-th-group',
        canSort && 'tably-th-sortable',
        dragging && 'tably-th-draggable',
        className,
        headerClassName
      )}
      data-align={align}
      aria-sort={sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : undefined}
      style={style}
      {...dragProps}
    >
      {canSort ? (
        <button type="button" className="tably-sort-button" onClick={column.getToggleSortingHandler()}>
          {rendered}
          <SortIndicator direction={sorted} />
          {sorted && sorting.length > 1 && (
            <span className="tably-sort-index" aria-hidden="true">
              {column.getSortIndex() + 1}
            </span>
          )}
        </button>
      ) : (
        rendered
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
