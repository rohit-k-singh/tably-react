import { describe, expectTypeOf, it } from 'vitest'
import { createColumnHelper, type ColumnDef, type DeepKeys, type DeepValue } from '../src'
import type { Person } from './fixtures'

// These tests are checked at compile time by `npm run typecheck`.
describe('types', () => {
  it('lists nested paths and stops at leaves', () => {
    expectTypeOf<DeepKeys<Person>>().toEqualTypeOf<
      | 'id'
      | 'name'
      | 'age'
      | 'joined'
      | 'active'
      | 'address'
      | 'address.city'
      | 'address.geo'
      | 'address.geo.lat'
      | 'address.geo.lng'
      | 'tags'
      | 'nickname'
    >()
  })

  it('resolves values at a path, keeping optionality', () => {
    expectTypeOf<DeepValue<Person, 'address.city'>>().toEqualTypeOf<string>()
    expectTypeOf<DeepValue<Person, 'address.geo.lat'>>().toEqualTypeOf<number | undefined>()
    expectTypeOf<DeepValue<Person, 'nickname'>>().toEqualTypeOf<string | null | undefined>()
  })

  it('types getValue from accessorKey in plain column arrays', () => {
    const columns: ColumnDef<Person>[] = [
      {
        accessorKey: 'age',
        cell: ({ getValue }) => {
          expectTypeOf(getValue()).toEqualTypeOf<number>()
          return getValue().toFixed(0)
        }
      },
      {
        accessorKey: 'address.geo.lat',
        cell: ({ getValue, row }) => {
          expectTypeOf(getValue()).toEqualTypeOf<number | undefined>()
          expectTypeOf(row.original).toEqualTypeOf<Person>()
          return null
        }
      },
      { id: 'actions', cell: ({ row }) => row.original.name }
    ]
    void columns
  })

  it('rejects unknown keys and accessor columns without id', () => {
    // @ts-expect-error unknown key
    const unknownKey: ColumnDef<Person> = { accessorKey: 'address.zip' }
    // @ts-expect-error accessorFn columns need an id
    const missingId: ColumnDef<Person> = { accessorFn: (row: Person) => row.age }
    void unknownKey
    void missingId
  })

  it('types columns inside groups', () => {
    const columns: ColumnDef<Person>[] = [
      {
        header: 'Person',
        columns: [
          {
            accessorKey: 'age',
            cell: ({ getValue }) => {
              expectTypeOf(getValue()).toEqualTypeOf<number>()
              return null
            }
          },
          { header: 'Nested', columns: [{ accessorKey: 'address.city' }] }
        ]
      }
    ]
    void columns
  })

  it('infers accessorFn values with the column helper', () => {
    const column = createColumnHelper<Person>()
    const columns: ColumnDef<Person>[] = [
      column.accessor((row) => row.joined.getFullYear(), {
        id: 'year',
        cell: ({ getValue }) => {
          expectTypeOf(getValue()).toEqualTypeOf<number>()
          return getValue()
        }
      }),
      column.accessor('tags', {
        cell: ({ getValue }) => {
          expectTypeOf(getValue()).toEqualTypeOf<string[]>()
          return getValue().join(', ')
        }
      })
    ]
    void columns
  })
})
