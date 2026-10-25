export interface Person {
  id: number
  name: string
  age: number
  joined: Date
  active: boolean
  address: {
    city: string
    geo?: { lat: number; lng: number }
  }
  tags: string[]
  nickname?: string | null
}

export const people: Person[] = [
  {
    id: 1,
    name: 'Ada',
    age: 36,
    joined: new Date('2020-01-15'),
    active: true,
    address: { city: 'London', geo: { lat: 51.5, lng: -0.12 } },
    tags: ['math', 'computing']
  },
  {
    id: 2,
    name: 'Linus',
    age: 54,
    joined: new Date('2018-06-01'),
    active: false,
    address: { city: 'Portland' },
    tags: ['kernel'],
    nickname: 'torvalds'
  },
  {
    id: 3,
    name: 'Grace',
    age: 85,
    joined: new Date('2019-03-10'),
    active: true,
    address: { city: 'Arlington' },
    tags: []
  }
]
