'use client'

import dynamic from 'next/dynamic'
import { CopyLinkButton } from '@/components/blocks/copy-link-button'
import { InstallCommandInline } from '@/components/blocks/install-command-inline'
import { ConfigurationViewer } from '@/components/blocks/configuration-viewer'
import { DependencyViewer, hasExternalDeps } from '@/components/blocks/dependency-viewer'
import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { PipModal } from '@/components/layout/pip-modal'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Maximize2, MessageSquare, PictureInPicture2, Settings2 } from 'lucide-react'
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'

const CodeBlock = dynamic(() => import('./code-block').then(m => m.CodeBlock), {
  ssr: false,
  loading: () => <div className="rounded-lg bg-muted p-4 h-12 animate-pulse" />
})

type ViewMode = 'inline' | 'fullwidth' | 'pip' | 'config' | 'code' | 'deps'
type LayoutMode = 'inline' | 'fullscreen' | 'pip'

interface VariantSectionProps {
  name: string
  component: React.ReactNode
  pipComponent?: React.ReactNode
  fullscreenComponent?: React.ReactNode
  registryName: string
  usageCode?: string
  layouts?: LayoutMode[]
  hideTitle?: boolean
  variantId?: string
}

export interface VariantSectionHandle {
  showActionsConfig: () => void
  showDepsTab: () => void
}

interface ChangelogEntry {
  version: string
  description: string
}

interface SourceCodeState {
  code: string | null
  relatedFiles: string[]
  version: string | null
  changelog: ChangelogEntry[]
  dependencies: string[]
  devDependencies: string[]
  loading: boolean
  error: string | null
}

