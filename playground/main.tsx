import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Table, type ColumnDef } from '../src'
import '../src/styles.css'

interface Person {
  id: number
  name: string
  email: string
  role: 'Admin' | 'Editor' | 'Viewer'
  address: { city: string; country: string }
}

const people: Person[] = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: 'Admin', address: { city: 'London', country: 'UK' } },
  { id: 2, name: 'Alan Turing', email: 'alan@example.com', role: 'Editor', address: { city: 'Manchester', country: 'UK' } },
  { id: 3, name: 'Grace Hopper', email: 'grace@example.com', role: 'Viewer', address: { city: 'Arlington', country: 'USA' } }
]

const columns: ColumnDef<Person>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'address.city', header: 'City' },
  { accessorKey: 'role', header: 'Role', cell: ({ getValue }) => <strong>{getValue()}</strong> }
]

const getRowId = (person: Person) => String(person.id)

function App() {
  const [loading, setLoading] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [selected, setSelected] = useState<Person | null>(null)

  return (
    <main style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>tably-react playground</h1>
      <p>
        <label>
          <input type="checkbox" checked={loading} onChange={(e) => setLoading(e.target.checked)} /> Loading
        </label>{' '}
        <label>
          <input type="checkbox" checked={empty} onChange={(e) => setEmpty(e.target.checked)} /> Empty
        </label>
      </p>
      <Table
        aria-label="People"
        data={empty ? [] : people}
        columns={columns}
        loading={loading}
        getRowId={getRowId}
        onRowClick={(person) => setSelected(person)}
      />
      <p>Selected: {selected ? selected.name : 'none'}</p>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
