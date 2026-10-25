import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Table, TableSearch, type ColumnDef } from '../src'
import { people, type Person } from './fixtures'

const columns: ColumnDef<Person>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'age', header: 'Age' },
  { accessorKey: 'active', header: 'Active' }
]

describe('server rendering', () => {
  it('hydrates without mismatches', async () => {
    const app = (
      <Table
        data={people}
        columns={columns}
        enablePagination
        showColumnFilters
        caption="People"
        toolbar={(table) => <TableSearch table={table} />}
      />
    )
    const container = document.createElement('div')
    container.innerHTML = renderToString(app)
    document.body.appendChild(container)

    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const recoverable = vi.fn()
    await act(async () => {
      hydrateRoot(container, app, { onRecoverableError: recoverable })
    })

    expect(recoverable).not.toHaveBeenCalled()
    expect(errors).not.toHaveBeenCalled()
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
    errors.mockRestore()
    container.remove()
  })
})
