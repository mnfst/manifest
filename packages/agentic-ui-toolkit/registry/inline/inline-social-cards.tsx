"use client"

import { Heart, MessageCircle, Repeat2, Share, Bookmark, MoreHorizontal, ThumbsUp, Send, Flag, UserMinus, EyeOff, Link, Code } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  )
}

// X/Twitter Post
export interface XPostProps {
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

const defaultXPost: XPostProps = {
  author: "Manifest",
  username: "manifest",
  avatar: "M",
  content: "Just shipped a new feature! Build stunning agentic UIs that work seamlessly inside ChatGPT and Claude. Try it out and let us know what you think! 🚀",
  time: "2h",
  likes: "1.2K",
  retweets: "234",
  replies: "56",
  views: "45.2K",
  verified: true
}

export function InlineXPost({
  author = defaultXPost.author,
  username = defaultXPost.username,
  avatar = defaultXPost.avatar,
  content = defaultXPost.content,
  time = defaultXPost.time,
  likes = defaultXPost.likes,
  retweets = defaultXPost.retweets,
  replies = defaultXPost.replies,
  views = defaultXPost.views,
  verified = defaultXPost.verified
}: XPostProps) {
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
            <button className="flex items-center gap-1.5 hover:text-blue-500 transition-colors text-xs">
              <MessageCircle className="h-4 w-4" />
              <span>{replies}</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-green-500 transition-colors text-xs">
              <Repeat2 className="h-4 w-4" />
              <span>{retweets}</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-pink-500 transition-colors text-xs">
              <Heart className="h-4 w-4" />
              <span>{likes}</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-blue-500 transition-colors text-xs">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h4l3 8 4-16 3 8h4" />
              </svg>
              <span>{views}</span>
            </button>
            <button className="hover:text-blue-500 transition-colors">
              <Bookmark className="h-4 w-4" />
            </button>
            <button className="hover:text-blue-500 transition-colors">
              <Share className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Instagram Post
export interface InstagramPostProps {
  author?: string
  avatar?: string
  image?: string
  likes?: string
  caption?: string
  time?: string
  verified?: boolean
}

const defaultInstagramPost: InstagramPostProps = {
  author: "manifest.ai",
  avatar: "M",
  image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&h=600&fit=crop",
  likes: "2,847",
  caption: "Building the future of agentic UIs. What component would you love to see next? 👇",
  time: "2 hours ago",
  verified: true
}

export function InlineInstagramPost({
  author = defaultInstagramPost.author,
  avatar = defaultInstagramPost.avatar,
  image = defaultInstagramPost.image,
  likes = defaultInstagramPost.likes,
  caption = defaultInstagramPost.caption,
  time = defaultInstagramPost.time,
  verified = defaultInstagramPost.verified
}: InstagramPostProps) {
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
            <button className="text-foreground hover:text-muted-foreground transition-colors">
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
        <img src={image} alt="Post" className="w-full h-full object-cover" />
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="hover:text-muted-foreground transition-colors">
              <Heart className="h-6 w-6" />
            </button>
            <button className="hover:text-muted-foreground transition-colors">
              <MessageCircle className="h-6 w-6" />
            </button>
            <button className="hover:text-muted-foreground transition-colors">
              <Send className="h-6 w-6" />
            </button>
          </div>
          <button className="hover:text-muted-foreground transition-colors">
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

// LinkedIn Post
export interface LinkedInPostProps {
  author?: string
  headline?: string
  avatar?: string
  content?: string
  likes?: string
  comments?: string
  reposts?: string
  time?: string
}

const defaultLinkedInPost: LinkedInPostProps = {
  author: "Manifest",
  headline: "Agentic UI Toolkit | 10K+ Developers",
  avatar: "M",
  content: "Excited to announce our latest milestone! 🎉\n\nWe've just crossed 10,000 developers using Manifest to build agentic UIs. Thank you to everyone who believed in our vision.\n\nWhat's next? We're working on something big. Stay tuned! 👀\n\n#AI #AgenticUI #Developer #Startup",
  likes: "1,234",
  comments: "89",
  reposts: "45",
  time: "2h"
}

export function InlineLinkedInPost({
  author = defaultLinkedInPost.author,
  headline = defaultLinkedInPost.headline,
  avatar = defaultLinkedInPost.avatar,
  content = defaultLinkedInPost.content,
  likes = defaultLinkedInPost.likes,
  comments = defaultLinkedInPost.comments,
  reposts = defaultLinkedInPost.reposts,
  time = defaultLinkedInPost.time
}: LinkedInPostProps) {
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
                <p className="text-xs text-muted-foreground">{time} · 🌐</p>
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

// YouTube Post
export interface YouTubePostProps {
  channel?: string
  avatar?: string
  title?: string
  views?: string
  time?: string
  duration?: string
  thumbnail?: string
  subscribers?: string
  verified?: boolean
  videoId?: string
}

const defaultYouTubePost: YouTubePostProps = {
  channel: "NetworkChuck",
  avatar: "N",
  title: "you need to learn MCP RIGHT NOW!! (Model Context Protocol)",
  views: "1M views",
  time: "2 weeks ago",
  duration: "18:42",
  thumbnail: "https://img.youtube.com/vi/GuTcle5edjk/maxresdefault.jpg",
  subscribers: "5M subscribers",
  verified: true,
  videoId: "GuTcle5edjk"
}

import { useState } from "react"

export function InlineYouTubePost({
  channel = defaultYouTubePost.channel,
  avatar = defaultYouTubePost.avatar,
  title = defaultYouTubePost.title,
  views = defaultYouTubePost.views,
  time = defaultYouTubePost.time,
  duration = defaultYouTubePost.duration,
  thumbnail = defaultYouTubePost.thumbnail,
  verified = defaultYouTubePost.verified,
  videoId = defaultYouTubePost.videoId
}: YouTubePostProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Thumbnail / Video */}
      <div className="relative aspect-video bg-black">
        {isPlaying ? (
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            <img src={thumbnail} alt="Video" className="w-full h-full object-cover" />

            {/* YouTube play button overlay */}
            <button
              className="absolute inset-0 flex items-center justify-center"
              onClick={() => setIsPlaying(true)}
              aria-label="Play video"
            >
              <svg className="h-10 w-14 cursor-pointer hover:scale-105 transition-transform" viewBox="0 0 1024 721">
                <path fill="#FF0000" d="M1013,156.3c0,0-10-70.4-40.6-101.4C933.6,14.2,890,14,870.1,11.6C727.1,1.3,512.7,1.3,512.7,1.3h-0.4c0,0-214.4,0-357.4,10.3C135,14,91.4,14.2,52.6,54.9C22,85.9,12,156.3,12,156.3S1.8,238.9,1.8,321.6v77.5C1.8,481.8,12,564.4,12,564.4s10,70.4,40.6,101.4c38.9,40.7,89.9,39.4,112.6,43.7c81.7,7.8,347.3,10.3,347.3,10.3s214.6-0.3,357.6-10.7c20-2.4,63.5-2.6,102.3-43.3c30.6-31,40.6-101.4,40.6-101.4s10.2-82.7,10.2-165.3v-77.5C1023.2,238.9,1013,156.3,1013,156.3z M407,493V206l276,144L407,493z"/>
                <path fill="#FFFFFF" d="M407,493l276-143L407,206V493z"/>
              </svg>
            </button>

            {/* Duration badge */}
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
              {duration}
            </div>
          </>
        )}
      </div>

      {/* Video info */}
      <div className="p-3">
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-full bg-red-600 text-white flex items-center justify-center font-semibold text-sm shrink-0">
            {avatar}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm line-clamp-2 leading-tight">{title}</h3>
            <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <span>{channel}</span>
              {verified && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{views} • {time}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground shrink-0 transition-colors">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Bookmark className="mr-2 h-4 w-4" />
                Save to Watch later
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Share className="mr-2 h-4 w-4" />
                Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <EyeOff className="mr-2 h-4 w-4" />
                Not interested
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
  )
}

// Combined Social Cards (grid of all platforms)
export function InlineSocialCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <InlineXPost />
      <InlineLinkedInPost />
    </div>
  )
}
