import type { DisplayColumnDef, Row, RowData, TableInstance } from '../core/types'
import { useLocaleText } from './locale'

export const SELECTION_COLUMN_ID = 'tably-select'

/** The row last clicked in each table, the anchor for Shift-click ranges. */
const anchors = new WeakMap<object, string>()

export type SelectAllScope = 'all' | 'page'

function SelectAllCheckbox<TData extends RowData>({
  table,
  scope
}: {
  table: TableInstance<TData>
  scope: SelectAllScope
}) {
  const text = useLocaleText()
  if (!(table.options.enableMultiRowSelection ?? true)) return null

  const all = scope === 'page' ? table.getIsAllPageRowsSelected() : table.getIsAllRowsSelected()
  const some = scope === 'page' ? table.getIsSomePageRowsSelected() : table.getIsSomeRowsSelected()

  return (
    <input
      type="checkbox"
      className="tably-checkbox"
      aria-label={scope === 'page' ? text.selectPageRows : text.selectAllRows}
      checked={all}
      ref={(input) => {
        if (input) input.indeterminate = some && !all
      }}
      onChange={() =>
        scope === 'page' ? table.toggleAllPageRowsSelected(!all) : table.toggleAllRowsSelected(!all)
      }
    />
  )
}

function RowCheckbox<TData extends RowData>({ table, row }: { table: TableInstance<TData>; row: Row<TData> }) {
  const text = useLocaleText()
  // Parents read as checked when all their sub rows are selected, and indeterminate when some are.
  const checked = row.getIsSelected() || row.getIsAllSubRowsSelected()
  const indeterminate = !checked && row.getIsSomeSelected()
  return (
    <input
      type="checkbox"
      className="tably-checkbox"
      aria-label={text.selectRow}
      checked={checked}
      ref={(input) => {
        if (input) input.indeterminate = indeterminate
      }}
      disabled={!row.getCanSelect()}
      onChange={() => {}}
      onClick={(event) => {
        event.stopPropagation()
        const anchor = anchors.get(table)
        const selected = !checked
        if (event.shiftKey && anchor !== undefined && (table.options.enableMultiRowSelection ?? true)) {
          table.setRowRangeSelected(anchor, row.id, selected)
        } else {
          row.toggleSelected(selected)
        }
        anchors.set(table, row.id)
      }}
    />
  )
}

/** The checkbox column `<Table>` adds when row selection is enabled. */
export function createSelectionColumn<TData extends RowData>(scope: SelectAllScope): DisplayColumnDef<TData> {
  return {
    id: SELECTION_COLUMN_ID,
    header: ({ table }) => <SelectAllCheckbox table={table} scope={scope} />,
    cell: ({ table, row }) => <RowCheckbox table={table} row={row} />,
    enableHiding: false,
    enableResizing: false,
    width: 44,
    align: 'center',
    className: 'tably-select-cell',
    headerClassName: 'tably-select-cell'
  }
}
