'use client'

import { Maximize2, X } from 'lucide-react'
import { ReactNode } from 'react'

export interface PipModalProps {
  children: ReactNode
  appName: string
  onClose?: () => void
  onExpand?: () => void
  /** Position and width to match the inline content */
  position?: { left: number; width: number }
}

/**
 * Picture-in-Picture modal that simulates ChatGPT's PiP container.
 *
 * A persistent floating window optimized for ongoing or live sessions.
 * PiP remains visible while the conversation continues and stays fixed
 * to the top of the viewport on scroll.
 *
 * IMPORTANT: This is for PREVIEW mode only on our website.
 * In real ChatGPT environments, the HOST controls the PiP container.
 * Our components should NOT render this directly - they call requestDisplayMode('pip')
 * and the host wraps them in their own PiP container.
 */
export function PipModal({ children, onClose, onExpand, position }: PipModalProps) {
  return (
    <>
      {/* PiP Window - just the component with shadow and close button */}
      <div
        className="fixed top-20 z-50"
        style={position ? { left: position.left, width: position.width } : { right: 16, width: 'min(400px, calc(100vw - 2rem))' }}
      >
        {/* Close button - top left, floating over content */}
        <button
          onClick={onClose}
          className="absolute -top-3 -left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black text-white shadow-lg hover:bg-black/80 transition-colors cursor-pointer"
          aria-label="Close PiP"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Expand button - top right, floating over content */}
        {onExpand && (
          <button
            onClick={onExpand}
            className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black text-white shadow-lg hover:bg-black/80 transition-colors cursor-pointer"
            aria-label="Expand to fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}

        {/* Content - just the component with rounded corners and shadow */}
        <div className="rounded-2xl overflow-hidden shadow-lg">
          {children}
        </div>
      </div>
    </>
  )
}
