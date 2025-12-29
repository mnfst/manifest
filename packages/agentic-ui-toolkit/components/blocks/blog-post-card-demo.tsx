'use client'

import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { BlogPostCard, BlogPostCardProps } from '@/registry/blogging/blog-post-card'
import { PostDetail } from '@/registry/blogging/post-detail'
import { useState } from 'react'

interface BlogPostCardDemoProps extends Omit<BlogPostCardProps, 'onReadMore'> {
  appName?: string
  appUrl?: string
}

export function BlogPostCardDemo({
  appName = 'Blog App',
  appUrl = 'https://example.com',
  post,
  ...props
}: BlogPostCardDemoProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <>
      <BlogPostCard
        {...props}
        post={post}
        onReadMore={() => setIsFullscreen(true)}
      />

      {isFullscreen && (
        <FullscreenModal
          appName={appName}
          appUrl={appUrl}
          onClose={() => setIsFullscreen(false)}
        >
          <PostDetail
            post={post}
            displayMode="fullscreen"
          />
        </FullscreenModal>
      )}
    </>
  )
}
