'use client'

import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { BlogPostCard, BlogPostCardProps, BlogPost } from '@/registry/blogging/blog-post-card'
import { PostDetail } from '@/registry/blogging/post-detail'
import { useState } from 'react'

interface BlogPostCardDemoProps {
  data?: {
    post?: BlogPost
  }
  appearance?: BlogPostCardProps['appearance']
  appName?: string
  appUrl?: string
}

export function BlogPostCardDemo({
  appName = 'Blog App',
  appUrl = 'https://example.com',
  data,
  appearance
}: BlogPostCardDemoProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <>
      <BlogPostCard
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
