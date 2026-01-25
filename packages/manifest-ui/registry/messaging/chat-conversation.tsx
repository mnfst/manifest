'use client'

import { ImageMessageBubble, MessageBubble } from './message-bubble'

/**
 * Represents a chat message.
 * @interface ChatMessage
 * @property {"text" | "image"} [type] - Message type (defaults to "text")
 * @property {string} [content] - Message content or image caption
 * @property {string} [image] - Image URL for image messages
 * @property {string} [author] - Sender's name
 * @property {string} [avatarUrl] - Sender's avatar image URL
 * @property {string} [avatarFallback] - Fallback letter for avatar
 * @property {string} [time] - Message timestamp
 * @property {boolean} [isOwn] - Whether message is from current user (defaults to false)
 * @property {"sent" | "delivered" | "read"} [status] - Message delivery status
 */
export interface ChatMessage {
  type?: 'text' | 'image'
  content?: string
  image?: string
  author?: string
  avatarUrl?: string
  avatarFallback?: string
  time?: string
  isOwn?: boolean
  status?: 'sent' | 'delivered' | 'read'
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ChatConversationProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for configuring a chat conversation component that displays multiple
 * messages with support for text and image message types.
 */
export interface ChatConversationProps {
  data?: {
    /** Array of chat messages to display in the conversation. */
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
  const messages = data?.messages

  if (!messages || messages.length === 0) {
    return <div className="rounded-xl bg-card p-4" />
  }

  return (
    <div className="rounded-xl bg-card p-4 space-y-4">
      {messages.map((message, index) => {
        const messageType = message.type ?? 'text'
        const isOwn = message.isOwn ?? false
        return messageType === 'image' ? (
          <ImageMessageBubble
            key={index}
            data={{
              image: message.image,
              content: message.content,
              avatarFallback: message.avatarFallback,
              avatarUrl: message.avatarUrl,
              author: message.author,
              time: message.time
            }}
            appearance={{ isOwn }}
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
            appearance={{ isOwn }}
            control={{ status: message.status }}
          />
        )
      })}
    </div>
  )
}
