import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefObject
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from './cx'

export interface PopoverProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  /** Called on Escape (`restoreFocus` true) or a pointer down outside the anchor and popover. */
  onClose: (restoreFocus: boolean) => void
  /** Selector of the element to focus when the popover opens. Defaults to its first control. */
  initialFocus?: string
  children: ReactNode
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Floating panel next to an anchor. It renders into the nearest table
 * container (so theme variables apply and scroll areas do not clip it), or
 * into the document body outside a table.
 */
export function Popover({
  anchorRef,
  open,
  onClose,
  initialFocus = 'button:not(:disabled), input:not(:disabled), select, [tabindex="0"]',
  children,
  className,
  style,
  ...props
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Transparent (not hidden) until positioned, so the initial focus still works.
  const [position, setPosition] = useState<CSSProperties>({ opacity: 0 })
  const [host, setHost] = useState<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useIsomorphicLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    if (!anchor) return
    const container = anchor.closest<HTMLElement>('.tably-container')
    setHost(container ?? document.body)

    const update = () => {
      const panel = panelRef.current
      if (!panel) return
      const anchorRect = anchor.getBoundingClientRect()
      const panelWidth = panel.offsetWidth
      const gap = 4
      // Align with the anchor's start edge, or its end edge when that would overflow the viewport.
      let left = anchorRect.left
      if (left + panelWidth > window.innerWidth - 8) left = Math.max(8, anchorRect.right - panelWidth)
      const top = anchorRect.bottom + gap

      if (container) {
        const containerRect = container.getBoundingClientRect()
        setPosition({
          position: 'absolute',
          top: top - containerRect.top - container.clientTop,
          left: left - containerRect.left - container.clientLeft
        })
      } else {
        setPosition({ position: 'fixed', top, left })
      }
    }

    update()
    const frame = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef, host])

  useEffect(() => {
    if (open && host) panelRef.current?.querySelector<HTMLElement>(initialFocus)?.focus()
  }, [open, host, initialFocus])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!panelRef.current?.contains(target) && !anchorRef.current?.contains(target)) onCloseRef.current(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, anchorRef])

  if (!open || !host) return null

  return createPortal(
    <div
      {...props}
      ref={panelRef}
      className={cx('tably-popover', className)}
      style={{ ...position, ...style }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event)
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.stopPropagation()
          onCloseRef.current(true)
        }
      }}
    >
      {children}
    </div>,
    host
  )
}
