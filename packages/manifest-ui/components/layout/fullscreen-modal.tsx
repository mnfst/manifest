'use client'

import { Button } from '@/components/ui/button'
import { ArrowUpRight, X } from 'lucide-react'
import { ReactNode } from 'react'

export interface FullscreenModalProps {
  children: ReactNode
  appName: string
  appUrl?: string
  onClose?: () => void
}

/**
 * Fullscreen modal that simulates the host's fullscreen container.
 *
 * IMPORTANT: This is for PREVIEW mode only on our website.
 * In real ChatGPT/Claude environments, the HOST controls the fullscreen container.
 * Our components should NOT render this directly - they call requestDisplayMode('fullscreen')
 * and the host wraps them in their own fullscreen container.
 *
 * Usage (in preview wrapper, NOT in distributed components):
 * ```tsx
 * {isFullscreen && (
 *   <FullscreenModal appName="My App" onClose={() => setIsFullscreen(false)}>
 *     <MyComponent displayMode="fullscreen" />
 *   </FullscreenModal>
 * )}
 * ```
 */
export function FullscreenModal({
  children,
  appName,
  appUrl,
  onClose
}: FullscreenModalProps) {
  return (
    <div className="fixed top-14 bottom-0 left-0 right-0 md:left-[226px] z-[1100] flex flex-col bg-background">
      {/* Header - simulates ChatGPT's fullscreen header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <span className="text-sm font-medium">{appName}</span>

        {appUrl ? (
          <Button variant="outline" size="sm" asChild>
            <a href={appUrl} target="_blank" rel="noopener noreferrer">
              Open in {appName}
              <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <div className="w-8" />
        )}
      </header>

      {/* Content - full width/height white background with centered content */}
      <div className="flex-1 overflow-auto overscroll-contain bg-white dark:bg-zinc-950 flex justify-center p-8">
        {children}
      </div>
    </div>
  )
}
