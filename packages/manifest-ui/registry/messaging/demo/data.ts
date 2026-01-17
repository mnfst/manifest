// Demo data for Messaging category components
// This file contains sample data used for component previews and documentation

import type { ChatMessage } from '../chat-conversation'

// Default messages for ChatConversation
export const demoMessages: ChatMessage[] = [
  {
    type: 'text',
    content: 'Hey! Check out this new feature we just shipped',
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
      '/demo/images/thumbnail-1.jpg',
    author: 'Sarah',
    avatarFallback: 'S',
    time: '10:32 AM',
    isOwn: false
  },
  {
    type: 'text',
    content: 'This is incredible! The UI is so clean',
    author: 'You',
    avatarFallback: 'Y',
    time: '10:33 AM',
    isOwn: true,
    status: 'delivered'
  }
]
