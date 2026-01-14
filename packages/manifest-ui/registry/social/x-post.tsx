"use client"

import { Heart, MessageCircle, Repeat2, Share, Bookmark } from "lucide-react"

/**
 * Props for the XPost component.
 * @interface XPostProps
 * @property {object} [data] - Post content and metadata
 * @property {string} [data.author] - Author's display name
 * @property {string} [data.username] - Author's handle (without @)
 * @property {string} [data.avatar] - Avatar letter or URL
 * @property {string} [data.content] - Post text content
 * @property {string} [data.time] - Time since posted (e.g., "2h")
 * @property {string} [data.likes] - Like count (e.g., "1.2K")
 * @property {string} [data.retweets] - Retweet count
 * @property {string} [data.replies] - Reply count
 * @property {string} [data.views] - View count
 * @property {boolean} [data.verified] - Whether the author is verified
 */
export interface XPostProps {
  data?: {
    author?: string
    username?: string
    avatar?: string
    content?: string
    time?: string
    likes?: string
    retweets?: string
    replies?: string
    views?: string
    verified?: boolean
  }
}

const defaultData = {
  author: "Manifest",
  username: "manifest",
  avatar: "M",
  content: "Just shipped a new feature! Build stunning agentic UIs that work seamlessly inside ChatGPT and Claude. Try it out and let us know what you think!",
  time: "2h",
  likes: "1.2K",
  retweets: "234",
  replies: "56",
  views: "45.2K",
  verified: true
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
  const {
    author = defaultData.author,
    username = defaultData.username,
    avatar = defaultData.avatar,
    content = defaultData.content,
    time = defaultData.time,
    likes = defaultData.likes,
    retweets = defaultData.retweets,
    replies = defaultData.replies,
    views = defaultData.views,
    verified = defaultData.verified
  } = data ?? {}
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex gap-3">
        <div className="h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-sm shrink-0">
          {avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-bold text-sm">{author}</span>
            {verified && (
              <svg className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
              </svg>
            )}
            <span className="text-muted-foreground text-sm">@{username}</span>
            <span className="text-muted-foreground text-sm">· {time}</span>
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap">{content}</p>
          <div className="flex items-center justify-between mt-3 text-muted-foreground max-w-md">
            <button className="flex items-center gap-1.5 hover:text-blue-500 transition-colors text-xs cursor-pointer">
              <MessageCircle className="h-4 w-4" />
              <span>{replies}</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-green-500 transition-colors text-xs cursor-pointer">
              <Repeat2 className="h-4 w-4" />
              <span>{retweets}</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-pink-500 transition-colors text-xs cursor-pointer">
              <Heart className="h-4 w-4" />
              <span>{likes}</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-blue-500 transition-colors text-xs cursor-pointer">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h4l3 8 4-16 3 8h4" />
              </svg>
              <span>{views}</span>
            </button>
            <button className="hover:text-blue-500 transition-colors cursor-pointer">
              <Bookmark className="h-4 w-4" />
            </button>
            <button className="hover:text-blue-500 transition-colors cursor-pointer">
              <Share className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
