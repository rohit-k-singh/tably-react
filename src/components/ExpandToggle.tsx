import type { Row, RowData } from '../core/types'
import { useLocaleText } from './locale'

/** Button expanding or collapsing a row, or a same-sized spacer for rows that cannot expand. */
export function ExpandToggle<TData extends RowData>({ row, controls }: { row: Row<TData>; controls?: string }) {
  const text = useLocaleText()
  if (!row.getCanExpand()) return <span className="tably-expand-spacer" aria-hidden="true" />

  const expanded = row.getIsExpanded()
  return (
    <button
      type="button"
      className="tably-icon-button tably-expand-button"
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      aria-label={expanded ? text.collapseRow : text.expandRow}
      onClick={(event) => {
        event.stopPropagation()
        row.toggleExpanded()
      }}
    >
      <Chevron />
    </button>
  )
}

/** Button expanding or collapsing every row. */
export function ExpandAllToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const text = useLocaleText()
  return (
    <button
      type="button"
      className="tably-icon-button tably-expand-button"
      aria-expanded={expanded}
      aria-label={expanded ? text.collapseAllRows : text.expandAllRows}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
    >
      <Chevron />
    </button>
  )
}

function Chevron() {
  return (
    <svg className="tably-chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
