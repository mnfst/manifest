'use client'

import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { HostAPIProvider, DisplayMode } from '@/lib/host-api'
import { Post, PostCard, PostCardProps } from '@/registry/blogging/post-card'
import { PostDetail } from '@/registry/blogging/post-detail'
import { useState, useCallback } from 'react'

interface PostCardDemoProps {
  data?: {
    post?: Post
  }
  appearance?: PostCardProps['appearance']
  appName?: string
  appUrl?: string
}

/**
 * Demo wrapper for PostCard that handles display mode switching.
 * This simulates how the host (ChatGPT, Claude) would handle fullscreen requests.
 */
export function PostCardDemo({
  appName = 'Blog App',
  appUrl,
  data,
  appearance
}: PostCardDemoProps) {
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
        <PostCard
          data={data}
          appearance={appearance}
        />
      )}

      {/* Fullscreen mode - show full post detail */}
      {displayMode === 'fullscreen' && (
        <FullscreenModal
          appName={appName}
          appUrl={appUrl}
          onClose={() => setDisplayMode('inline')}
        >
          <PostDetail
            data={{ post: data?.post }}
            appearance={{ displayMode: 'fullscreen' }}
          />
        </FullscreenModal>
      )}
    </HostAPIProvider>
  )
}
