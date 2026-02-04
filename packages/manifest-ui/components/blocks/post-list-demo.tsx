'use client'

import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { HostAPIProvider, DisplayMode } from '@/lib/host-api'
import { PostList, PostListProps } from '@/registry/blogging/post-list'
import { useState, useCallback } from 'react'

interface PostListDemoProps {
  data?: PostListProps['data']
  appearance?: PostListProps['appearance']
  appName?: string
  appUrl?: string
}

/**
 * Demo wrapper for PostList that handles display mode switching.
 * This simulates how the host (ChatGPT, Claude) would handle fullscreen requests.
 */
export function PostListDemo({
  appName = 'Blog App',
  appUrl,
  data,
  appearance
}: PostListDemoProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('inline')

  const handleDisplayModeRequest = useCallback((mode: DisplayMode) => {
    setDisplayMode(mode)
  }, [])

  return (
    <HostAPIProvider
      displayMode={displayMode}
      onDisplayModeRequest={handleDisplayModeRequest}
    >
      {/* Inline mode */}
      {displayMode === 'inline' && (
        <PostList
          data={data}
          appearance={appearance}
        />
      )}

      {/* Fullscreen mode - show fullwidth post list with pagination */}
      {displayMode === 'fullscreen' && (
        <FullscreenModal
          appName={appName}
          appUrl={appUrl}
          onClose={() => {
            setDisplayMode('inline')
          }}
        >
          <PostList
            data={data}
            appearance={{
              variant: 'fullwidth',
              columns: 3,
              showAuthor: true,
              showCategory: true
            }}
          />
        </FullscreenModal>
      )}
    </HostAPIProvider>
  )
}
