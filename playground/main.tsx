import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Table, type TableColumn } from '../src'
import '../src/styles.css'

interface Person {
  id: number
  name: string
  email: string
  role: string
}

const people: Person[] = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: 'Admin' },
  { id: 2, name: 'Alan Turing', email: 'alan@example.com', role: 'Editor' },
  { id: 3, name: 'Grace Hopper', email: 'grace@example.com', role: 'Viewer' }
]

const columns: TableColumn<Person>[] = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
  { key: 'role', header: 'Role', render: (value) => <strong>{String(value)}</strong> }
]

function App() {
  const [loading, setLoading] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [selected, setSelected] = useState<Person | null>(null)

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
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
        getRowKey={(row) => row.id}
        onRowClick={setSelected}
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
