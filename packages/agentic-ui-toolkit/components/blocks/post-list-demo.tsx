'use client'

import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { Post } from '@/registry/blogging/post-card'
import { PostList, PostListProps } from '@/registry/blogging/post-list'
import { PostDetail } from '@/registry/blogging/post-detail'
import { useState } from 'react'

interface PostListDemoProps {
  data?: PostListProps['data']
  appearance?: PostListProps['appearance']
  appName?: string
  appUrl?: string
}

export function PostListDemo({
  appName = 'Blog App',
  appUrl = 'https://example.com',
  data,
  appearance
}: PostListDemoProps) {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)

  return (
    <>
      <PostList
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
