'use client'

import { ImageMessageBubble, MessageBubble } from './message-bubble'

// Import types from shared types file to avoid circular dependencies
import type { ChatMessage } from './types'
// Re-export for backward compatibility
export type { ChatMessage } from './types'

import { demoMessages } from './demo/messaging'

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
  const resolved: NonNullable<ChatConversationProps['data']> = data ?? { messages: demoMessages }
  const messages = resolved.messages

  if (!messages || messages.length === 0) {
    return <div className="rounded-xl bg-card p-4" />
  }

  return (
    <div className="rounded-xl bg-card p-4 space-y-4">
      {messages.map((message, index) => {
        const messageType = message.type ?? 'text'
        const isOwn = message.isOwn ?? false
        const messageKey = message.content ? `${message.author || ''}-${message.content.slice(0, 40)}` : `msg-${index}`
        return messageType === 'image' ? (
          <ImageMessageBubble
            key={messageKey}
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
            key={messageKey}
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
