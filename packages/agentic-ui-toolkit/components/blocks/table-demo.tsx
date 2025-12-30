'use client'

import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { HostAPIProvider, DisplayMode } from '@/lib/host-api'
import { Table, TableProps } from '@/registry/list/table'
import { useState, useCallback } from 'react'

interface TableDemoProps<T extends Record<string, unknown> = Record<string, unknown>> extends TableProps<T> {
  appName?: string
  appUrl?: string
}

/**
 * Demo wrapper for Table that handles display mode switching.
 * This simulates how the host (ChatGPT, Claude) would handle fullscreen requests.
 *
 * The Table component calls `hostAPI.requestDisplayMode('fullscreen')` when
 * the expand button is clicked, and this wrapper receives that request and shows
 * the fullscreen modal.
 */
export function TableDemo<T extends Record<string, unknown> = Record<string, unknown>>({
  appName = 'Data Table',
  appUrl,
  ...tableProps
}: TableDemoProps<T>) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('inline')

  const handleDisplayModeRequest = useCallback((mode: DisplayMode) => {
    setDisplayMode(mode)
  }, [])

  return (
    <HostAPIProvider
      displayMode={displayMode}
      onDisplayModeRequest={handleDisplayModeRequest}
    >
      {/* Inline mode - Table will call requestDisplayMode when expand is clicked */}
      {displayMode === 'inline' && (
        <Table
          {...tableProps}
          appearance={{ ...tableProps.appearance, displayMode: 'inline' }}
        />
      )}

      {/* Fullscreen mode - wrapped in our preview modal */}
      {displayMode === 'fullscreen' && (
        <FullscreenModal
          appName={appName}
          appUrl={appUrl}
          onClose={() => setDisplayMode('inline')}
        >
          <Table
            {...tableProps}
            appearance={{ ...tableProps.appearance, displayMode: 'fullscreen' }}
          />
        </FullscreenModal>
      )}
    </HostAPIProvider>
  )
}
