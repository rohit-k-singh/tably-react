import type { Updater } from './types'

export function functionalUpdate<T>(updater: Updater<T>, previous: T): T {
  return typeof updater === 'function' ? (updater as (previous: T) => T)(previous) : updater
}

/**
 * Memoizes `compute` on the values returned by `getDeps`, compared with
 * `Object.is`. The result is recomputed only when a dependency changes.
 */
export function memo<TDeps extends unknown[], TResult>(
  getDeps: () => [...TDeps],
  compute: (...deps: TDeps) => TResult
): () => TResult {
  let deps: TDeps | undefined
  let result: TResult

  return () => {
    const nextDeps = getDeps()
    const changed =
      !deps || nextDeps.length !== deps.length || nextDeps.some((dep, i) => !Object.is(dep, deps![i]))

    if (changed) {
      deps = nextDeps
      result = compute(...nextDeps)
    }
    return result
  }
}

/** Reads a dot-separated path such as `'address.city'` from an object. */
export function getByPath(source: unknown, path: string): unknown {
  if (source == null || typeof source !== 'object') return undefined
  if (path in source) return (source as Record<string, unknown>)[path]

  let value: unknown = source
  for (const key of path.split('.')) {
    if (value == null) return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}
