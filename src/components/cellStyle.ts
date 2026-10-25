import type { CSSProperties } from 'react'
import type { Column, Header, RowData } from '../core/types'

const toLength = (value: number | string | undefined) => (typeof value === 'number' ? `${value}px` : value)

/** The column's CSS `width`, `minWidth` and `maxWidth`, for auto-width tables. */
export function columnStyle<TData extends RowData>(column: Column<TData>): CSSProperties | undefined {
  const { width, minWidth, maxWidth } = column.columnDef
  if (width === undefined && minWidth === undefined && maxWidth === undefined) return undefined
  return { width: toLength(width), minWidth: toLength(minWidth), maxWidth: toLength(maxWidth) }
}

const pinnedPosition = (side: 'left' | 'right', offset: number): CSSProperties => ({
  position: 'sticky',
  [side === 'left' ? 'insetInlineStart' : 'insetInlineEnd']: offset
})

/**
 * Style of a header or body cell in a leaf column. Fixed-layout tables take
 * widths from the `<colgroup>`; pinned columns get an exact width (so sticky
 * offsets add up) and their sticky offset.
 */
export function leafCellStyle<TData extends RowData>(
  column: Column<TData>,
  fixedLayout: boolean
): CSSProperties | undefined {
  const pinned = column.getIsPinned()
  if (!pinned) return fixedLayout ? undefined : columnStyle(column)

  const size = column.getSize()
  return {
    ...(fixedLayout ? undefined : { width: size, minWidth: size, maxWidth: size }),
    ...pinnedPosition(pinned, column.getPinnedOffset())
  }
}

/** The side a header is pinned to: its column's, or for a group, the side all its spanned columns share. */
export function headerPinnedSide<TData extends RowData>(header: Header<TData>): 'left' | 'right' | false {
  const side = header.leafColumns[0]?.getIsPinned() ?? false
  return side && header.leafColumns.every((leaf) => leaf.getIsPinned() === side) ? side : false
}

/** Style of a header cell; group headers stick when all the columns they span are pinned to the same side. */
export function headerStyle<TData extends RowData>(header: Header<TData>, fixedLayout: boolean) {
  if (header.column.columns.length === 0) return leafCellStyle(header.column, fixedLayout)

  const side = headerPinnedSide(header)
  if (!side) return undefined
  const leaves = header.leafColumns
  const edge = side === 'left' ? leaves[0] : leaves[leaves.length - 1]
  return pinnedPosition(side, edge.getPinnedOffset())
}

/** Data attributes marking a pinned header. */
export function headerPinnedAttributes<TData extends RowData>(header: Header<TData>) {
  if (header.column.columns.length === 0) return pinnedAttributes(header.column)
  const side = headerPinnedSide(header)
  if (!side) return undefined
  const edge = side === 'left' ? header.leafColumns[header.leafColumns.length - 1] : header.leafColumns[0]
  return { 'data-pinned': side, 'data-pinned-edge': edge.getIsLastPinned() || undefined }
}

/** Data attributes marking pinned cells, used by the stylesheet. */
export function pinnedAttributes<TData extends RowData>(column: Column<TData>) {
  const pinned = column.getIsPinned()
  if (!pinned || column.columns.length > 0) return undefined
  return { 'data-pinned': pinned, 'data-pinned-edge': column.getIsLastPinned() || undefined }
}
