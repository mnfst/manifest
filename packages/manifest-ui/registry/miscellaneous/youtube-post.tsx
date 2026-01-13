"use client"

import { useState } from "react"
import { Bookmark, MoreHorizontal, Share, EyeOff, Flag } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface YouTubePostProps {
  data?: {
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
}

const isValidYouTubeId = (id: string): boolean => {
  return /^[a-zA-Z0-9_-]{11}$/.test(id)
}

const defaultData = {
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

export function YouTubePost({ data }: YouTubePostProps) {
  const {
    channel = defaultData.channel,
    avatar = defaultData.avatar,
    title = defaultData.title,
    views = defaultData.views,
    time = defaultData.time,
    duration = defaultData.duration,
    thumbnail = defaultData.thumbnail,
    verified = defaultData.verified,
    videoId = defaultData.videoId
  } = data ?? {}
  const [isPlaying, setIsPlaying] = useState(false)

  const safeVideoId = isValidYouTubeId(videoId) ? videoId : null

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Thumbnail / Video */}
      <div className="relative aspect-video bg-black">
        {isPlaying && safeVideoId ? (
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${safeVideoId}?autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            <img src={thumbnail} alt={`Video thumbnail: ${title}`} className="w-full h-full object-cover" />

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
    </div>
  )
}
