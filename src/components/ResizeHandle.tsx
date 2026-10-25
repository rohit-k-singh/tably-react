import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { Column, RowData } from '../core/types'
import { columnLabel } from './columnLabel'
import { useLocaleText } from './locale'

const KEYBOARD_STEP = 10
const KEYBOARD_STEP_LARGE = 50

/**
 * Drag handle on a header's end edge (the "window splitter" pattern): drag
 * or use the arrow keys to resize, double-click or press Enter to reset.
 */
export function ResizeHandle<TData extends RowData>({ column }: { column: Column<TData> }) {
  const text = useLocaleText()
  const drag = useRef<{ startX: number; startSize: number; direction: 1 | -1 } | null>(null)
  const max = column.getMaxSize()

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget
    handle.setPointerCapture?.(event.pointerId)
    const direction = getComputedStyle(handle).direction === 'rtl' ? -1 : 1
    // Start from the rendered width, which can differ from getSize() in auto-width tables.
    const startSize = handle.parentElement?.getBoundingClientRect().width || column.getSize()
    drag.current = { startX: event.clientX, startSize, direction }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const { startX, startSize, direction } = drag.current
    column.setSize(startSize + (event.clientX - startX) * direction)
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    if (event.key === 'ArrowRight') column.setSize(column.getSize() + (rtl ? -step : step))
    else if (event.key === 'ArrowLeft') column.setSize(column.getSize() + (rtl ? step : -step))
    else if (event.key === 'Home') column.setSize(column.getMinSize())
    else if (event.key === 'End' && Number.isFinite(max)) column.setSize(max)
    else if (event.key === 'Enter') column.resetSize()
    else return
    event.preventDefault()
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={text.resizeColumn(columnLabel(column))}
      aria-valuenow={column.getSize()}
      aria-valuemin={column.getMinSize()}
      aria-valuemax={Number.isFinite(max) ? max : undefined}
      tabIndex={0}
      className="tably-resize-handle"
      data-resized={column.getIsResized() || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => column.resetSize()}
      onKeyDown={onKeyDown}
      onClick={(event) => event.stopPropagation()}
    />
  )
}
