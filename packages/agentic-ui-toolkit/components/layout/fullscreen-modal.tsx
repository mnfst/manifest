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

export function FullscreenModal({
  children,
  appName,
  appUrl,
  onClose
}: FullscreenModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
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

      {/* Content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
