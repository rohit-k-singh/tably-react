import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export interface VirtualizerOptions {
  /** Number of items. */
  count: number
  /** The scrolling element. */
  getScrollElement: () => HTMLElement | null
  /** Estimated item height in pixels, used until an item is measured. */
  estimateSize: (index: number) => number
  /** Stable key per item, so measured heights follow items when they move. Defaults to the index. */
  getItemKey?: (index: number) => string | number
  /** Items rendered above and below the visible ones. Defaults to 5. */
  overscan?: number
  /**
   * Distance from the top of the scroll content to the first item, e.g. a
   * table header's height. Called whenever the visible range is computed.
   */
  getScrollMargin?: () => number
  /** Viewport height assumed before measuring (e.g. during server rendering). Defaults to 400. */
  initialViewportHeight?: number
  /** Turns virtualization off: every item is returned. */
  enabled?: boolean
}

export interface VirtualItem {
  index: number
  key: string | number
  /** Offset from the first item, in pixels. */
  start: number
  size: number
}

export interface Virtualizer {
  /** The items to render. */
  items: VirtualItem[]
  /** Height of all items together. */
  totalSize: number
  /** Space to leave above the first rendered item. */
  paddingStart: number
  /** Space to leave below the last rendered item. */
  paddingEnd: number
  /**
   * Ref callback for rendered item elements. They need a `data-index`
   * attribute; several elements with the same index (e.g. a row and its
   * detail row) are measured together.
   */
  measureElement: (element: Element | null) => void
  /** Scrolls so the item is visible. */
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end' | 'auto') => void
}

/** Finds the first index whose item ends after `offset`. */
function findStart(starts: Float64Array, count: number, offset: number): number {
  let low = 0
  let high = count - 1
  while (low < high) {
    const middle = (low + high) >> 1
    if (starts[middle + 1] <= offset) low = middle + 1
    else high = middle
  }
  return low
}

/**
 * Renders only the items in view in a scrolling element, measuring their
 * real heights as they render. Dependency-free; used by `<Table enableVirtualization>`.
 */
