import { TableProps } from './Table.types'

const Table = <T extends Record<string, any>>({
  data,
  columns,
  className = '',
  loading = false,
  emptyMessage = 'No data available',
  onRowClick
}: TableProps<T>) => {
  if (loading) {
    return (
      <div className="tably-loading">
        <div className="tably-spinner"></div>
      </div>
    )
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="tably-table">
        <thead className="tably-thead">
          <tr>
            {columns?.map((column) => (
              <th
                key={String(column.key)}
                className="tably-th"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tably-tbody">
          {data?.length === 0 ? (
            <tr>
              <td
                colSpan={columns?.length}
                className="tably-empty"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data?.map((row, index) => (
              <tr
                key={index}
                className={`tably-tr ${
                  onRowClick ? 'tably-tr-clickable' : ''
                }`}
                onClick={() => onRowClick?.(row)}
              >
                {columns?.map((column) => (
                  <td
                    key={String(column.key)}
                    className={`tably-td ${
                      column.className || ''
                    }`}
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// Export as both named and default export
export { Table }
export default Table