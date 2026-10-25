import { useEffect, useRef, useState } from 'react'

/**
 * Local input state that commits to `commit` after `delay` ms of inactivity
 * (immediately when `delay` is 0), and follows `externalValue` when it is
 * changed from outside, e.g. by a reset.
 */
export function useDebouncedState<T>(
  externalValue: T,
  commit: (value: T) => void,
  delay: number,
  isEqual: (a: T, b: T) => boolean = Object.is
) {
  const [value, setValue] = useState(externalValue)
  const committed = useRef(externalValue)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const commitRef = useRef(commit)
  commitRef.current = commit

  useEffect(() => {
    if (!isEqual(externalValue, committed.current)) {
      committed.current = externalValue
      clearTimeout(timer.current)
      setValue(externalValue)
    }
  })

  useEffect(() => () => clearTimeout(timer.current), [])

  const update = (next: T) => {
    setValue(next)
    clearTimeout(timer.current)
    const run = () => {
      committed.current = next
      commitRef.current(next)
    }
    if (delay > 0) timer.current = setTimeout(run, delay)
    else run()
  }

  return [value, update] as const
}
