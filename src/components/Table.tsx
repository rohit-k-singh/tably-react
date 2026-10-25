import { Fragment, useCallback, useId, useMemo, useRef, useState, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import type { DisplayColumnDef, Row, RowData, TableInstance, TableOptions } from '../core/types'
import { flexRender } from '../react/flexRender'
import { useTable } from '../react/useTable'
import { useVirtualizer } from '../react/useVirtualizer'
import { ColumnFilter } from './ColumnFilter'
import { cx } from './cx'
import { headerStyle, leafCellStyle, pinnedAttributes } from './cellStyle'
import { formatValue } from './formatValue'
import { HeaderCell } from './HeaderCell'
import { TableLocaleProvider, useLocaleText, type TableLocaleText } from './locale'
import { ExpandAllToggle, ExpandToggle } from './ExpandToggle'
import { createSelectionColumn, SELECTION_COLUMN_ID, type SelectAllScope } from './selectionColumn'
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
  /**
   * Content shown under an expanded row, e.g. details or a nested table.
   * Adds an expand button column; every row can expand unless `getRowCanExpand` says otherwise.
   */
  renderDetailPanel?: (row: Row<TData>) => ReactNode
  /**
   * Renders only the rows in view, for large row counts. The table scrolls
   * within `maxHeight` (600px by default). Rows may have different heights;
   * they are measured as they render.
   */
  enableVirtualization?: boolean
  /** Row height used before a row is measured. Defaults to a value matching `density`. */
  estimateRowHeight?: number
  /** Rows rendered beyond the visible ones with `enableVirtualization`. Defaults to 10. */
  overscan?: number
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
  renderDetailPanel,
  enableVirtualization = false,
  estimateRowHeight,
  overscan = 10,
  'aria-label': ariaLabel,
  ...tableOptions
}: Omit<TableProps<TData>, 'localeText'>) {
  const selectable = !!tableOptions.enableRowSelection
  const showSelectionColumn = selectable && !hideSelectionColumn
  const hasDetailPanel = renderDetailPanel !== undefined
  const columnDefs = useMemo(
    () => [
      ...(showSelectionColumn ? [createSelectionColumn<TData>(selectAllScope)] : []),
      ...(hasDetailPanel ? [createExpandColumn<TData>()] : []),
      ...tableOptions.columns
    ],
    [tableOptions.columns, showSelectionColumn, selectAllScope, hasDetailPanel]
  )
  const options = {
    ...tableOptions,
    columns: columnDefs,
    getRowCanExpand: tableOptions.getRowCanExpand ?? (hasDetailPanel ? () => true : undefined)
  }
  const table = useTable(options)
  const detailIdPrefix = useId()
  // Tree data: the first data column shows the expand buttons, indented by depth.
  const isTree = table.getCoreRowModel().flatRows.length > table.getCoreRowModel().rows.length
  const treeColumnId = isTree
    ? table.getVisibleLeafColumns().find((column) => column.id !== SELECTION_COLUMN_ID)?.id
    : undefined
  const text = useLocaleText()
  const columns = table.getVisibleLeafColumns()
  const { rows } = table.getRowModel()

  const scrollRef = useRef<HTMLDivElement>(null)
  const tbodyRef = useRef<HTMLTableSectionElement>(null)
  const rowHeight = estimateRowHeight ?? DEFAULT_ROW_HEIGHTS[density ?? 'standard']
  const estimateSize = useCallback(() => rowHeight, [rowHeight])
  const getItemKey = useCallback((index: number) => rows[index]?.id ?? index, [rows])
  const virtualizer = useVirtualizer({
    enabled: enableVirtualization,
    count: rows.length,
    estimateSize,
    getItemKey,
    overscan,
    getScrollElement: () => scrollRef.current,
    // Height of everything above the first row inside the scroll area (caption, header rows).
    // Offsets do not change with the scroll position.
    getScrollMargin: () => {
      const scroll = scrollRef.current
      const tbody = tbodyRef.current
      const tableElement = tbody?.parentElement
      if (!scroll || !tbody || !tableElement) return 0
      return tbody.offsetTop + tableElement.offsetTop - scroll.offsetTop
    },
    initialViewportHeight: typeof maxHeight === 'number' ? maxHeight : DEFAULT_VIRTUAL_HEIGHT
  })
  const scrollHeight = maxHeight ?? (enableVirtualization ? DEFAULT_VIRTUAL_HEIGHT : undefined)
  const headerRowCount = table.getHeaderGroups().length + (showColumnFilters ? 1 : 0)
  const [draggedColumnId, setDraggedColumnId] = useState<string>()
  const fixedLayout = !!options.enableColumnResizing

  const renderMessage = (className: string, content: ReactNode) => (
    <tr>
      <td colSpan={columns.length} className={className}>
        {content}
      </td>
    </tr>
  )

  const renderRow = (row: Row<TData>, index: number) => {
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
        data-depth={row.depth || undefined}
        data-stripe={index % 2 === 1 || undefined}
        data-index={index}
        ref={enableVirtualization ? virtualizer.measureElement : undefined}
        aria-rowindex={enableVirtualization ? headerRowCount + index + 1 : undefined}
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
          const content =
            cell.column.id === EXPAND_COLUMN_ID ? (
              <ExpandToggle row={row} controls={detailId(row)} />
            ) : renderCell === undefined ? (
              formatValue(cell.getValue())
            ) : (
              flexRender(renderCell, cell.getContext())
            )
          const isTreeCell = cell.column.id === treeColumnId
          const style = leafCellStyle(cell.column, fixedLayout)
          return (
            <td
              key={cell.id}
              className={cx('tably-td', isTreeCell && 'tably-tree-cell', classNames.td, cellClassName)}
              data-align={align}
              style={isTreeCell ? { ...style, ['--tably-depth' as string]: row.depth } : style}
              {...pinnedAttributes(cell.column)}
            >
              {isTreeCell ? (
                <div className="tably-tree-content">
                  <ExpandToggle row={row} />
                  {content}
                </div>
              ) : (
                content
              )}
            </td>
          )
        })}
      </tr>
    )
  }

  const detailId = (row: Row<TData>) => `${detailIdPrefix}${row.id}-detail`

  // Always a keyed fragment, so expanding a row does not remount it (and its focused toggle).
  const renderRowWithDetail = (row: Row<TData>, index: number) => (
    <Fragment key={row.id}>
      {renderRow(row, index)}
      {hasDetailPanel && row.getIsExpanded() && (
        <tr
          className="tably-detail-row"
          id={detailId(row)}
          data-index={index}
          ref={enableVirtualization ? virtualizer.measureElement : undefined}
        >
          <td colSpan={columns.length} className="tably-detail-cell">
            {renderDetailPanel(row)}
          </td>
        </tr>
      )}
    </Fragment>
  )

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
    if (!enableVirtualization) return rows.map(renderRowWithDetail)

    const spacer = (height: number, position: string) =>
      height > 0 && (
        <tr key={position} className="tably-spacer" aria-hidden="true" style={{ height }}>
          <td colSpan={columns.length} />
        </tr>
      )
    return [
      spacer(virtualizer.paddingStart, 'spacer-start'),
      ...virtualizer.items.map((item) => renderRowWithDetail(rows[item.index], item.index)),
      spacer(virtualizer.paddingEnd, 'spacer-end')
    ]
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
      <div
        ref={scrollRef}
        className={cx('tably-scroll', classNames.scroll)}
        style={scrollHeight === undefined ? undefined : { maxHeight: scrollHeight }}
      >
        <table
          className={cx('tably-table', classNames.table)}
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          aria-rowcount={enableVirtualization ? headerRowCount + rows.length : undefined}
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
            {table.getHeaderGroups().map((headerGroup, headerIndex) => (
              <tr
                key={headerGroup.id}
                className={classNames.headerRow}
                aria-rowindex={enableVirtualization ? headerIndex + 1 : undefined}
              >
                {headerGroup.headers.map((header) => (
                  <HeaderCell
                    key={header.id}
                    table={table}
                    header={header}
                    className={classNames.th}
                    style={headerStyle(header, fixedLayout)}
                    showActions={enableColumnActions}
                    leading={
                      (header.column.id === EXPAND_COLUMN_ID || header.column.id === treeColumnId) &&
                      table.getCanSomeRowsExpand() ? (
                        <ExpandAllToggle
                          expanded={table.getIsAllRowsExpanded()}
                          onToggle={() => table.toggleAllRowsExpanded()}
                        />
                      ) : undefined
                    }
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
              <tr
                className={cx('tably-filter-row', classNames.filterRow)}
                aria-rowindex={enableVirtualization ? headerRowCount : undefined}
              >
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
          <tbody ref={tbodyRef} className={cx('tably-tbody', classNames.tbody)}>
            {renderBody()}
          </tbody>
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

const EXPAND_COLUMN_ID = 'tably-expand'

/** Estimated row heights per density, before rows are measured. */
const DEFAULT_ROW_HEIGHTS = { compact: 34, standard: 46, comfortable: 54 }
const DEFAULT_VIRTUAL_HEIGHT = 600

function createExpandColumn<TData extends RowData>(): DisplayColumnDef<TData> {
  return {
    id: EXPAND_COLUMN_ID,
    header: '',
    enableHiding: false,
    enableResizing: false,
    width: 44,
    align: 'center',
    className: 'tably-expand-cell',
    headerClassName: 'tably-expand-cell'
  }
}

export default Table
