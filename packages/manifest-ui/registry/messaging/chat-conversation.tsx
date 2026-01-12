'use client'

import { ImageMessageBubble, MessageBubble } from './message-bubble'

// Chat Conversation (multiple messages)
export interface ChatMessage {
  id: string
  type?: 'text' | 'image'
  content: string
  image?: string
  author?: string
  avatarUrl?: string
  avatarFallback?: string
  time?: string
  isOwn: boolean
  status?: 'sent' | 'delivered' | 'read'
}

export interface ChatConversationProps {
  data?: {
    messages?: ChatMessage[]
  }
}

const defaultMessages: ChatMessage[] = [
  {
    id: '1',
    type: 'text',
    content: 'Hey! Check out this new feature we just shipped 🚀',
    author: 'Sarah',
    avatarFallback: 'S',
    time: '10:30 AM',
    isOwn: false
  },
  {
    id: '2',
    type: 'text',
    content: 'Oh wow, that looks amazing! How long did it take to build?',
    author: 'You',
    avatarFallback: 'Y',
    time: '10:31 AM',
    isOwn: true,
    status: 'read'
  },
  {
    id: '3',
    type: 'image',
    content: "Here's a preview of the dashboard",
    image:
      'https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=400&h=300&fit=crop',
    author: 'Sarah',
    avatarFallback: 'S',
    time: '10:32 AM',
    isOwn: false
  },
  {
    id: '4',
    type: 'text',
    content: 'This is incredible! The UI is so clean 👏',
    author: 'You',
    avatarFallback: 'Y',
    time: '10:33 AM',
    isOwn: true,
    status: 'delivered'
  }
]

export function ChatConversation({ data }: ChatConversationProps) {
  const { messages = defaultMessages } = data ?? {}
  return (
    <div className="rounded-xl bg-card p-4 space-y-4">
      {messages.map((message) => {
        const messageType = message.type ?? 'text'
        return messageType === 'image' ? (
          <ImageMessageBubble
            key={message.id}
            data={{
              image: message.image!,
              content: message.content,
              avatarFallback: message.avatarFallback,
              avatarUrl: message.avatarUrl,
              author: message.author,
              time: message.time
            }}
            appearance={{ isOwn: message.isOwn }}
            control={{ status: message.status }}
          />
        ) : (
          <MessageBubble
            key={message.id}
            data={{
              content: message.content,
              avatarFallback: message.avatarFallback,
              avatarUrl: message.avatarUrl,
              author: message.author,
              time: message.time
            }}
            appearance={{ isOwn: message.isOwn }}
            control={{ status: message.status }}
          />
        )
      })}
    </div>
  )
}
