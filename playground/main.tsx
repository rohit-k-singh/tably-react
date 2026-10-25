import { StrictMode, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Table, TableColumnsMenu, TableSearch, type ColumnDef, type TableProps } from '../src'
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

function makePeople(count: number): Person[] {
  return Array.from({ length: count }, (_, i) => {
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
}

const people = makePeople(25)

const columns: ColumnDef<Person>[] = [
  {
    header: 'Person',
    columns: [
      { accessorKey: 'name', header: 'Name', minWidth: 160 },
      { accessorKey: 'email', header: 'Email', width: 260 },
      { accessorKey: 'age', header: 'Age', align: 'end', width: 140 }
    ]
  },
  {
    header: 'Work',
    columns: [
      { accessorKey: 'role', header: 'Role', cell: ({ getValue }) => <strong>{getValue()}</strong> },
      { accessorKey: 'joined', header: 'Joined', cell: ({ getValue }) => getValue().toLocaleDateString() },
      { accessorKey: 'active', header: 'Active', cell: ({ getValue }) => (getValue() ? 'Yes' : 'No') }
    ]
  },
  { accessorKey: 'address.city', header: 'City' },
  {
    id: 'actions',
    header: '',
    width: 90,
    enableHiding: false,
    cell: ({ row }) => (
      <button
        onClick={(event) => {
          event.stopPropagation()
          alert(row.original.name)
        }}
      >
        View
      </button>
    )
  }
]

const getRowId = (person: Person) => String(person.id)

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  )
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: T
  options: T[]
  onChange: (value: T) => void
}) {
  return (
    <label>
      {label}{' '}
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function Controls({ children }: { children: ReactNode }) {
  return <p style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.25rem' }}>{children}</p>
}

function App() {
  const [loading, setLoading] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [filters, setFilters] = useState(true)
  const [striped, setStriped] = useState(false)
  const [bordered, setBordered] = useState(false)
  const [dragging, setDragging] = useState(true)
  const [resizing, setResizing] = useState(true)
  const [sticky, setSticky] = useState(true)
  const [theme, setTheme] = useState<NonNullable<TableProps<Person>['theme']>>('light')
  const [density, setDensity] = useState<NonNullable<TableProps<Person>['density']>>('standard')
  const [selected, setSelected] = useState<Person | null>(null)

  return (
    <main style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>tably-react playground</h1>
      <Controls>
        <Toggle label="Loading" value={loading} onChange={setLoading} />
        <Toggle label="Empty" value={empty} onChange={setEmpty} />
        <Toggle label="Column filters" value={filters} onChange={setFilters} />
        <Toggle label="Striped" value={striped} onChange={setStriped} />
        <Toggle label="Bordered" value={bordered} onChange={setBordered} />
        <Toggle label="Drag headers" value={dragging} onChange={setDragging} />
        <Toggle label="Resizable" value={resizing} onChange={setResizing} />
        <Toggle label="Sticky header" value={sticky} onChange={setSticky} />
        <Choice label="Theme" value={theme} options={['light', 'dark', 'auto']} onChange={setTheme} />
        <Choice
          label="Density"
          value={density}
          options={['compact', 'standard', 'comfortable']}
          onChange={setDensity}
        />
      </Controls>
      <Table
        caption="Team directory"
        data={empty ? [] : people}
        columns={columns}
        loading={loading}
        getRowId={getRowId}
        showColumnFilters={filters}
        enableColumnDragging={dragging}
        enableColumnResizing={resizing}
        enableColumnActions
        stickyHeader={sticky}
        maxHeight={sticky ? 420 : undefined}
        initialState={{ pagination: { pageIndex: 0, pageSize: 10 }, columnPinning: { left: ['name'], right: ['actions'] } }}
        theme={theme}
        density={density}
        striped={striped}
        bordered={bordered}
        highlightOnHover
        enablePagination
        pageSizeOptions={[5, 10, 25]}
        toolbar={(table) => (
          <>
            <TableSearch table={table} />
            <TableColumnsMenu table={table} />
            <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
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
