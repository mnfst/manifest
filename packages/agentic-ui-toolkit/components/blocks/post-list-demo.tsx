'use client'

import { FullscreenModal } from '@/components/layout/fullscreen-modal'
import { Post } from '@/registry/blogging/post-card'
import { PostDetail } from '@/registry/blogging/post-detail'
import { PostList, PostListProps } from '@/registry/blogging/post-list'
import { useState } from 'react'

interface PostListDemoProps {
  data?: PostListProps['data']
  appearance?: PostListProps['appearance']
  appName?: string
  appUrl?: string
}

export function PostListDemo({
  appName = 'Blog App',
  appUrl,
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
