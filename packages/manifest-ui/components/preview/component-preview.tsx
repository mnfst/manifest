'use client'

import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { DisplayMode, HostAPIProvider } from '@/lib/host-api'
import { ReactNode, useCallback, useState } from 'react'

interface ComponentPreviewProps {
  children: ReactNode | ((displayMode: DisplayMode) => ReactNode)
  appName?: string
  appUrl?: string
  /** If true, wraps children in HostAPIProvider. Set to false if already wrapped. */
  provideHostAPI?: boolean
}

/**
 * Preview wrapper for components that simulates host behavior.
 *
 * This component:
 * 1. Wraps children in HostAPIProvider (for preview mode)
 * 2. Listens for requestDisplayMode('fullscreen') calls
 * 3. When fullscreen is requested, shows FullscreenModal
 * 4. Passes the current displayMode to children
 *
 * Usage:
 * ```tsx
 * <ComponentPreview appName="Table App">
 *   {(displayMode) => <Table displayMode={displayMode} />}
 * </ComponentPreview>
 * ```
 *
 * Or with static children (displayMode not needed):
 * ```tsx
 * <ComponentPreview appName="Payment">
 *   <PaymentForm />
 * </ComponentPreview>
 * ```
 */
export function ComponentPreview({
  children,
  appName = 'Preview',
  appUrl,
  provideHostAPI = true
}: ComponentPreviewProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('inline')

  const handleDisplayModeRequest = useCallback((mode: DisplayMode) => {
    setDisplayMode(mode)
  }, [])

  const handleClose = useCallback(() => {
    setDisplayMode('inline')
  }, [])

  // Render children based on type
  const renderChildren = (mode: DisplayMode) => {
    if (typeof children === 'function') {
      return children(mode)
    }
    return children
  }

  const content = (
    <>
      {/* Inline mode - show in place */}
      {displayMode === 'inline' && renderChildren('inline')}

      {/* Fullscreen mode - show in modal */}
      {displayMode === 'fullscreen' && (
        <FullscreenModal appName={appName} appUrl={appUrl} onClose={handleClose}>
          {renderChildren('fullscreen')}
        </FullscreenModal>
      )}
    </>
  )

  if (provideHostAPI) {
    return (
      <HostAPIProvider
        displayMode={displayMode}
        onDisplayModeRequest={handleDisplayModeRequest}
      >
        {content}
      </HostAPIProvider>
    )
  }

  return content
}
