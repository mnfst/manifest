'use client'

import { ImageMessageBubble, MessageBubble } from './message-bubble'
import { demoMessages } from './demo/data'

// Chat Conversation (multiple messages)
export interface ChatMessage {
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

export function ChatConversation({ data }: ChatConversationProps) {
  const { messages = demoMessages } = data ?? {}
  return (
    <div className="rounded-xl bg-card p-4 space-y-4">
      {messages.map((message, index) => {
        const messageType = message.type ?? 'text'
        return messageType === 'image' ? (
          <ImageMessageBubble
            key={index}
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
            key={index}
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
