'use client'

import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { PostDetail, PostDetailProps } from '@/registry/blogging/post-detail'
import { useState } from 'react'

interface PostDetailDemoProps extends Omit<PostDetailProps, 'onReadMore' | 'displayMode'> {
  appName?: string
  appUrl?: string
}

export function PostDetailDemo({
  appName = 'Blog App',
  appUrl = 'https://example.com',
  ...props
}: PostDetailDemoProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <>
      <PostDetail
        {...props}
        displayMode="inline"
        onReadMore={() => setIsFullscreen(true)}
      />

      {isFullscreen && (
        <FullscreenModal
          appName={appName}
          appUrl={appUrl}
          onClose={() => setIsFullscreen(false)}
        >
          <PostDetail
            {...props}
            displayMode="fullscreen"
          />
        </FullscreenModal>
      )}
    </>
  )
}
