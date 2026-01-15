"use client"

import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Flag, UserMinus, Link, Code } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Props for the InstagramPost component.
 * @interface InstagramPostProps
 * @property {object} [data] - Post content and metadata
 * @property {string} [data.author] - Author's username
 * @property {string} [data.avatar] - Avatar letter or URL
 * @property {string} [data.image] - Post image URL
 * @property {string} [data.likes] - Like count (e.g., "2,847")
 * @property {string} [data.caption] - Post caption text
 * @property {string} [data.time] - Time since posted (e.g., "2 hours ago")
 * @property {boolean} [data.verified] - Whether the author is verified
 */
export interface InstagramPostProps {
  data?: {
    author?: string
    avatar?: string
    image?: string
    likes?: string
    caption?: string
    time?: string
    verified?: boolean
  }
}

const defaultData = {
  author: "manifest.ai",
  avatar: "M",
  image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&h=600&fit=crop",
  likes: "2,847",
  caption: "Building the future of agentic UIs. What component would you love to see next?",
  time: "2 hours ago",
  verified: true
}

/**
 * An Instagram post embed component with image, caption, and engagement.
 * Displays the post with like, comment, share, and save actions.
 *
 * Features:
 * - Square aspect ratio image display
 * - Gradient avatar ring for stories indicator
 * - Verified badge support
 * - Action buttons (like, comment, share, save)
 * - Dropdown menu (report, unfollow, copy link, embed)
 * - Like count and caption display
 *
 * @component
 * @example
 * ```tsx
 * <InstagramPost
 *   data={{
 *     author: "manifest.ai",
 *     avatar: "M",
 *     image: "https://example.com/photo.jpg",
 *     likes: "2,847",
 *     caption: "Check out this amazing view!",
 *     time: "2 hours ago",
 *     verified: true
 *   }}
 * />
 * ```
 */
export function InstagramPost({ data }: InstagramPostProps) {
  const {
    author = defaultData.author,
    avatar = defaultData.avatar,
    image = defaultData.image,
    likes = defaultData.likes,
    caption = defaultData.caption,
    time = defaultData.time,
    verified = defaultData.verified
  } = data ?? {}
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] p-0.5">
            <div className="h-full w-full rounded-full bg-card flex items-center justify-center text-xs font-semibold">
              {avatar}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sm">{author}</span>
            {verified && (
              <svg className="h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484z" />
              </svg>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-foreground hover:text-muted-foreground transition-colors cursor-pointer">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Flag className="mr-2 h-4 w-4" />
              Report
            </DropdownMenuItem>
            <DropdownMenuItem>
              <UserMinus className="mr-2 h-4 w-4" />
              Unfollow
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link className="mr-2 h-4 w-4" />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Code className="mr-2 h-4 w-4" />
              Embed
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="aspect-square bg-muted">
        <img src={image} alt={`Instagram post by ${author}`} className="w-full h-full object-cover" />
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="hover:text-muted-foreground transition-colors cursor-pointer">
              <Heart className="h-6 w-6" />
            </button>
            <button className="hover:text-muted-foreground transition-colors cursor-pointer">
              <MessageCircle className="h-6 w-6" />
            </button>
            <button className="hover:text-muted-foreground transition-colors cursor-pointer">
              <Send className="h-6 w-6" />
            </button>
          </div>
          <button className="hover:text-muted-foreground transition-colors cursor-pointer">
            <Bookmark className="h-6 w-6" />
          </button>
        </div>
        <p className="font-semibold text-sm">{likes} likes</p>
        <p className="text-sm">
          <span className="font-semibold">{author}</span>{" "}
          {caption}
        </p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  )
}
