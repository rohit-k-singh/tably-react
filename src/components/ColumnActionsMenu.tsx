import { useId, useRef, useState, type KeyboardEvent } from 'react'
import type { Column, RowData } from '../core/types'
import { columnLabel } from './columnLabel'
import { useLocaleText } from './locale'
import { Popover } from './Popover'

interface MenuItem {
  label: string
  onSelect: () => void
}

/** A "⋮" button in a header opening sort, pin, hide and size actions for the column. */
export function ColumnActionsMenu<TData extends RowData>({ column }: { column: Column<TData> }) {
  const text = useLocaleText()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)

  const items: MenuItem[] = []
  if (column.getCanSort()) {
    const sorted = column.getIsSorted()
    if (sorted !== 'asc') items.push({ label: text.sortAscending, onSelect: () => column.toggleSorting(false) })
    if (sorted !== 'desc') items.push({ label: text.sortDescending, onSelect: () => column.toggleSorting(true) })
    if (sorted) items.push({ label: text.clearSort, onSelect: () => column.clearSorting() })
  }
  if (column.getCanPin()) {
    const pinned = column.getIsPinned()
    if (pinned !== 'left') items.push({ label: text.pinLeft, onSelect: () => column.pin('left') })
    if (pinned !== 'right') items.push({ label: text.pinRight, onSelect: () => column.pin('right') })
    if (pinned) items.push({ label: text.unpin, onSelect: () => column.pin(false) })
  }
  if (column.getCanGroup() || column.getIsGrouped()) {
    items.push(
      column.getIsGrouped()
        ? { label: text.ungroupColumn, onSelect: () => column.toggleGrouping() }
        : { label: text.groupByColumn, onSelect: () => column.toggleGrouping() }
    )
  }
  if (column.getCanResize() && column.getIsResized()) {
    items.push({ label: text.resetWidth, onSelect: () => column.resetSize() })
  }
  if (column.getCanHide()) items.push({ label: text.hideColumn, onSelect: () => column.toggleVisibility(false) })

  if (items.length === 0) return null

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (!restoreFocus) return
    // Actions such as pinning move the header; refocus its button once it has re-rendered.
    const container = buttonRef.current?.closest('.tably-container')
    requestAnimationFrame(() => {
      const button = buttonRef.current?.isConnected
        ? buttonRef.current
        : container?.querySelector<HTMLElement>(`[data-column-actions="${CSS.escape(column.id)}"]`)
      button?.focus()
    })
  }

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const menuItems = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    const index = menuItems.indexOf(document.activeElement as HTMLElement)
    const focusAt = (i: number) => menuItems[(i + menuItems.length) % menuItems.length]?.focus()

    if (event.key === 'ArrowDown') focusAt(index + 1)
    else if (event.key === 'ArrowUp') focusAt(index - 1)
    else if (event.key === 'Home') focusAt(0)
    else if (event.key === 'End') focusAt(menuItems.length - 1)
    else if (event.key === 'Tab') close(false)
    else return
    if (event.key !== 'Tab') event.preventDefault()
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="tably-icon-button tably-column-actions"
        data-column-actions={column.id}
        aria-label={text.columnActions(columnLabel(column))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <circle cx="8" cy="3.5" r="1.25" fill="currentColor" />
          <circle cx="8" cy="8" r="1.25" fill="currentColor" />
          <circle cx="8" cy="12.5" r="1.25" fill="currentColor" />
        </svg>
      </button>
      <Popover
        anchorRef={buttonRef}
        open={open}
        onClose={close}
        id={menuId}
        role="menu"
        aria-label={text.columnActions(columnLabel(column))}
        className="tably-menu tably-actions-menu"
        initialFocus='[role="menuitem"]'
        onKeyDown={onMenuKeyDown}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="tably-menu-action"
            onClick={() => {
              item.onSelect()
              close(true)
            }}
          >
            {item.label}
          </button>
        ))}
      </Popover>
    </>
  )
}
