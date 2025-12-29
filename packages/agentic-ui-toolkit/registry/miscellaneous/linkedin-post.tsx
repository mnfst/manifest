"use client"

import { Heart, MessageCircle, Repeat2, Send, Bookmark, MoreHorizontal, ThumbsUp, Flag, UserMinus, EyeOff, Link } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface LinkedInPostProps {
  data?: {
    author?: string
    headline?: string
    avatar?: string
    content?: string
    likes?: string
    comments?: string
    reposts?: string
    time?: string
  }
}

const defaultData = {
  author: "Manifest",
  headline: "Agentic UI Toolkit | 10K+ Developers",
  avatar: "M",
  content: "Excited to announce our latest milestone!\n\nWe've just crossed 10,000 developers using Manifest to build agentic UIs. Thank you to everyone who believed in our vision.\n\nWhat's next? We're working on something big. Stay tuned!\n\n#AI #AgenticUI #Developer #Startup",
  likes: "1,234",
  comments: "89",
  reposts: "45",
  time: "2h"
}

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
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
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
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors text-sm text-muted-foreground">
          <ThumbsUp className="h-5 w-5" />
          <span>Like</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors text-sm text-muted-foreground">
          <MessageCircle className="h-5 w-5" />
          <span>Comment</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors text-sm text-muted-foreground">
          <Repeat2 className="h-5 w-5" />
          <span>Repost</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors text-sm text-muted-foreground">
          <Send className="h-5 w-5" />
          <span>Send</span>
        </button>
      </div>
    </div>
  )
}
