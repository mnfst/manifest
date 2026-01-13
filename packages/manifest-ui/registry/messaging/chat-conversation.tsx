'use client'

import { ImageMessageBubble, MessageBubble } from './message-bubble'

/**
 * Represents a single chat message.
 * @interface ChatMessage
 * @property {string} id - Unique message identifier
 * @property {"text" | "image"} [type] - Message type (defaults to "text")
 * @property {string} content - Message text content or caption
 * @property {string} [image] - Image URL (for image type)
 * @property {string} [author] - Author name
 * @property {string} [avatarUrl] - Avatar image URL
 * @property {string} [avatarFallback] - Avatar fallback letter
 * @property {string} [time] - Time display string
 * @property {boolean} isOwn - Whether this is the current user's message
 * @property {"sent" | "delivered" | "read"} [status] - Delivery status
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
 * @property {ChatMessage[]} [data.messages] - Array of messages to display
 */
export interface ChatConversationProps {
  data?: {
    messages?: ChatMessage[]
  }
}

const defaultMessages: ChatMessage[] = [
  {
    type: 'text',
    content: 'Hey! Check out this new feature we just shipped 🚀',
    author: 'Sarah',
    avatarFallback: 'S',
    time: '10:30 AM',
    isOwn: false
  },
  {
    type: 'text',
    content: 'Oh wow, that looks amazing! How long did it take to build?',
    author: 'You',
    avatarFallback: 'Y',
    time: '10:31 AM',
    isOwn: true,
    status: 'read'
  },
  {
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
    type: 'text',
    content: 'This is incredible! The UI is so clean 👏',
    author: 'You',
    avatarFallback: 'Y',
    time: '10:33 AM',
    isOwn: true,
    status: 'delivered'
  }
]

/**
 * A chat conversation component displaying multiple messages.
 * Renders text and image messages with appropriate styling.
 *
 * Features:
 * - Support for text and image messages
 * - Automatic message type detection
 * - Avatar and delivery status display
 * - Own/other message differentiation
 * - Vertical message spacing
 *
 * @component
 * @example
 * ```tsx
 * <ChatConversation
 *   data={{
 *     messages: [
 *       {
 *         id: "1",
 *         type: "text",
 *         content: "Hey! Check out this new feature 🚀",
 *         author: "Sarah",
 *         avatarFallback: "S",
 *         time: "10:30 AM",
 *         isOwn: false
 *       },
 *       {
 *         id: "2",
 *         type: "text",
 *         content: "That looks amazing!",
 *         time: "10:31 AM",
 *         isOwn: true,
 *         status: "read"
 *       }
 *     ]
 *   }}
 * />
 * ```
 */
export function ChatConversation({ data }: ChatConversationProps) {
  const { messages = defaultMessages } = data ?? {}
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