export function useVirtualizer(options: VirtualizerOptions): Virtualizer {
  const { count, estimateSize, getItemKey, overscan = 5, enabled = true, initialViewportHeight = 400 } = options
  const [, rerender] = useReducer((value: number) => value + 1, 0)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const sizes = useRef(new Map<string | number, number>())
  const viewport = useRef({ scrollTop: 0, height: initialViewportHeight })
  const [version, bumpVersion] = useReducer((value: number) => value + 1, 0)
  const elements = useRef(new Map<number, Set<Element>>())
  const elementIndex = useRef(new Map<Element, number>())

  const keyAt = useCallback((index: number) => (getItemKey ? getItemKey(index) : index), [getItemKey])

  const starts = useMemo(() => {
    const result = new Float64Array(count + 1)
    for (let index = 0; index < count; index++) {
      result[index + 1] = result[index] + (sizes.current.get(keyAt(index)) ?? estimateSize(index))
    }
    return result
    // `version` changes when measurements change.
  }, [count, keyAt, estimateSize, version])

  // Track scrolling and the viewport size.
  useIsomorphicLayoutEffect(() => {
    if (!enabled) return
    const element = optionsRef.current.getScrollElement()
    if (!element) return
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = { scrollTop: element.scrollTop, height: element.clientHeight || viewport.current.height }
        if (next.scrollTop !== viewport.current.scrollTop || next.height !== viewport.current.height) {
          viewport.current = next
          rerender()
        }
      })
    }
    viewport.current = { scrollTop: element.scrollTop, height: element.clientHeight || viewport.current.height }
    rerender()
    element.addEventListener('scroll', update, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update)
    observer?.observe(element)
    return () => {
      cancelAnimationFrame(frame)
      element.removeEventListener('scroll', update)
      observer?.disconnect()
    }
  }, [enabled])

  // Measure rendered items.
  const resizeObserver = useMemo(() => {
    if (typeof ResizeObserver === 'undefined') return undefined
    let frame = 0
    const dirty = new Set<number>()
    return new ResizeObserver((entries) => {
      for (const entry of entries) {
        const index = elementIndex.current.get(entry.target)
        if (index !== undefined) dirty.add(index)
      }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        let changed = false
        for (const index of dirty) {
          const group = elements.current.get(index)
          if (!group || index >= optionsRef.current.count) continue
          let size = 0
          for (const element of group) size += element.getBoundingClientRect().height
          const key = optionsRef.current.getItemKey ? optionsRef.current.getItemKey(index) : index
          if (size > 0 && sizes.current.get(key) !== size) {
            sizes.current.set(key, size)
            changed = true
          }
        }
        dirty.clear()
        if (changed) bumpVersion()
      })
    })
  }, [])

  useEffect(() => () => resizeObserver?.disconnect(), [resizeObserver])

  const measureElement = useCallback(
    (element: Element | null) => {
      if (!element || !resizeObserver) return
      const index = Number((element as HTMLElement).dataset.index)
      if (Number.isNaN(index)) return

      // Elements are re-rendered with new indexes as the list scrolls; keep the maps in sync.
      const previousIndex = elementIndex.current.get(element)
      if (previousIndex !== undefined && previousIndex !== index) elements.current.get(previousIndex)?.delete(element)
      elementIndex.current.set(element, index)
      let group = elements.current.get(index)
      if (!group) elements.current.set(index, (group = new Set()))
      for (const other of group) {
        if (!other.isConnected) {
          group.delete(other)
          elementIndex.current.delete(other)
          resizeObserver.unobserve(other)
        }
      }
      group.add(element)
      resizeObserver.observe(element)
    },
    [resizeObserver]
  )

  const totalSize = starts[count] ?? 0
  let items: VirtualItem[]
  if (!enabled || count === 0) {
    items = Array.from({ length: count }, (_, index) => ({
      index,
      key: keyAt(index),
      start: starts[index],
      size: starts[index + 1] - starts[index]
    }))
  } else {
    const margin = optionsRef.current.getScrollMargin?.() ?? 0
    const top = Math.max(0, viewport.current.scrollTop - margin)
    const bottom = top + viewport.current.height
    const first = Math.max(0, findStart(starts, count, top) - overscan)
    // The item containing the last visible pixel (an item starting exactly at `bottom` is not visible).
    let last = findStart(starts, count, Math.max(top, bottom - 1))
    last = Math.min(count - 1, last + overscan)
    items = []
    for (let index = first; index <= last; index++) {
      items.push({ index, key: keyAt(index), start: starts[index], size: starts[index + 1] - starts[index] })
    }
  }

  const scrollToIndex = useCallback(
    (index: number, align: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
      const element = optionsRef.current.getScrollElement()
      if (!element) return
      const clamped = Math.max(0, Math.min(index, optionsRef.current.count - 1))
      const margin = optionsRef.current.getScrollMargin?.() ?? 0
      const start = starts[clamped] + margin
      const end = starts[clamped + 1] + margin
      const height = element.clientHeight
      let target = element.scrollTop
      if (align === 'start') target = start - margin
      else if (align === 'end') target = end - height
      else if (align === 'center') target = (start + end) / 2 - height / 2
      else if (start - margin < element.scrollTop) target = start - margin
      else if (end > element.scrollTop + height) target = end - height
      element.scrollTop = Math.max(0, target)
    },
    [starts]
  )

  const firstItem = items[0]
  const lastItem = items[items.length - 1]
  return {
    items,
    totalSize,
    paddingStart: enabled && firstItem ? firstItem.start : 0,
    paddingEnd: enabled && lastItem ? totalSize - (lastItem.start + lastItem.size) : 0,
    measureElement,
    scrollToIndex
  }
}
