import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTable, type ColumnDef } from '../src'
import { people, type Person } from './fixtures'

const columns: ColumnDef<Person>[] = [{ accessorKey: 'name' }, { accessorKey: 'age' }]

describe('useTable', () => {
  it('returns a stable instance with the latest options', () => {
    const { result, rerender } = renderHook(({ data }) => useTable({ data, columns }), {
      initialProps: { data: people }
    })
    const table = result.current
    expect(table.getRowModel().rows).toHaveLength(3)

    rerender({ data: people.slice(1) })

    expect(result.current).toBe(table)
    expect(table.getRowModel().rows.map((row) => row.original.name)).toEqual(['Linus', 'Grace'])
  })
})
