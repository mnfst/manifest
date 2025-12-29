'use client'

import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { Post, PostCard, PostCardProps } from '@/registry/blogging/post-card'
import { PostDetail } from '@/registry/blogging/post-detail'
import { useState } from 'react'

interface PostCardDemoProps {
  data?: {
    post?: Post
  }
  appearance?: PostCardProps['appearance']
  appName?: string
  appUrl?: string
}

export function PostCardDemo({
  appName = 'Blog App',
  appUrl,
  data,
  appearance
}: PostCardDemoProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <>
      <PostCard
        data={data}
        appearance={appearance}
        actions={{ onReadMore: () => setIsFullscreen(true) }}
      />

      {isFullscreen && (
        <FullscreenModal
          appName={appName}
          appUrl={appUrl}
          onClose={() => setIsFullscreen(false)}
        >
          <PostDetail
            data={{ post: data?.post }}
            appearance={{ displayMode: 'fullscreen' }}
          />
        </FullscreenModal>
      )}
    </>
  )
}
