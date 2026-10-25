import { createElement, type ComponentClass, type ExoticComponent, type ReactNode } from 'react'
import type { Renderable } from '../core/types'

const EXOTIC_COMPONENT_TYPES = new Set([Symbol.for('react.memo'), Symbol.for('react.forward_ref')])

/**
 * Renders a column `header` or `cell` definition. Static content is returned
 * as is, functions are called with the context, and components (class,
 * `memo` or `forwardRef`) are rendered with the context as props.
 */
export function flexRender<TContext extends object>(
  renderable: Renderable<TContext>,
  context: TContext
): ReactNode {
  if (isComponent(renderable)) return createElement(renderable, context)
  if (typeof renderable === 'function') return (renderable as (context: TContext) => ReactNode)(context)
  return renderable as ReactNode
}

function isComponent(value: unknown): value is ComponentClass<any> | ExoticComponent<any> {
  if (typeof value === 'function') {
    return !!(value as { prototype?: { isReactComponent?: unknown } }).prototype?.isReactComponent
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    EXOTIC_COMPONENT_TYPES.has((value as { $$typeof?: symbol }).$$typeof as symbol)
  )
}
