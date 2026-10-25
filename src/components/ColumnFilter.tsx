import { filterFns } from '../core/features/filtering'
import type { Column, RowData, TableInstance } from '../core/types'
import { useLocaleText, type TableLocaleText } from './locale'
import { useDebouncedState } from './useDebouncedState'

export interface ColumnFilterProps<TData extends RowData> {
  table: TableInstance<TData>
  column: Column<TData>
  /** Delay before the filter is applied while typing. Defaults to 200 ms. */
  debounceMs?: number
}

const toInputValue = (value: unknown) => {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

/**
 * The default filter control for a column, chosen from its filter function:
 * min / max inputs for number and date ranges, a select for booleans and a
 * text input otherwise.
 */
export function ColumnFilter<TData extends RowData>({ table, column, debounceMs = 200 }: ColumnFilterProps<TData>) {
  const text = useLocaleText()
  const fn = column.getFilterFn()
  const label = typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id

  if (fn === filterFns.inNumberRange || fn === filterFns.inDateRange) {
    const type = fn === filterFns.inNumberRange ? 'number' : 'date'
    return <RangeFilter column={column} type={type} label={label} debounceMs={debounceMs} text={text} />
  }

  const sample = table.getCoreRowModel().rows.find((row) => row.getValue(column.id) != null)?.getValue(column.id)
  if (typeof sample === 'boolean' && fn === filterFns.equals) {
    const value = column.getFilterValue()
    return (
      <select
        className="tably-input tably-filter-select"
        aria-label={text.filterLabel(label)}
        value={value === undefined ? '' : String(value)}
        onChange={(event) =>
          column.setFilterValue(event.target.value === '' ? undefined : event.target.value === 'true')
        }
      >
        <option value="">{text.filterAll}</option>
        <option value="true">{text.filterTrue}</option>
        <option value="false">{text.filterFalse}</option>
      </select>
    )
  }

  return <TextFilter column={column} label={label} debounceMs={debounceMs} text={text} />
}

function TextFilter<TData extends RowData>({
  column,
  label,
  debounceMs,
  text
}: {
  column: Column<TData>
  label: string
  debounceMs: number
  text: TableLocaleText
}) {
  const [value, setValue] = useDebouncedState(
    toInputValue(column.getFilterValue()),
    (next) => column.setFilterValue(next),
    debounceMs
  )

  return (
    <input
      type="search"
      className="tably-input tably-filter-input"
      aria-label={text.filterLabel(label)}
      placeholder={text.filterPlaceholder}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  )
}

function RangeFilter<TData extends RowData>({
  column,
  type,
  label,
  debounceMs,
  text
}: {
  column: Column<TData>
  type: 'number' | 'date'
  label: string
  debounceMs: number
  text: TableLocaleText
}) {
  const current = column.getFilterValue()
  const [min, max] = Array.isArray(current) ? current : [current, current]
  const [range, setRange] = useDebouncedState<[string, string]>(
    [toInputValue(min), toInputValue(max)],
    ([from, to]) => {
      const parse = (input: string) => (input === '' ? undefined : type === 'number' ? Number(input) : input)
      column.setFilterValue([parse(from), parse(to)])
    },
    debounceMs,
    (a, b) => a[0] === b[0] && a[1] === b[1]
  )

  return (
    <div className="tably-range-filter">
      <input
        type={type}
        className="tably-input tably-filter-input"
        aria-label={text.filterFromLabel(label)}
        placeholder={type === 'number' ? text.filterMin : undefined}
        value={range[0]}
        onChange={(event) => setRange([event.target.value, range[1]])}
      />
      <input
        type={type}
        className="tably-input tably-filter-input"
        aria-label={text.filterToLabel(label)}
        placeholder={type === 'number' ? text.filterMax : undefined}
        value={range[1]}
        onChange={(event) => setRange([range[0], event.target.value])}
      />
    </div>
  )
}
