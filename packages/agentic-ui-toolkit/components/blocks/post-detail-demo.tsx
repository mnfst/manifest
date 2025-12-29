'use client'

import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { PostDetail, PostDetailProps } from '@/registry/blogging/post-detail'
import { useState } from 'react'

interface PostDetailDemoProps {
  data?: PostDetailProps['data']
  appearance?: Omit<PostDetailProps['appearance'], 'displayMode'>
  appName?: string
  appUrl?: string
}

export function PostDetailDemo({
  appName = 'Blog App',
  appUrl = 'https://example.com',
  data,
  appearance
}: PostDetailDemoProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <>
      <PostDetail
        data={data}
        appearance={{ ...appearance, displayMode: 'inline' }}
        actions={{ onReadMore: () => setIsFullscreen(true) }}
      />

      {isFullscreen && (
        <FullscreenModal
          appName={appName}
          appUrl={appUrl}
          onClose={() => setIsFullscreen(false)}
        >
          <PostDetail
            data={data}
            appearance={{ ...appearance, displayMode: 'fullscreen' }}
          />
        </FullscreenModal>
      )}
    </>
  )
}
