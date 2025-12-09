'use client'

import { cn } from '@/lib/utils'
import { Check, CheckCheck, Smile } from 'lucide-react'
import React, { useState, useRef } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

// Single Message Bubble
export interface MessageBubbleProps {
  content: string
  avatar?: string
  author?: string
  time?: string
  isOwn?: boolean
  status?: 'sent' | 'delivered' | 'read'
}

export function InlineMessageBubble({
  content = 'Hey! How are you doing?',
  avatar = 'J',
  author = 'John',
  time = '10:30 AM',
  isOwn = false,
  status
}: MessageBubbleProps) {
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
                <CheckCheck className="h-3 w-3 text-blue-500" />
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
  image: string
  caption?: string
  avatar?: string
  author?: string
  time?: string
  isOwn?: boolean
  status?: 'sent' | 'delivered' | 'read'
}

export function InlineImageMessageBubble({
  image = 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=400&h=300&fit=crop',
  caption,
  avatar = 'J',
  author = 'John',
  time = '10:32 AM',
  isOwn = false,
  status
}: ImageMessageBubbleProps) {
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
                <CheckCheck className="h-3 w-3 text-blue-500" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Chat Conversation (multiple messages)
export interface ChatMessage {
  id: string
  type: 'text' | 'image'
  content: string
  image?: string
  caption?: string
  author: string
  avatar: string
  time: string
  isOwn: boolean
  status?: 'sent' | 'delivered' | 'read'
}

export interface InlineChatConversationProps {
  messages?: ChatMessage[]
}

const defaultMessages: ChatMessage[] = [
  {
    id: '1',
    type: 'text',
    content: 'Hey! Check out this new feature we just shipped 🚀',
    author: 'Sarah',
    avatar: 'S',
    time: '10:30 AM',
    isOwn: false
  },
  {
    id: '2',
    type: 'text',
    content: 'Oh wow, that looks amazing! How long did it take to build?',
    author: 'You',
    avatar: 'Y',
    time: '10:31 AM',
    isOwn: true,
    status: 'read'
  },
  {
    id: '3',
    type: 'image',
    content: '',
    image:
      'https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=400&h=300&fit=crop',
    caption: "Here's a preview of the dashboard",
    author: 'Sarah',
    avatar: 'S',
    time: '10:32 AM',
    isOwn: false
  },
  {
    id: '4',
    type: 'text',
    content: 'This is incredible! The UI is so clean 👏',
    author: 'You',
    avatar: 'Y',
    time: '10:33 AM',
    isOwn: true,
    status: 'delivered'
  }
]

export function InlineChatConversation({
  messages = defaultMessages
}: InlineChatConversationProps) {
  return (
    <div className="rounded-xl bg-card p-4 space-y-4">
      {messages.map((message) =>
        message.type === 'image' ? (
          <InlineImageMessageBubble
            key={message.id}
            image={message.image!}
            caption={message.caption}
            avatar={message.avatar}
            author={message.author}
            time={message.time}
            isOwn={message.isOwn}
            status={message.status}
          />
        ) : (
          <InlineMessageBubble
            key={message.id}
            content={message.content}
            avatar={message.avatar}
            author={message.author}
            time={message.time}
            isOwn={message.isOwn}
            status={message.status}
          />
        )
      )}
    </div>
  )
}

// Message with reactions
export interface MessageWithReactionsProps {
  content: string
  avatar?: string
  author?: string
  time?: string
  isOwn?: boolean
  reactions?: { emoji: string; count: number }[]
  onReact?: (emoji: string) => void
}

const availableEmojis = ['❤️', '👍', '👎', '😂', '😮', '😢', '🎉', '🔥', '👏', '💯']

export function InlineMessageWithReactions({
  content = 'This is such great news! 🎉',
  avatar = 'A',
  author = 'Alex',
  time = '2:45 PM',
  isOwn = false,
  reactions: initialReactions = [
    { emoji: '❤️', count: 3 },
    { emoji: '👍', count: 2 }
  ],
  onReact
}: MessageWithReactionsProps) {
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
              <button className="inline-flex items-center justify-center h-6 w-6 bg-card border rounded-full hover:bg-muted transition-colors">
                <Smile className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="p-2">
              <div className="grid grid-cols-5 gap-1">
                {availableEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className="h-8 w-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
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
  duration?: string
  avatar?: string
  author?: string
  time?: string
  isOwn?: boolean
  status?: 'sent' | 'delivered' | 'read'
  audioSrc?: string
}

export function InlineVoiceMessageBubble({
  duration = '0:42',
  avatar = 'M',
  author = 'Mike',
  time = '3:15 PM',
  isOwn = false,
  status,
  audioSrc = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
}: VoiceMessageBubbleProps) {
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
              'h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors',
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
                <CheckCheck className="h-3 w-3 text-blue-500" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
