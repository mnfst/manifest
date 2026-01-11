'use client'

import { X } from 'lucide-react'
import { ReactNode } from 'react'

export interface PipModalProps {
  children: ReactNode
  appName: string
  onClose?: () => void
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
export function PipModal({ children, appName, onClose }: PipModalProps) {
  return (
    <>
      {/* Backdrop - subtle overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* PiP Window - fixed floating container */}
      <div className="fixed top-20 right-4 md:right-8 z-50 w-[min(400px,calc(100vw-2rem))] max-h-[calc(100vh-8rem)] flex flex-col bg-background rounded-xl shadow-2xl border overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
        {/* Header */}
        <header className="flex h-11 shrink-0 items-center justify-between border-b px-3 bg-muted/30">
          <span className="text-sm font-medium truncate">{appName}</span>

          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close PiP"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto overscroll-contain p-4">
          {children}
        </div>

        {/* Footer indicator */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50" />
      </div>
    </>
  )
}
