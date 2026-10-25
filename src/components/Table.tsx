import { useMemo, useState, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import type { Row, RowData, TableInstance, TableOptions } from '../core/types'
import { flexRender } from '../react/flexRender'
import { useTable } from '../react/useTable'
import { ColumnFilter } from './ColumnFilter'
import { cx } from './cx'
import { headerStyle, leafCellStyle, pinnedAttributes } from './cellStyle'
import { formatValue } from './formatValue'
import { HeaderCell } from './HeaderCell'
import { TableLocaleProvider, useLocaleText, type TableLocaleText } from './locale'
import { createSelectionColumn, type SelectAllScope } from './selectionColumn'
import { TablePagination } from './TablePagination'

/** Class names added to each part of the table, e.g. for Tailwind. */
export interface TableClassNames {
  container?: string
  toolbar?: string
  scroll?: string
  table?: string
  caption?: string
  thead?: string
  headerRow?: string
  th?: string
  filterRow?: string
  filterCell?: string
  tbody?: string
  tr?: string
  td?: string
  empty?: string
  loading?: string
  footer?: string
}

export interface TableProps<TData extends RowData> extends TableOptions<TData> {
  /** Class name added to the outer container. */
  className?: string
  /** Class names for each part of the table. */
  classNames?: TableClassNames
  /** Color theme of the default stylesheet. `'auto'` follows the OS setting. Defaults to `'light'`. */
  theme?: 'light' | 'dark' | 'auto'
  /** Cell spacing of the default stylesheet. Defaults to `'standard'`. */
  density?: 'compact' | 'standard' | 'comfortable'
  /** Alternates row backgrounds. */
  striped?: boolean
  /** Highlights the row under the pointer. */
  highlightOnHover?: boolean
  /** Adds borders between columns. */
  bordered?: boolean
  /** Visible caption describing the table; also its accessible name. */
  caption?: ReactNode
  /** Shows a loading indicator instead of the table body. */
  loading?: boolean
  /** Replaces the default loading spinner. */
  loadingIndicator?: ReactNode
  /** Content shown when `data` is empty. Overrides `localeText.empty`. */
  emptyMessage?: ReactNode
  /** Content shown when filters match no rows. Overrides `localeText.noResults`. */
  noResultsMessage?: ReactNode
  /** Built-in texts, e.g. for translation. Also applies to the toolbar's search and the pagination. */
  localeText?: Partial<TableLocaleText>
  /** Called when a row is clicked, or activated with Enter / Space. */
  onRowClick?: (original: TData, row: Row<TData>) => void
  /** Class name for each body row. */
  rowClassName?: string | ((row: Row<TData>) => string | undefined)
  /** Extra attributes for each body row, e.g. `data-*` attributes or event handlers. */
  getRowProps?: (row: Row<TData>) => HTMLAttributes<HTMLTableRowElement> & Record<`data-${string}`, unknown>
  /**
   * Content above the table, e.g. a search box:
   * `toolbar={(table) => <TableSearch table={table} />}`
   */
  toolbar?: ReactNode | ((table: TableInstance<TData>) => ReactNode)
  /** Shows a row of filter controls under the header. */
  showColumnFilters?: boolean
  /** Delay before typed column filters are applied. Defaults to 200 ms. */
  filterDebounceMs?: number
  /** Page size choices shown with `enablePagination`. Pass an empty array to hide the select. */
  pageSizeOptions?: number[]
  /** Lets users reorder columns by dragging their headers. */
  enableColumnDragging?: boolean
  /** Adds a menu button to each header with sort, pin, hide and reset width actions. */
  enableColumnActions?: boolean
  /** Keeps the header visible while scrolling the table body. Needs `maxHeight`. */
  stickyHeader?: boolean
  /** Maximum height of the scrollable table area, in pixels or any CSS length. */
  maxHeight?: number | string
  /**
   * What the header checkbox selects with `enableRowSelection`: every row
   * matching the filters (`'all'`, default) or the current page.
   */
  selectAllScope?: SelectAllScope
  /** Hides the checkbox column added by `enableRowSelection`, e.g. to select rows only by clicking them. */
  hideSelectionColumn?: boolean
  /** Toggles a row's selection when it is clicked. */
  selectRowOnClick?: boolean
  /** Accessible label for the table. */
  'aria-label'?: string
}

export function Table<TData extends RowData>({ localeText, ...props }: TableProps<TData>) {
  return localeText ? (
    <TableLocaleProvider localeText={localeText}>
      <TableContent {...props} />
    </TableLocaleProvider>
  ) : (
    <TableContent {...props} />
  )
}

function TableContent<TData extends RowData>({
  className,
  classNames = {},
  theme,
  density,
  striped,
  highlightOnHover,
  bordered,
  caption,
  loading = false,
  loadingIndicator,
  emptyMessage,
  noResultsMessage,
  onRowClick,
  rowClassName,
  getRowProps,
  toolbar,
  showColumnFilters = false,
  filterDebounceMs = 200,
  pageSizeOptions,
  enableColumnDragging = false,
  enableColumnActions = false,
  stickyHeader = false,
  maxHeight,
  selectAllScope = 'all',
  hideSelectionColumn = false,
  selectRowOnClick = false,
  'aria-label': ariaLabel,
  ...tableOptions
}: Omit<TableProps<TData>, 'localeText'>) {
  const selectable = !!tableOptions.enableRowSelection
  const showSelectionColumn = selectable && !hideSelectionColumn
  const columnDefs = useMemo(
    () =>
      showSelectionColumn ? [createSelectionColumn<TData>(selectAllScope), ...tableOptions.columns] : tableOptions.columns,
    [tableOptions.columns, showSelectionColumn, selectAllScope]
  )
  const options = { ...tableOptions, columns: columnDefs }
  const table = useTable(options)
  const text = useLocaleText()
  const columns = table.getVisibleLeafColumns()
  const { rows } = table.getRowModel()
  const [draggedColumnId, setDraggedColumnId] = useState<string>()
  const fixedLayout = !!options.enableColumnResizing

  const renderMessage = (className: string, content: ReactNode) => (
    <tr>
      <td colSpan={columns.length} className={className}>
        {content}
      </td>
    </tr>
  )

  const renderRow = (row: Row<TData>) => {
    const { className: extraClassName, onClick, onKeyDown, ...rowProps } = getRowProps?.(row) ?? {}

    const clickable = !!onRowClick || selectRowOnClick
    const activate = () => {
      if (selectRowOnClick) row.toggleSelected()
      onRowClick?.(row.original, row)
    }
    const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
      onClick?.(event)
      if (!event.defaultPrevented) activate()
    }
    const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
      onKeyDown?.(event)
      if (event.defaultPrevented || event.target !== event.currentTarget) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        activate()
      }
    }

    return (
      <tr
        key={row.id}
        {...rowProps}
        aria-selected={selectable ? row.getIsSelected() : undefined}
        data-selected={(selectable && row.getIsSelected()) || undefined}
        className={cx(
          'tably-tr',
          clickable && 'tably-tr-clickable',
          classNames.tr,
          typeof rowClassName === 'function' ? rowClassName(row) : rowClassName,
          extraClassName
        )}
        onClick={clickable ? handleClick : onClick}
        onKeyDown={clickable ? handleKeyDown : onKeyDown}
        tabIndex={clickable ? 0 : rowProps.tabIndex}
      >
        {row.getVisibleCells().map((cell) => {
          const { cell: renderCell, className: cellClassName, align } = cell.column.columnDef
          return (
            <td
              key={cell.id}
              className={cx('tably-td', classNames.td, cellClassName)}
              data-align={align}
              style={leafCellStyle(cell.column, fixedLayout)}
              {...pinnedAttributes(cell.column)}
            >
              {renderCell === undefined
                ? formatValue(cell.getValue())
                : flexRender(renderCell, cell.getContext())}
            </td>
          )
        })}
      </tr>
    )
  }

  const renderBody = () => {
    if (loading) {
      return renderMessage(
        cx('tably-loading', classNames.loading),
        loadingIndicator ?? <span className="tably-spinner" role="status" aria-label={text.loading} />
      )
    }
    if (rows.length === 0) {
      const { columnFilters, globalFilter } = table.getState()
      const isFiltered = columnFilters.length > 0 || (globalFilter != null && globalFilter !== '')
      return isFiltered
        ? renderMessage(cx('tably-empty tably-no-results', classNames.empty), noResultsMessage ?? text.noResults)
        : renderMessage(cx('tably-empty', classNames.empty), emptyMessage ?? text.empty)
    }
    return rows.map(renderRow)
  }

  return (
    <div
      className={cx('tably-container', classNames.container, className)}
      data-theme={theme}
      data-density={density === 'standard' ? undefined : density}
      data-striped={striped || undefined}
      data-hover={highlightOnHover || undefined}
      data-bordered={bordered || undefined}
      data-sticky-header={stickyHeader || undefined}
    >
      {toolbar !== undefined && (
        <div className={cx('tably-toolbar', classNames.toolbar)}>
          {typeof toolbar === 'function' ? toolbar(table) : toolbar}
        </div>
      )}
      <div className={cx('tably-scroll', classNames.scroll)} style={maxHeight === undefined ? undefined : { maxHeight }}>
        <table
          className={cx('tably-table', classNames.table)}
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          style={fixedLayout ? { width: table.getTotalSize(), tableLayout: 'fixed' } : undefined}
        >
          {caption !== undefined && <caption className={cx('tably-caption', classNames.caption)}>{caption}</caption>}
          {fixedLayout && (
            <colgroup>
              {columns.map((column) => (
                <col key={column.id} style={{ width: column.getSize() }} />
              ))}
            </colgroup>
          )}
          <thead className={cx('tably-thead', classNames.thead)}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className={classNames.headerRow}>
                {headerGroup.headers.map((header) => (
                  <HeaderCell
                    key={header.id}
                    table={table}
                    header={header}
                    className={classNames.th}
                    style={headerStyle(header, fixedLayout)}
                    showActions={enableColumnActions}
                    dragging={
                      enableColumnDragging && header.column.columns.length === 0
                        ? {
                            draggedColumnId,
                            onDragStart: () => setDraggedColumnId(header.column.id),
                            onDragEnd: () => setDraggedColumnId(undefined),
                            onDrop: () => {
                              if (draggedColumnId === undefined) return
                              const target = table.getOrderedLeafColumns().indexOf(header.column)
                              table.moveColumn(draggedColumnId, target)
                              setDraggedColumnId(undefined)
                            }
                          }
                        : undefined
                    }
                  />
                ))}
              </tr>
            ))}
            {showColumnFilters && (
              <tr className={cx('tably-filter-row', classNames.filterRow)}>
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cx('tably-filter-cell', classNames.filterCell)}
                    style={leafCellStyle(column, fixedLayout)}
                    {...pinnedAttributes(column)}
                  >
                    {column.getCanFilter() &&
                      (column.columnDef.filter === undefined ? (
                        <ColumnFilter table={table} column={column} debounceMs={filterDebounceMs} />
                      ) : (
                        flexRender(column.columnDef.filter, { table, column })
                      ))}
                  </td>
                ))}
              </tr>
            )}
          </thead>
          <tbody className={cx('tably-tbody', classNames.tbody)}>{renderBody()}</tbody>
        </table>
      </div>
      {options.enablePagination && (
        <div className={cx('tably-footer', classNames.footer)}>
          <TablePagination table={table} pageSizeOptions={pageSizeOptions} />
        </div>
      )}
    </div>
  )
}

export default Table
