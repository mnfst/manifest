'use client'

import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { PipModal } from '@/components/layout/pip-modal'
import { HostAPIProvider, DisplayMode } from '@/lib/host-api'
import { PostDetail, PostDetailProps } from '@/registry/blogging/post-detail'
import { useState, useCallback } from 'react'

interface PostDetailDemoProps {
  data?: PostDetailProps['data']
  appearance?: Omit<PostDetailProps['appearance'], 'displayMode'>
  appName?: string
  appUrl?: string
}

/**
 * Demo wrapper for PostDetail that handles display mode switching.
 * This simulates how the host (ChatGPT, Claude) would handle fullscreen requests.
 *
 * The PostDetail component calls `hostAPI.requestDisplayMode('fullscreen')` when
 * "Read more" is clicked, and this wrapper receives that request and shows
 * the fullscreen modal.
 */
export function PostDetailDemo({
  appName = 'Blog App',
  appUrl,
  data,
  appearance
}: PostDetailDemoProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('inline')

  const handleDisplayModeRequest = useCallback((mode: DisplayMode) => {
    setDisplayMode(mode)
  }, [])

  return (
    <HostAPIProvider
      displayMode={displayMode}
      onDisplayModeRequest={handleDisplayModeRequest}
    >
      {/* Inline mode - PostDetail will call requestDisplayMode when "Read more" is clicked */}
      {displayMode === 'inline' && (
        <PostDetail
          data={data}
          appearance={{ ...appearance, displayMode: 'inline' }}
        />
      )}

      {/* PiP mode - floating picture-in-picture view */}
      {displayMode === 'pip' && (
        <PipModal
          appName={appName}
          onClose={() => setDisplayMode('inline')}
          onExpand={() => setDisplayMode('fullscreen')}
        >
          <PostDetail
            data={data}
            appearance={{ ...appearance, displayMode: 'pip' }}
          />
        </PipModal>
      )}

      {/* Fullscreen mode - wrapped in our preview modal */}
      {displayMode === 'fullscreen' && (
        <FullscreenModal
          appName={appName}
          appUrl={appUrl}
          onClose={() => setDisplayMode('inline')}
        >
          <PostDetail
            data={data}
            appearance={{ ...appearance, displayMode: 'fullscreen' }}
          />
        </FullscreenModal>
      )}
    </HostAPIProvider>
  )
}
