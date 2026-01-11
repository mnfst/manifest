'use client'

import dynamic from 'next/dynamic'
import { InstallCommandInline } from '@/components/blocks/install-command-inline'
import { ConfigurationViewer } from '@/components/blocks/configuration-viewer'
import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { PipModal } from '@/components/layout/pip-modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Maximize2, MessageSquare, PictureInPicture2, Settings2 } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

const CodeBlock = dynamic(() => import('./code-block').then(m => m.CodeBlock), {
  ssr: false,
  loading: () => <div className="rounded-lg bg-muted p-4 h-12 animate-pulse" />
})

type ViewMode = 'inline' | 'fullwidth' | 'pip' | 'config' | 'code'
type LayoutMode = 'inline' | 'fullscreen' | 'pip'

interface VariantSectionProps {
  name: string
  component: React.ReactNode
  fullscreenComponent?: React.ReactNode
  registryName: string
  usageCode?: string
  layouts?: LayoutMode[]
  hideTitle?: boolean
}

export interface VariantSectionHandle {
  showActionsConfig: () => void
}

interface SourceCodeState {
  code: string | null
  relatedFiles: string[]
  version: string | null
  loading: boolean
  error: string | null
}

function useSourceCode(registryName: string): SourceCodeState {
  const [code, setCode] = useState<string | null>(null)
  const [relatedFiles, setRelatedFiles] = useState<string[]>([])
  const [version, setVersion] = useState<string | null>(null)
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
        const files = data.files || []
        const mainContent = files[0]?.content
        if (mainContent) {
          setCode(mainContent)
          setVersion(data.version || null)
          // Collect all other file contents for type definition extraction
          const otherFiles = files
            .slice(1)
            .map((f: { content?: string }) => f.content)
            .filter(Boolean) as string[]
          setRelatedFiles(otherFiles)
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

  return { code, relatedFiles, version, loading, error }
}

function CodeViewer({ sourceCode }: { sourceCode: SourceCodeState }) {
  const { code, loading, error } = sourceCode

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

export const VariantSection = forwardRef<VariantSectionHandle, VariantSectionProps>(function VariantSection({
  name,
  component,
  fullscreenComponent,
  registryName,
  usageCode,
  layouts = ['inline'],
  hideTitle = false
}, ref) {
  const [viewMode, setViewMode] = useState<ViewMode>('inline')
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)
  const [isPipOpen, setIsPipOpen] = useState(false)
  const [highlightCategory, setHighlightCategory] = useState<'data' | 'actions' | 'appearance' | 'control' | null>(null)
  const sourceCode = useSourceCode(registryName)
  const timeoutRefs = useRef<NodeJS.Timeout[]>([])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(clearTimeout)
    }
  }, [])

  // Expose imperative methods to parent components
  useImperativeHandle(ref, () => ({
    showActionsConfig: () => {
      // Clear any pending timeouts
      timeoutRefs.current.forEach(clearTimeout)
      timeoutRefs.current = []

      setViewMode('config')
      // Trigger the highlight animation
      setHighlightCategory('actions')
      // Wait for the config view to render, then scroll to actions
      const scrollTimeout = setTimeout(() => {
        const actionsElement = document.getElementById('config-actions')
        if (actionsElement) {
          actionsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      timeoutRefs.current.push(scrollTimeout)

      // Clear the highlight after the animation completes (2.5s)
      const highlightTimeout = setTimeout(() => {
        setHighlightCategory(null)
      }, 2600)
      timeoutRefs.current.push(highlightTimeout)
    }
  }), [])

  // Reset view mode to inline when navigating to a different component
  useEffect(() => {
    setViewMode('inline')
    setIsFullscreenOpen(false)
    setIsPipOpen(false)
    setHighlightCategory(null)
  }, [registryName])

  const hasFullwidth = layouts.includes('fullscreen')
  const hasPip = layouts.includes('pip')

  return (
    <div className="space-y-3">
      {/* Row 1: Title + Version (mobile) / Title + Version + Install command (desktop) */}
      {!hideTitle && (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{name}</h2>
            {sourceCode.version && (
              <span className="text-xs text-muted-foreground">V{sourceCode.version}</span>
            )}
          </div>
          <InstallCommandInline componentName={registryName} />
        </div>
      )}
      {hideTitle && (
        <div className="flex justify-end">
          <InstallCommandInline componentName={registryName} />
        </div>
      )}

      {/* Row 2 (desktop) / Row 3 (mobile): Mode buttons */}
      <div className="flex items-center gap-1.5">
        {/* Preview buttons: icon-only on all screen sizes */}
        <button
          onClick={() => setViewMode('inline')}
          className={cn(
            'p-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer',
            viewMode === 'inline'
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
          title="Inline"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
        <button
          disabled={!hasPip}
          onClick={() => hasPip && setViewMode('pip')}
          className={cn(
            'p-1.5 text-xs font-medium rounded-full transition-colors',
            viewMode === 'pip'
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:text-foreground',
            hasPip ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
          )}
          title="Picture in Picture"
        >
          <PictureInPicture2 className="h-3.5 w-3.5" />
        </button>
        <button
          disabled={!hasFullwidth}
          onClick={() => hasFullwidth && setViewMode('fullwidth')}
          className={cn(
            'p-1.5 text-xs font-medium rounded-full transition-colors',
            viewMode === 'fullwidth'
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:text-foreground',
            hasFullwidth ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
          )}
          title="Fullwidth"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>

        {/* Config button: icon on mobile, word on desktop */}
        <button
          onClick={() => setViewMode('config')}
          className={cn(
            'p-1.5 lg:px-3 lg:py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer',
            viewMode === 'config'
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          <Settings2 className="h-3.5 w-3.5 lg:hidden" />
          <span className="hidden lg:inline">Config</span>
        </button>

        {/* Code button: word on all screen sizes */}
        <button
          onClick={() => setViewMode('code')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer',
            viewMode === 'code'
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          Code
        </button>
      </div>

      {/* Content based on view mode */}
      <div>
        {viewMode === 'inline' && component}

        {viewMode === 'fullwidth' && (
          <FullwidthPlaceholder onOpen={() => setIsFullscreenOpen(true)} />
        )}

        {viewMode === 'pip' && (
          <div className="flex items-center justify-center min-h-[300px] bg-muted/30 rounded-lg border border-dashed">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsPipOpen(true)}
              className="px-8"
            >
              Open PiP
            </Button>
          </div>
        )}

        {viewMode === 'config' && (
          <ConfigurationViewer
            sourceCode={sourceCode.code}
            relatedSourceFiles={sourceCode.relatedFiles}
            loading={sourceCode.loading}
            highlightCategory={highlightCategory}
          />
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
              <CodeViewer sourceCode={sourceCode} />
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

      {/* PiP Modal */}
      {isPipOpen && (
        <PipModal
          appName={name}
          onClose={() => setIsPipOpen(false)}
        >
          {component}
        </PipModal>
      )}
    </div>
  )
})
