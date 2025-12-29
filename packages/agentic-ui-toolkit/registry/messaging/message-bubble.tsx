'use client'

import { cn } from '@/lib/utils'
import { Check, CheckCheck, Smile } from 'lucide-react'
import React, { useState, useRef } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

/*
 * MessageBubble Components - ChatGPT UI Guidelines Compliant
 * - Use system colors (foreground/background) instead of custom blue
 * - Compact design suitable for chat embedding
 * - Note: Dropdown for reactions may be clipped in iframes - consider inline alternatives
 */

// Single Message Bubble
export interface MessageBubbleProps {
  data?: {
    content?: string
    avatar?: string
    author?: string
    time?: string
  }
  appearance?: {
    isOwn?: boolean
  }
  control?: {
    status?: 'sent' | 'delivered' | 'read'
  }
}

export function MessageBubble({ data, appearance, control }: MessageBubbleProps) {
  const { content = 'Hey! How are you doing?', avatar = 'J', author = 'John', time = '10:30 AM' } = data ?? {}
  const { isOwn = false } = appearance ?? {}
  const { status } = control ?? {}
  return (
    <div className={cn('flex gap-2', isOwn && 'flex-row-reverse')}>
      {!isOwn && (
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
          {avatar}
        </div>
      )}
      <div className={cn('max-w-[75%]', isOwn && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted rounded-bl-md'
          )}
        >
          <p className="text-sm">{content}</p>
        </div>
        <div
          className={cn('flex items-center gap-1 mt-1', isOwn && 'justify-end')}
        >
          <span className="text-[10px] text-muted-foreground">{time}</span>
          {isOwn && status && (
            <span className="text-muted-foreground">
              {status === 'sent' && <Check className="h-3 w-3" />}
              {status === 'delivered' && <CheckCheck className="h-3 w-3" />}
              {status === 'read' && (
                <CheckCheck className="h-3 w-3 text-foreground" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Image Message Bubble
export interface ImageMessageBubbleProps {
  data?: {
    image?: string
    caption?: string
    avatar?: string
    author?: string
    time?: string
  }
  appearance?: {
    isOwn?: boolean
  }
  control?: {
    status?: 'sent' | 'delivered' | 'read'
  }
}

export function ImageMessageBubble({ data, appearance, control }: ImageMessageBubbleProps) {
  const {
    image = 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=400&h=300&fit=crop',
    caption,
    avatar = 'J',
    author = 'John',
    time = '10:32 AM',
  } = data ?? {}
  const { isOwn = false } = appearance ?? {}
  const { status } = control ?? {}
  return (
    <div className={cn('flex gap-2', isOwn && 'flex-row-reverse')}>
      {!isOwn && (
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
          {avatar}
        </div>
      )}
      <div className={cn('max-w-[75%]', isOwn && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl overflow-hidden',
            isOwn ? 'rounded-br-md' : 'rounded-bl-md'
          )}
        >
          <img
            src={image}
            alt="Shared image"
            className="w-full max-w-[280px] h-auto object-cover"
          />
          {caption && (
            <div
              className={cn(
                'px-3 py-2',
                isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}
            >
              <p className="text-sm">{caption}</p>
            </div>
          )}
        </div>
        <div
          className={cn('flex items-center gap-1 mt-1', isOwn && 'justify-end')}
        >
          <span className="text-[10px] text-muted-foreground">{time}</span>
          {isOwn && status && (
            <span className="text-muted-foreground">
              {status === 'sent' && <Check className="h-3 w-3" />}
              {status === 'delivered' && <CheckCheck className="h-3 w-3" />}
              {status === 'read' && (
                <CheckCheck className="h-3 w-3 text-foreground" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Message with reactions
export interface MessageWithReactionsProps {
  data?: {
    content?: string
    avatar?: string
    author?: string
    time?: string
    reactions?: { emoji: string; count: number }[]
  }
  actions?: {
    onReact?: (emoji: string) => void
  }
  appearance?: {
    isOwn?: boolean
  }
}

const availableEmojis = ['❤️', '👍', '👎', '😂', '😮', '😢', '🎉', '🔥', '👏', '💯']

export function MessageWithReactions({ data, actions, appearance }: MessageWithReactionsProps) {
  const {
    content = 'This is such great news! 🎉',
    avatar = 'A',
    author = 'Alex',
    time = '2:45 PM',
    reactions: initialReactions = [
      { emoji: '❤️', count: 3 },
      { emoji: '👍', count: 2 }
    ],
  } = data ?? {}
  const { onReact } = actions ?? {}
  const { isOwn = false } = appearance ?? {}
  const [reactions, setReactions] = useState(initialReactions)

  const handleReact = (emoji: string) => {
    const existingIndex = reactions.findIndex((r) => r.emoji === emoji)
    if (existingIndex >= 0) {
      const updated = [...reactions]
      updated[existingIndex] = { ...updated[existingIndex], count: updated[existingIndex].count + 1 }
      setReactions(updated)
    } else {
      setReactions([...reactions, { emoji, count: 1 }])
    }
    onReact?.(emoji)
  }

  return (
    <div className={cn('flex gap-2', isOwn && 'flex-row-reverse')}>
      {!isOwn && (
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
          {avatar}
        </div>
      )}
      <div className={cn('max-w-[75%]', isOwn && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted rounded-bl-md'
          )}
        >
          <p className="text-sm">{content}</p>
        </div>
        <div
          className={cn(
            'flex items-center gap-1 mt-1.5',
            isOwn ? 'justify-end' : 'justify-start'
          )}
        >
          {reactions && reactions.length > 0 && (
            <>
              {reactions.map((reaction, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-0.5 bg-card border rounded-full px-1.5 py-0.5 text-xs"
                >
                  {reaction.emoji}
                  <span className="text-muted-foreground">
                    {reaction.count}
                  </span>
                </span>
              ))}
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center justify-center h-6 w-6 bg-card border rounded-full hover:bg-muted transition-colors cursor-pointer">
                <Smile className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="p-2">
              <div className="grid grid-cols-5 gap-1">
                {availableEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className="h-8 w-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div
          className={cn('flex items-center gap-1 mt-1', isOwn && 'justify-end')}
        >
          <span className="text-[10px] text-muted-foreground">{time}</span>
        </div>
      </div>
    </div>
  )
}

// Voice Message Bubble
export interface VoiceMessageBubbleProps {
  data?: {
    duration?: string
    avatar?: string
    author?: string
    time?: string
    audioSrc?: string
  }
  appearance?: {
    isOwn?: boolean
  }
  control?: {
    status?: 'sent' | 'delivered' | 'read'
  }
}

export function VoiceMessageBubble({ data, appearance, control }: VoiceMessageBubbleProps) {
  const {
    duration = '0:42',
    avatar = 'M',
    author = 'Mike',
    time = '3:15 PM',
    audioSrc = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  } = data ?? {}
  const { isOwn = false } = appearance ?? {}
  const { status } = control ?? {}
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState('0:00')
  const audioRef = useRef<HTMLAudioElement>(null)

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime
      const total = audioRef.current.duration || 1
      setProgress((current / total) * 100)
      const mins = Math.floor(current / 60)
      const secs = Math.floor(current % 60)
      setCurrentTime(`${mins}:${secs.toString().padStart(2, '0')}`)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setProgress(0)
    setCurrentTime('0:00')
  }

  return (
    <div className={cn('flex gap-2', isOwn && 'flex-row-reverse')}>
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />
      {!isOwn && (
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
          {avatar}
        </div>
      )}
      <div className={cn('max-w-[75%]', isOwn && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 flex items-center gap-3',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted rounded-bl-md'
          )}
        >
          <button
            onClick={togglePlay}
            className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer',
              isOwn ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30' : 'bg-foreground/10 hover:bg-foreground/20'
            )}
          >
            {isPlaying ? (
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg
                className="h-4 w-4 ml-0.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-1 bg-current/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-current rounded-full transition-all duration-100"
                style={{ width: `${progress || 33}%` }}
              />
            </div>
            <span className="text-xs font-medium">{isPlaying ? currentTime : duration}</span>
          </div>
        </div>
        <div
          className={cn('flex items-center gap-1 mt-1', isOwn && 'justify-end')}
        >
          <span className="text-[10px] text-muted-foreground">{time}</span>
          {isOwn && status && (
            <span className="text-muted-foreground">
              {status === 'sent' && <Check className="h-3 w-3" />}
              {status === 'delivered' && <CheckCheck className="h-3 w-3" />}
              {status === 'read' && (
                <CheckCheck className="h-3 w-3 text-foreground" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
