import { useId, useRef, useState } from 'react'
import { filterFns } from '../core/features/filtering'
import type { Column, RowData, TableInstance } from '../core/types'
import { formatValue } from './formatValue'
import { Popover } from './Popover'
import { columnLabel } from './columnLabel'
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
 * The default filter control for a column: from `filterVariant` when set,
 * otherwise from its filter function (min / max inputs for number and date
 * ranges, a select for booleans and a text input otherwise).
 */
export function ColumnFilter<TData extends RowData>({ table, column, debounceMs = 200 }: ColumnFilterProps<TData>) {
  const text = useLocaleText()
  const fn = column.getFilterFn()
  const label = columnLabel(column)
  const variant = column.columnDef.filterVariant

  if (variant === 'select') return <SelectFilter column={column} label={label} text={text} />
  if (variant === 'multi-select') return <MultiSelectFilter column={column} label={label} text={text} />

  if (fn === filterFns.inNumberRange || fn === filterFns.inDateRange) {
    const type = fn === filterFns.inNumberRange ? 'number' : 'date'
    return <RangeFilter column={column} type={type} label={label} debounceMs={debounceMs} text={text} />
  }

  const sample = table.getCoreRowModel().rows.find((row) => row.getValue(column.id) != null)?.getValue(column.id)
  if (variant === 'boolean' || (typeof sample === 'boolean' && fn === filterFns.equals)) {
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
  const facets = type === 'number' ? column.getFacetedMinMaxValues() : undefined
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
        placeholder={type === 'number' ? `${text.filterMin}${facets ? ` (${facets[0]})` : ''}` : undefined}
        value={range[0]}
        onChange={(event) => setRange([event.target.value, range[1]])}
      />
      <input
        type={type}
        className="tably-input tably-filter-input"
        aria-label={text.filterToLabel(label)}
        placeholder={type === 'number' ? `${text.filterMax}${facets ? ` (${facets[1]})` : ''}` : undefined}
        value={range[1]}
        onChange={(event) => setRange([range[0], event.target.value])}
      />
    </div>
  )
}

/** Distinct values sorted for display: numbers numerically, everything else as text. */
function sortedFacets(counts: Map<unknown, number>): [unknown, number][] {
  return [...counts.entries()]
    .filter(([value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) =>
      typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true })
    )
}

const optionLabel = (value: unknown) => {
  const formatted = formatValue(value)
  return typeof formatted === 'string' || typeof formatted === 'number' ? String(formatted) : String(value)
}

function SelectFilter<TData extends RowData>({
  column,
  label,
  text
}: {
  column: Column<TData>
  label: string
  text: TableLocaleText
}) {
  const value = column.getFilterValue()
  const options = sortedFacets(column.getFacetedUniqueValues())
  return (
    <select
      className="tably-input tably-filter-select"
      aria-label={text.filterLabel(label)}
      value={value == null ? '' : String(value)}
      onChange={(event) => column.setFilterValue(event.target.value === '' ? undefined : event.target.value)}
    >
      <option value="">{text.filterAll}</option>
      {options.map(([option, count]) => (
        <option key={String(option)} value={String(option)}>
          {optionLabel(option)} ({count})
        </option>
      ))}
    </select>
  )
}

function MultiSelectFilter<TData extends RowData>({
  column,
  label,
  text
}: {
  column: Column<TData>
  label: string
  text: TableLocaleText
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const current = column.getFilterValue()
  const selected = Array.isArray(current) ? current : []
  const options = sortedFacets(column.getFacetedUniqueValues())

  const toggle = (option: unknown, checked: boolean) =>
    column.setFilterValue(checked ? [...selected, option] : selected.filter((value) => value !== option))

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="tably-input tably-filter-select tably-multi-select-button"
        aria-label={text.filterLabel(label)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {selected.length === 0 ? text.filterAll : text.filterSelectedCount(selected.length)}
      </button>
      <Popover
        anchorRef={buttonRef}
        open={open}
        onClose={(restoreFocus) => {
          setOpen(false)
          if (restoreFocus) buttonRef.current?.focus()
        }}
        id={listId}
        role="dialog"
        aria-label={text.filterLabel(label)}
        className="tably-menu"
      >
        <ul className="tably-menu-list">
          {options.map(([option, count]) => (
            <li key={String(option)} className="tably-menu-item">
              <label className="tably-menu-label">
                <input
                  type="checkbox"
                  className="tably-checkbox"
                  checked={selected.includes(option)}
                  onChange={(event) => toggle(option, event.target.checked)}
                />
                {optionLabel(option)}
                <span className="tably-menu-hint">{count}</span>
              </label>
            </li>
          ))}
        </ul>
        {selected.length > 0 && (
          <div className="tably-menu-actions">
            <button type="button" className="tably-button" onClick={() => column.setFilterValue(undefined)}>
              {text.clearFilter}
            </button>
          </div>
        )}
      </Popover>
    </>
  )
}
