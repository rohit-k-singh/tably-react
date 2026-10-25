import type { RowData, TableInstance } from '../core/types'
import { cx } from './cx'
import { useLocaleText } from './locale'
import { useDebouncedState } from './useDebouncedState'

export interface TableSearchProps<TData extends RowData> {
  table: TableInstance<TData>
  /** Defaults to `localeText.searchPlaceholder`. */
  placeholder?: string
  /** Delay before the search is applied while typing. Defaults to 200 ms. */
  debounceMs?: number
  className?: string
  /** Accessible label. Defaults to `localeText.searchLabel`. */
  'aria-label'?: string
}

/** A search input bound to the table's global filter. */
export function TableSearch<TData extends RowData>({
  table,
  placeholder,
  debounceMs = 200,
  className,
  'aria-label': ariaLabel
}: TableSearchProps<TData>) {
  const text = useLocaleText()
  const globalFilter = table.getState().globalFilter
  const [value, setValue] = useDebouncedState<string>(
    globalFilter == null ? '' : String(globalFilter),
    (next) => table.setGlobalFilter(next),
    debounceMs
  )

  return (
    <input
      type="search"
      className={cx('tably-input', 'tably-search', className)}
      value={value}
      placeholder={placeholder ?? text.searchPlaceholder}
      aria-label={ariaLabel ?? text.searchLabel}
      onChange={(event) => setValue(event.target.value)}
    />
  )
}