function useSourceCode(registryName: string): SourceCodeState {
  const [code, setCode] = useState<string | null>(null)
  const [relatedFiles, setRelatedFiles] = useState<string[]>([])
  const [version, setVersion] = useState<string | null>(null)
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([])
  const [dependencies, setDependencies] = useState<string[]>([])
  const [devDependencies, setDevDependencies] = useState<string[]>([])
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
          // Parse changelog from injected data
          if (data.changelog && typeof data.changelog === 'object') {
            const entries: ChangelogEntry[] = Object.entries(data.changelog)
              .map(([ver, desc]) => ({ version: ver, description: desc as string }))
              .sort((a, b) => {
                // Sort by version descending (newest first)
                const [aMajor, aMinor, aPatch] = a.version.split('.').map(Number)
                const [bMajor, bMinor, bPatch] = b.version.split('.').map(Number)
                const aTotal = aMajor * 10000 + aMinor * 100 + aPatch
                const bTotal = bMajor * 10000 + bMinor * 100 + bPatch
                return bTotal - aTotal
              })
            setChangelog(entries)
          } else {
            setChangelog([])
          }
          setDependencies(data.dependencies || [])
          setDevDependencies(data.devDependencies || [])
          // Collect all other file contents for type definition extraction
          const otherFiles = files
            .slice(1)
            .map((f: { content?: string }) => f.content)
            .filter(Boolean) as string[]

          // Fetch type definitions from registry dependencies (e.g. manifest-types)
          const registryDeps: string[] = data.registryDependencies || []
          const typeDepFiles = await Promise.all(
            registryDeps
              .filter((dep: string) => dep.includes('types'))
              .map(async (dep: string) => {
                try {
                  // Handle both full URLs and short registry names
                  const depUrl = dep.startsWith('http') ? dep : `/r/${dep}.json`
                  const depRes = await fetch(depUrl)
                  if (!depRes.ok) return []
                  const depData = await depRes.json()
                  return (depData.files || [])
                    .map((f: { content?: string }) => f.content)
                    .filter(Boolean) as string[]
                } catch {
                  return []
                }
              })
          )

          setRelatedFiles([...otherFiles, ...typeDepFiles.flat()])
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

  return { code, relatedFiles, version, changelog, dependencies, devDependencies, loading, error }
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
  pipComponent,
  fullscreenComponent,
  registryName,
  usageCode,
  layouts = ['inline'],
  hideTitle = false,
  variantId
}, ref) {
  // Determine default view mode based on available layouts
  const getDefaultViewMode = useCallback((): ViewMode => {
    if (layouts.includes('inline')) return 'inline'
    if (layouts.includes('fullscreen')) return 'fullwidth'
    if (layouts.includes('pip')) return 'pip'
    return 'inline'
  }, [layouts])
  const [viewMode, setViewMode] = useState<ViewMode>(getDefaultViewMode)
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)
  const [isPipOpen, setIsPipOpen] = useState(false)
  const [pipPosition, setPipPosition] = useState<{ left: number; width: number } | undefined>()
  const [highlightCategory, setHighlightCategory] = useState<'data' | 'actions' | 'appearance' | 'control' | null>(null)
  const sourceCode = useSourceCode(registryName)
  const timeoutRefs = useRef<NodeJS.Timeout[]>([])
  const contentRef = useRef<HTMLDivElement>(null)

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
    },
    showDepsTab: () => {
      setViewMode('deps')
    }
  }), [])

  // Reset view mode when navigating to a different component
  useEffect(() => {
    setViewMode(getDefaultViewMode())
    setIsFullscreenOpen(false)
    setIsPipOpen(false)
    setPipPosition(undefined)
    setHighlightCategory(null)
  }, [registryName, layouts, getDefaultViewMode])

  // Measure position and open PiP
  const openPip = () => {
    if (contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect()
      setPipPosition({ left: rect.left, width: rect.width })
    }
    setIsPipOpen(true)
  }

  const hasInline = layouts.includes('inline')
  const hasFullwidth = layouts.includes('fullscreen')
  const hasPip = layouts.includes('pip')
  const hasDeps = !sourceCode.loading &&
    hasExternalDeps(sourceCode.dependencies, sourceCode.devDependencies)

  return (
    <div className="space-y-3">
      {/* Header: Title + Version + CopyLinkButton (left) | Install command (right) */}
      {/* On mobile, install command wraps below */}
      <div className="group flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!hideTitle && (
            <>
              <h2 className="text-lg font-bold">{name}</h2>
              {sourceCode.version && (
                <Popover>
                  <PopoverTrigger asChild>
                    <span className="group/version inline-flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                      <span>V{sourceCode.version}</span>
                      <span className="opacity-0 group-hover/version:opacity-100 transition-opacity whitespace-nowrap text-xs text-primary">
                        view changelog
                      </span>
                    </span>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 max-h-96 overflow-y-auto z-[1000]" align="start">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">Changelog</h4>
                      </div>
                      {sourceCode.changelog.length > 0 ? (
                        <div className="space-y-2">
                          {sourceCode.changelog.map((entry) => (
                            <div key={entry.version} className="border-l-2 border-muted pl-3 py-1">
                              <div className="text-xs font-medium text-foreground">v{entry.version}</div>
                              <div className="text-xs text-muted-foreground">{entry.description}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No changelog available</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {variantId && <CopyLinkButton anchor={variantId} />}
            </>
          )}
        </div>
        <InstallCommandInline componentName={registryName} />
      </div>

      {/* Row 2 (desktop) / Row 3 (mobile): Mode buttons */}
      <div className="flex items-center gap-1.5">
        {/* Preview buttons: icon-only on all screen sizes */}
        <button
          disabled={!hasInline}
          onClick={() => hasInline && setViewMode('inline')}
          className={cn(
            'p-1.5 text-xs font-medium rounded-full transition-colors',
            viewMode === 'inline'
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:text-foreground',
            hasInline ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
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

        {/* Deps button: only shown when dependencies exist */}
        {hasDeps && (
          <button
            onClick={() => setViewMode('deps')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer',
              viewMode === 'deps'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            Deps
          </button>
        )}
      </div>

      {/* Content based on view mode */}
      <div ref={contentRef}>
        {viewMode === 'inline' && (
          hasFullwidth && React.isValidElement(component)
            ? React.cloneElement(component as React.ReactElement<{ actions?: { onExpand?: () => void } }>, {
                actions: {
                  ...(component as React.ReactElement<{ actions?: Record<string, unknown> }>).props?.actions,
                  onExpand: () => setIsFullscreenOpen(true)
                }
              })
            : component
        )}

        {viewMode === 'fullwidth' && (
          <FullwidthPlaceholder onOpen={() => setIsFullscreenOpen(true)} />
        )}

        {viewMode === 'pip' && (
          <div className="flex items-center justify-center min-h-[300px] bg-muted/30 rounded-lg border border-dashed">
            <Button
              variant="outline"
              size="lg"
              onClick={openPip}
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

        {viewMode === 'deps' && (
          <DependencyViewer
            dependencies={sourceCode.dependencies}
            devDependencies={sourceCode.devDependencies}
            loading={sourceCode.loading}
          />
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
          position={pipPosition}
        >
          {pipComponent || component}
        </PipModal>
      )}
    </div>
  )
})
