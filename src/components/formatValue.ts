import { isValidElement, type ReactNode } from 'react'

/** Default cell content when a column has no `cell` renderer. */
export function formatValue(value: unknown): ReactNode {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toLocaleString()
  if (isValidElement(value)) return value
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).join(', ')
  return String(value)
}
