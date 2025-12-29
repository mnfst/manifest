'use client'

import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { BlogPost } from '@/registry/blogging/blog-post-card'
import { BlogPostList, BlogPostListProps } from '@/registry/blogging/blog-post-list'
import { PostDetail } from '@/registry/blogging/post-detail'
import { useState } from 'react'

interface BlogPostListDemoProps {
  data?: BlogPostListProps['data']
  appearance?: BlogPostListProps['appearance']
  appName?: string
  appUrl?: string
}

export function BlogPostListDemo({
  appName = 'Blog App',
  appUrl = 'https://example.com',
  data,
  appearance
}: BlogPostListDemoProps) {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null)

  return (
    <>
      <BlogPostList
        data={data}
        appearance={appearance}
        actions={{ onReadMore: (post) => setSelectedPost(post) }}
      />

      {selectedPost && (
        <FullscreenModal
          appName={appName}
          appUrl={appUrl}
          onClose={() => setSelectedPost(null)}
        >
          <PostDetail
            data={{ post: selectedPost }}
            appearance={{ displayMode: 'fullscreen' }}
          />
        </FullscreenModal>
      )}
    </>
  )
}
