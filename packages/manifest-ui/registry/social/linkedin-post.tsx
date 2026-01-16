"use client"

import { Heart, MessageCircle, Repeat2, Send, Bookmark, MoreHorizontal, ThumbsUp, Flag, UserMinus, EyeOff, Link } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LinkedInPostProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the LinkedInPost component, which displays a LinkedIn-style
 * post with professional author info and engagement metrics.
 */
export interface LinkedInPostProps {
  data?: {
    /** Author's display name. */
    author?: string
    /** Author's professional headline or title. */
    headline?: string
    /** Avatar letter fallback or image URL for the profile picture. */
    avatar?: string
    /** Post text content (supports line breaks and hashtags). */
    content?: string
    /** Formatted like count (e.g., "1,234"). */
    likes?: string
    /** Number of comments on the post. */
    comments?: string
    /** Number of reposts/shares. */
    reposts?: string
    /** Time since posted (e.g., "2h"). */
    time?: string
  }
}

const defaultData = {
  author: "Manifest",
  headline: "Manifest UI | 10K+ Developers",
  avatar: "M",
  content: "Excited to announce our latest milestone!\n\nWe've just crossed 10,000 developers using Manifest to build agentic UIs. Thank you to everyone who believed in our vision.\n\nWhat's next? We're working on something big. Stay tuned!\n\n#AI #AgenticUI #Developer #Startup",
  likes: "1,234",
  comments: "89",
  reposts: "45",
  time: "2h"
}

/**
 * A LinkedIn post embed component with professional styling.
 * Displays author info, content, and engagement metrics.
 *
 * Features:
 * - Author avatar with headline
 * - Multi-line content with hashtag support
 * - Reaction indicators (like, love)
 * - Engagement counts (likes, comments, reposts)
 * - Action buttons (like, comment, repost, send)
 * - Dropdown menu (save, copy link, hide, unfollow, report)
 *
 * @component
 * @example
 * ```tsx
 * <LinkedInPost
 *   data={{
 *     author: "Manifest",
 *     headline: "Building the future of AI",
 *     avatar: "M",
 *     content: "Excited to share our latest update!",
 *     likes: "1,234",
 *     comments: "89",
 *     reposts: "45",
 *     time: "2h"
 *   }}
 * />
 * ```
 */
export function LinkedInPost({ data }: LinkedInPostProps) {
  const {
    author = defaultData.author,
    headline = defaultData.headline,
    avatar = defaultData.avatar,
    content = defaultData.content,
    likes = defaultData.likes,
    comments = defaultData.comments,
    reposts = defaultData.reposts,
    time = defaultData.time
  } = data ?? {}
  return (
    <div className="rounded-xl border bg-card">
      <div className="p-4">
        <div className="flex gap-3">
          <div className="h-12 w-12 rounded-full bg-[#0A66C2] text-white flex items-center justify-center font-semibold shrink-0">
            {avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-sm">{author}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{headline}</p>
                <p className="text-xs text-muted-foreground">{time} · </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Bookmark className="mr-2 h-4 w-4" />
                    Save
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link className="mr-2 h-4 w-4" />
                    Copy link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Hide post
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <UserMinus className="mr-2 h-4 w-4" />
                    Unfollow
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Flag className="mr-2 h-4 w-4" />
                    Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        <p className="text-sm mt-3 whitespace-pre-wrap">{content}</p>
      </div>
      <div className="px-4 py-2 border-t flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
              <ThumbsUp className="h-2.5 w-2.5 text-white" />
            </div>
            <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
              <Heart className="h-2.5 w-2.5 text-white fill-white" />
            </div>
          </div>
          <span>{likes}</span>
        </div>
        <span>{comments} comments · {reposts} reposts</span>
      </div>
      <div className="px-2 py-1 border-t flex items-center justify-around">
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors text-sm text-muted-foreground cursor-pointer">
          <ThumbsUp className="h-5 w-5" />
          <span>Like</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors text-sm text-muted-foreground cursor-pointer">
          <MessageCircle className="h-5 w-5" />
          <span>Comment</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors text-sm text-muted-foreground cursor-pointer">
          <Repeat2 className="h-5 w-5" />
          <span>Repost</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors text-sm text-muted-foreground cursor-pointer">
          <Send className="h-5 w-5" />
          <span>Send</span>
        </button>
      </div>
    </div>
  )
}
