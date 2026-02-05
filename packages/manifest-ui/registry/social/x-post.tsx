"use client"

import { Heart, MessageCircle, Repeat2, Share, Bookmark } from "lucide-react"
import { demoXPost } from './demo/social'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * XPostProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the XPost component, which displays an X (Twitter)-style post
 * with author info, content, and engagement metrics.
 */
export interface XPostProps {
  data?: {
    /** Author's display name. */
    author?: string
    /** Author's handle/username (without the @ symbol). */
    username?: string
    /** Avatar letter fallback or image URL for the profile picture. */
    avatar?: string
    /** Post text content. */
    content?: string
    /** Time since posted (e.g., "2h"). */
    time?: string
    /** Formatted like count (e.g., "1.2K"). */
    likes?: string
    /** Formatted retweet/repost count. */
    retweets?: string
    /** Formatted reply count. */
    replies?: string
    /** Formatted view count (e.g., "45.2K"). */
    views?: string
    /** Whether the author has a verified badge. */
    verified?: boolean
  }
}

/**
 * An X (Twitter) post embed component with engagement metrics.
 * Displays author info, content, and interactive action buttons.
 *
 * Features:
 * - Author avatar, name, and username
 * - Verified badge support
 * - Engagement metrics (likes, retweets, replies, views)
 * - Interactive action buttons (reply, retweet, like, bookmark, share)
 * - Time display
 *
 * @component
 * @example
 * ```tsx
 * <XPost
 *   data={{
 *     author: "John Doe",
 *     username: "johndoe",
 *     avatar: "J",
 *     content: "Hello world! This is my first post.",
 *     time: "2h",
 *     likes: "1.2K",
 *     retweets: "234",
 *     replies: "56",
 *     views: "45.2K",
 *     verified: true
 *   }}
 * />
 * ```
 */
export function XPost({ data }: XPostProps) {
  const resolved: NonNullable<XPostProps['data']> = data ?? demoXPost
  const author = resolved?.author
  const username = resolved?.username
  const avatar = resolved?.avatar
  const content = resolved?.content
  const time = resolved?.time
  const likes = resolved?.likes
  const retweets = resolved?.retweets
  const replies = resolved?.replies
  const views = resolved?.views
  const verified = resolved?.verified

  if (!author && !content) {
    return null
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex gap-3">
        {avatar && (
          <div className="h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-sm shrink-0">
            {avatar}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {(author || username || time) && (
            <div className="flex items-center gap-1 flex-wrap">
              {author && <span className="font-bold text-sm">{author}</span>}
              {verified && (
                <svg className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                </svg>
              )}
              {username && <span className="text-muted-foreground text-sm">@{username}</span>}
              {time && <span className="text-muted-foreground text-sm">· {time}</span>}
            </div>
          )}
          {content && <p className="text-sm mt-1 whitespace-pre-wrap">{content}</p>}
          {(replies || retweets || likes || views) && (
            <div className="flex items-center justify-between mt-3 text-muted-foreground max-w-md">
              {replies !== undefined && (
                <button aria-label="Reply" className="flex items-center gap-1.5 hover:text-blue-500 transition-colors text-xs cursor-pointer">
                  <MessageCircle className="h-4 w-4" />
                  <span>{replies}</span>
                </button>
              )}
              {retweets !== undefined && (
                <button aria-label="Repost" className="flex items-center gap-1.5 hover:text-green-500 transition-colors text-xs cursor-pointer">
                  <Repeat2 className="h-4 w-4" />
                  <span>{retweets}</span>
                </button>
              )}
              {likes !== undefined && (
                <button aria-label="Like" className="flex items-center gap-1.5 hover:text-pink-500 transition-colors text-xs cursor-pointer">
                  <Heart className="h-4 w-4" />
                  <span>{likes}</span>
                </button>
              )}
              {views !== undefined && (
                <button aria-label="Views" className="flex items-center gap-1.5 hover:text-blue-500 transition-colors text-xs cursor-pointer">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12h4l3 8 4-16 3 8h4" />
                  </svg>
                  <span>{views}</span>
                </button>
              )}
              <button aria-label="Bookmark" className="hover:text-blue-500 transition-colors cursor-pointer">
                <Bookmark className="h-4 w-4" />
              </button>
              <button aria-label="Share" className="hover:text-blue-500 transition-colors cursor-pointer">
                <Share className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
