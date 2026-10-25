import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Table, TableSearch, type ColumnDef } from '../src'
import '../src/styles.css'

interface Person {
  id: number
  name: string
  email: string
  role: 'Admin' | 'Editor' | 'Viewer'
  age: number
  joined: Date
  active: boolean
  address: { city: string; country: string }
}

const FIRST = ['Ada', 'Alan', 'Grace', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Frances', 'Edsger']
const LAST = ['Lovelace', 'Turing', 'Hopper', 'Torvalds', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson', 'Allen', 'Dijkstra']
const CITIES = [
  { city: 'London', country: 'UK' },
  { city: 'Manchester', country: 'UK' },
  { city: 'Arlington', country: 'USA' },
  { city: 'Helsinki', country: 'Finland' },
  { city: 'Boston', country: 'USA' }
]
const ROLES: Person['role'][] = ['Admin', 'Editor', 'Viewer']

const people: Person[] = Array.from({ length: 25 }, (_, i) => {
  const first = FIRST[i % FIRST.length]
  const last = LAST[(i * 3) % LAST.length]
  return {
    id: i + 1,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    role: ROLES[i % ROLES.length],
    age: 22 + ((i * 7) % 50),
    joined: new Date(2015 + (i % 10), (i * 5) % 12, 1 + ((i * 11) % 28)),
    active: i % 4 !== 0,
    address: CITIES[i % CITIES.length]
  }
})

const columns: ColumnDef<Person>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'age', header: 'Age' },
  { accessorKey: 'joined', header: 'Joined', cell: ({ getValue }) => getValue().toLocaleDateString() },
  { accessorKey: 'address.city', header: 'City' },
  { accessorKey: 'role', header: 'Role', cell: ({ getValue }) => <strong>{getValue()}</strong> },
  { accessorKey: 'active', header: 'Active', cell: ({ getValue }) => (getValue() ? 'Yes' : 'No') },
  { id: 'actions', header: '', cell: ({ row }) => (
      <button
        onClick={(event) => {
          event.stopPropagation()
          alert(row.original.name)
        }}
      >
        View
      </button>
    ) }
]

const getRowId = (person: Person) => String(person.id)

function App() {
  const [loading, setLoading] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [filters, setFilters] = useState(true)
  const [selected, setSelected] = useState<Person | null>(null)

  return (
    <main style={{ maxWidth: 1100, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>tably-react playground</h1>
      <p>
        <label>
          <input type="checkbox" checked={loading} onChange={(e) => setLoading(e.target.checked)} /> Loading
        </label>{' '}
        <label>
          <input type="checkbox" checked={empty} onChange={(e) => setEmpty(e.target.checked)} /> Empty
        </label>{' '}
        <label>
          <input type="checkbox" checked={filters} onChange={(e) => setFilters(e.target.checked)} /> Column filters
        </label>
      </p>
      <Table
        aria-label="People"
        data={empty ? [] : people}
        columns={columns}
        loading={loading}
        getRowId={getRowId}
        showColumnFilters={filters}
        enablePagination
        initialState={{ pagination: { pageIndex: 0, pageSize: 5 } }}
        pageSizeOptions={[5, 10, 25]}
        toolbar={(table) => (
          <>
            <TableSearch table={table} />
            <span style={{ marginLeft: 'auto', color: '#6b7280' }}>
              {table.getFilteredRowModel().rows.length} of {table.getCoreRowModel().rows.length} people
            </span>
          </>
        )}
        onRowClick={(person) => setSelected(person)}
      />
      <p>Selected: {selected ? selected.name : 'none'}. Shift-click headers to sort by several columns.</p>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
