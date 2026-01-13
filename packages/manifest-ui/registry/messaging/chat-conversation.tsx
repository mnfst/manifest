'use client'

import { ImageMessageBubble, MessageBubble } from './message-bubble'
import { demoMessages } from './demo/data'

/**
 * Represents a chat message.
 * @interface ChatMessage
 * @property {"text" | "image"} [type] - Message type (defaults to "text")
 * @property {string} content - Message content or image caption
 * @property {string} [image] - Image URL for image messages
 * @property {string} [author] - Sender's name
 * @property {string} [avatarUrl] - Sender's avatar image URL
 * @property {string} [avatarFallback] - Fallback letter for avatar
 * @property {string} [time] - Message timestamp
 * @property {boolean} isOwn - Whether message is from current user
 * @property {"sent" | "delivered" | "read"} [status] - Message delivery status
 */
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

/**
 * Props for the ChatConversation component.
 * @interface ChatConversationProps
 * @property {object} [data] - Conversation data
 * @property {ChatMessage[]} [data.messages] - Array of messages
 */
export interface ChatConversationProps {
  data?: {
    messages?: ChatMessage[]
  }
}

/**
 * A chat conversation component displaying multiple messages.
 * Supports text and image messages with avatars and status indicators.
 *
 * Features:
 * - Text and image message types
 * - Message status indicators (sent, delivered, read)
 * - Avatar support with image URL or letter fallback
 * - Author name and timestamp display
 * - Own vs other message styling
 *
 * @component
 * @example
 * ```tsx
 * <ChatConversation
 *   data={{
 *     messages: [
 *       { content: "Hello!", isOwn: false, avatarFallback: "S", author: "Sarah" },
 *       { content: "Hi there!", isOwn: true, status: "read" }
 *     ]
 *   }}
 * />
 * ```
 */
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
