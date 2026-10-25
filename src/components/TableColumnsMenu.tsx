import { useEffect, useId, useRef, useState } from 'react'
import type { RowData, TableInstance } from '../core/types'
import { columnLabel } from './columnLabel'
import { cx } from './cx'
import { useLocaleText } from './locale'

export interface TableColumnsMenuProps<TData extends RowData> {
  table: TableInstance<TData>
  /** Shows buttons to move columns up and down. Defaults to `true`. */
  enableOrdering?: boolean
  className?: string
}

/** A button opening a list of columns to show, hide and reorder. */
export function TableColumnsMenu<TData extends RowData>({
  table,
  enableOrdering = true,
  className
}: TableColumnsMenuProps<TData>) {
  const text = useLocaleText()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLElement>('input, button')?.focus()

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  const columns = table.getOrderedLeafColumns()

  return (
    <div className={cx('tably-columns-menu', className)} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="tably-button"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {text.columnsButton}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={menuId}
          className="tably-menu"
          role="dialog"
          aria-label={text.columnsButton}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              close()
            }
          }}
        >
          <ul className="tably-menu-list">
            {columns.map((column, index) => {
              const label = columnLabel(column)
              const group = column.parent ? columnLabel(column.parent) : undefined
              return (
                <li key={column.id} className="tably-menu-item">
                  <label className="tably-menu-label">
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      disabled={!column.getCanHide()}
                      onChange={(event) => column.toggleVisibility(event.target.checked)}
                    />
                    {label}
                    {group && <span className="tably-menu-hint">{group}</span>}
                  </label>
                  {enableOrdering && (
                    <span className="tably-menu-order">
                      <button
                        type="button"
                        className="tably-icon-button"
                        aria-label={text.moveColumnUp(label)}
                        disabled={index === 0}
                        onClick={() => table.moveColumn(column.id, index - 1)}
                      >
                        <Arrow direction="up" />
                      </button>
                      <button
                        type="button"
                        className="tably-icon-button"
                        aria-label={text.moveColumnDown(label)}
                        disabled={index === columns.length - 1}
                        onClick={() => table.moveColumn(column.id, index + 1)}
                      >
                        <Arrow direction="down" />
                      </button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="tably-menu-actions">
            <button type="button" className="tably-button" onClick={() => table.toggleAllColumnsVisible(true)}>
              {text.showAllColumns}
            </button>
            <button
              type="button"
              className="tably-button"
              onClick={() => {
                table.resetColumnVisibility(true)
                table.resetColumnOrder(true)
              }}
            >
              {text.resetColumns}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Arrow({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d={direction === 'up' ? 'm4 10 4-4 4 4' : 'm4 6 4 4 4-4'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
