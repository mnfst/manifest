// Shared types for Messaging category components

/**
 * Represents a chat message with content and metadata.
 * @interface ChatMessage
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
