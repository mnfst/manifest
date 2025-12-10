'use client'

import {
  MessageBubble,
  ImageMessageBubble,
  type MessageBubbleProps,
  type ImageMessageBubbleProps
} from './message-bubble'

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

export interface ChatConversationProps {
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

export function ChatConversation({
  messages = defaultMessages
}: ChatConversationProps) {
  return (
    <div className="rounded-xl bg-card p-4 space-y-4">
      {messages.map((message) =>
        message.type === 'image' ? (
          <ImageMessageBubble
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
          <MessageBubble
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
