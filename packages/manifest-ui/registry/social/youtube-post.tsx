"use client"

import { useState } from "react"
import { Bookmark, MoreHorizontal, Share, EyeOff, Flag } from "lucide-react"
import { demoYouTubePost } from './demo/social'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * YouTubePostProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the YouTubePost component, which displays a YouTube video embed
 * with thumbnail preview and click-to-play functionality.
 */
export interface YouTubePostProps {
  data?: {
    /** YouTube channel name. */
    channel?: string
    /** Channel avatar letter fallback or image URL. */
    avatar?: string
    /** Video title. */
    title?: string
    /** Formatted view count (e.g., "1M views"). */
    views?: string
    /** Time since video was published (e.g., "2 weeks ago"). */
    time?: string
    /** Video duration in MM:SS or HH:MM:SS format. */
    duration?: string
    /** URL of the video thumbnail image. */
    thumbnail?: string
    /** Formatted subscriber count for the channel. */
    subscribers?: string
    /** Whether the channel has a verified badge. */
    verified?: boolean
    /** YouTube video ID used for embedding the player. */
    videoId?: string
  }
}

/**
 * A YouTube video embed component with thumbnail preview and playback.
 * Click the play button to load and play the embedded video.
 *
 * Features:
 * - Thumbnail preview with YouTube play button
 * - Duration badge overlay
 * - Channel avatar and info
 * - Verified channel badge
 * - View count and publish time
 * - Click-to-play video embedding
 * - Dropdown menu (save, share, not interested, report)
 *
 * @component
 * @example
 * ```tsx
 * <YouTubePost
 *   data={{
 *     channel: "Tech Channel",
 *     avatar: "T",
 *     title: "How to build amazing UIs",
 *     views: "1M views",
 *     time: "2 weeks ago",
 *     duration: "18:42",
 *     thumbnail: "https://img.youtube.com/vi/abc123/maxresdefault.jpg",
 *     verified: true,
 *     videoId: "abc123"
 *   }}
 * />
 * ```
 */
export function YouTubePost({ data }: YouTubePostProps) {
  const resolved: NonNullable<YouTubePostProps['data']> = data ?? demoYouTubePost
  const channel = resolved?.channel
  const avatar = resolved?.avatar
  const title = resolved?.title
  const views = resolved?.views
  const time = resolved?.time
  const duration = resolved?.duration
  const thumbnail = resolved?.thumbnail
  const verified = resolved?.verified
  const videoId = resolved?.videoId

  const [isPlaying, setIsPlaying] = useState(false)

  if (!title && !thumbnail && !videoId) {
    return null
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Thumbnail / Video */}
      {(thumbnail || videoId) && (
        <div className="relative aspect-video bg-black">
          {isPlaying && videoId ? (
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title={title ?? 'YouTube video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <>
              {thumbnail && (
                <img src={thumbnail} alt={title ? `Video thumbnail: ${title}` : 'Video thumbnail'} className="w-full h-full object-cover" />
              )}

              {/* YouTube play button overlay */}
              {videoId && (
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
              )}

              {/* Duration badge */}
              {duration && (
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                  {duration}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Video info */}
      {(channel || title) && (
        <div className="p-3">
          <div className="flex gap-3">
            {avatar && (
              <div className="h-9 w-9 rounded-full bg-red-600 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                {avatar}
              </div>
            )}
            <div className="flex-1 min-w-0">
              {title && <h3 className="font-semibold text-sm line-clamp-2 leading-tight">{title}</h3>}
              {channel && (
                <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{channel}</span>
                  {verified && (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  )}
                </div>
              )}
              {(views || time) && (
                <p className="text-xs text-muted-foreground">
                  {views}{views && time && ' • '}{time}
                </p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground shrink-0 transition-colors cursor-pointer">
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
      )}
    </div>
  )
}
