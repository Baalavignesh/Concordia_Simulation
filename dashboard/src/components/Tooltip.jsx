import { useState, useId, useRef, useLayoutEffect, cloneElement, isValidElement } from 'react'
import { createPortal } from 'react-dom'

/**
 * Accessible tooltip. Shows on hover or keyboard-focus.
 *
 * The bubble is rendered into document.body via a portal so it escapes any
 * ancestor `overflow: hidden|auto` clipping or z-index stacking contexts —
 * critical for tooltips inside scrollable tables.
 */
export default function Tooltip({ content, children, side = 'top', maxWidth = 280, asChild = true }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const triggerRef = useRef(null)
  const bubbleRef = useRef(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const update = () => {
      const rect = triggerRef.current.getBoundingClientRect()
      setCoords({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
      })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  if (!content) return children

  const triggerProps = {
    ref: triggerRef,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    'aria-describedby': open ? id : undefined,
  }

  const bubble = open && coords ? createPortal(
    <BubbleFloat id={id} side={side} coords={coords} maxWidth={maxWidth} bubbleRef={bubbleRef}>
      {content}
    </BubbleFloat>,
    document.body
  ) : null

  if (asChild && isValidElement(children)) {
    return (
      <>
        {cloneElement(children, triggerProps)}
        {bubble}
      </>
    )
  }

  return (
    <>
      <span tabIndex={0} {...triggerProps}>{children}</span>
      {bubble}
    </>
  )
}

function BubbleFloat({ id, side, coords, maxWidth, bubbleRef, children }) {
  // Position so that the bubble is centered on the trigger, with collision
  // detection against the viewport edges.
  const pos = computePosition(side, coords, maxWidth)

  return (
    <div
      id={id}
      ref={bubbleRef}
      role="tooltip"
      className="fixed z-[9999] px-2.5 py-1.5 rounded bg-gray-900 text-white text-xs font-normal leading-snug shadow-lg pointer-events-none"
      style={{
        top: pos.top,
        left: pos.left,
        maxWidth,
        minWidth: 120,
      }}
    >
      {children}
    </div>
  )
}

function computePosition(side, rect, maxWidth) {
  const GAP = 6
  const PAD = 8
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768

  let top, left

  if (side === 'top' || side === 'bottom') {
    // Center horizontally on trigger, clamp to viewport
    const centerX = rect.left + rect.width / 2
    left = centerX - maxWidth / 2
    left = Math.max(PAD, Math.min(left, vw - maxWidth - PAD))

    if (side === 'top') {
      // Assume bubble height ~ 60; if no room above, flip to bottom
      const estHeight = 60
      if (rect.top < estHeight + GAP + PAD) {
        top = rect.bottom + GAP
      } else {
        top = rect.top - estHeight - GAP
      }
    } else {
      top = rect.bottom + GAP
    }
  } else {
    // left/right
    const centerY = rect.top + (rect.bottom - rect.top) / 2
    top = centerY - 20
    top = Math.max(PAD, Math.min(top, vh - 60 - PAD))

    if (side === 'left') {
      left = rect.left - maxWidth - GAP
      if (left < PAD) left = rect.right + GAP
    } else {
      left = rect.right + GAP
      if (left + maxWidth > vw - PAD) left = rect.left - maxWidth - GAP
    }
  }

  return { top, left }
}
