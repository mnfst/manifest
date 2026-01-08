'use client'

import dynamic from 'next/dynamic'
import { InstallCommandInline } from '@/components/blocks/install-command-inline'
import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Maximize2, MessageSquare, PictureInPicture2 } from 'lucide-react'
import { useEffect, useState } from 'react'

const CodeBlock = dynamic(() => import('./code-block').then(m => m.CodeBlock), {
  ssr: false,
  loading: () => <div className="rounded-lg bg-muted p-4 h-12 animate-pulse" />
})

type ViewMode = 'inline' | 'fullwidth' | 'pip' | 'code'
type LayoutMode = 'inline' | 'fullscreen' | 'pip'

interface VariantSectionProps {
  name: string
  component: React.ReactNode
  fullscreenComponent?: React.ReactNode
  registryName: string
  usageCode?: string
  layouts?: LayoutMode[]
}

function CodeViewer({ registryName }: { registryName: string }) {
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCode() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/r/${registryName}.json`)
        if (!response.ok) {
          throw new Error('Failed to fetch component')
        }
        const data = await response.json()
        const content = data.files?.[0]?.content
        if (content) {
          setCode(content)
        } else {
          setError('No source code available')
        }
      } catch {
        setError('Failed to load source code')
      } finally {
        setLoading(false)
      }
    }
    fetchCode()
  }, [registryName])

  if (loading) {
    return (
      <div className="rounded-lg bg-muted p-4 animate-pulse h-[500px]">
        <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2" />
        <div className="h-4 bg-muted-foreground/20 rounded w-1/2 mb-2" />
        <div className="h-4 bg-muted-foreground/20 rounded w-2/3" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-muted p-4 text-muted-foreground text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="max-h-[500px] overflow-y-auto rounded-lg">
      <CodeBlock code={code || ''} language="tsx" />
    </div>
  )
}

function FullwidthPlaceholder({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[300px] bg-muted/30 rounded-lg border border-dashed">
      <Button
        variant="outline"
        size="lg"
        onClick={onOpen}
        className="px-8"
      >
        Open
      </Button>
    </div>
  )
}

export function VariantSection({
  name,
  component,
  fullscreenComponent,
  registryName,
  usageCode,
  layouts = ['inline']
}: VariantSectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('inline')
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)

  // Reset view mode to inline when navigating to a different component
  useEffect(() => {
    setViewMode('inline')
    setIsFullscreenOpen(false)
  }, [registryName])

  const hasFullwidth = layouts.includes('fullscreen')
  const hasPip = layouts.includes('pip')

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{name}</h3>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        {/* 4 Mode buttons: Icons on mobile/tablet, text on desktop */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setViewMode('inline')}
            className={cn(
              'p-1.5 lg:px-3 lg:py-1.5 text-xs font-medium rounded-full transition-colors',
              viewMode === 'inline'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            <MessageSquare className="h-3.5 w-3.5 lg:hidden" />
            <span className="hidden lg:inline">Inline</span>
          </button>
          <button
            disabled={!hasPip}
            onClick={() => hasPip && setViewMode('pip')}
            className={cn(
              'p-1.5 lg:px-3 lg:py-1.5 text-xs font-medium rounded-full transition-colors',
              viewMode === 'pip'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground',
              !hasPip && 'opacity-40 cursor-not-allowed'
            )}
          >
            <PictureInPicture2 className="h-3.5 w-3.5 lg:hidden" />
            <span className="hidden lg:inline">PiP</span>
          </button>
          <button
            disabled={!hasFullwidth}
            onClick={() => hasFullwidth && setViewMode('fullwidth')}
            className={cn(
              'p-1.5 lg:px-3 lg:py-1.5 text-xs font-medium rounded-full transition-colors',
              viewMode === 'fullwidth'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground',
              !hasFullwidth && 'opacity-40 cursor-not-allowed'
            )}
          >
            <Maximize2 className="h-3.5 w-3.5 lg:hidden" />
            <span className="hidden lg:inline">Fullwidth</span>
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={cn(
              'p-1.5 lg:px-3 lg:py-1.5 text-xs font-medium rounded-full transition-colors',
              viewMode === 'code'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="hidden lg:inline">Code</span>
            <span className="lg:hidden">&lt;/&gt;</span>
          </button>
        </div>

        <InstallCommandInline componentName={registryName} />
      </div>

      {/* Content based on view mode */}
      <div>
        {viewMode === 'inline' && component}

        {viewMode === 'fullwidth' && (
          <FullwidthPlaceholder onOpen={() => setIsFullscreenOpen(true)} />
        )}

        {viewMode === 'pip' && (
          <div className="flex items-center justify-center min-h-[300px] bg-muted/30 rounded-lg border border-dashed">
            <p className="text-muted-foreground text-sm">PiP mode coming soon</p>
          </div>
        )}

        {viewMode === 'code' && (
          <div className="space-y-4">
            {usageCode && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Usage:</p>
                <CodeBlock code={usageCode} language="tsx" />
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Source:</p>
              <CodeViewer registryName={registryName} />
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      {isFullscreenOpen && (
        <FullscreenModal
          appName={name}
          onClose={() => setIsFullscreenOpen(false)}
        >
          {fullscreenComponent || component}
        </FullscreenModal>
      )}
    </div>
  )
}
