// Demo data for Messaging category components
// This file contains sample data used for component previews and documentation

import type { ChatMessage } from '../types'

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
      'https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=400&h=300&fit=crop',
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

// Text message bubble data
export const demoTextMessages = [
  {
    content: 'Hey! How are you doing today?',
    avatarUrl: 'https://i.pravatar.cc/150?u=sarah',
    avatarFallback: 'S',
    time: 'Dec 8, 10:30 AM',
  },
  {
    content: "I'm doing great, thanks for asking!",
    avatarFallback: 'Y',
    time: 'Dec 8, 10:31 AM',
    isOwn: true,
    status: 'read' as const,
  },
]

// Image message bubble data
export const demoImageMessages = [
  {
    image:
      'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=400&h=300&fit=crop',
    content: 'Check out this view!',
    avatarUrl: 'https://i.pravatar.cc/150?u=alex',
    avatarFallback: 'A',
    time: 'Dec 8, 2:45 PM',
  },
  {
    image:
      'https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=400&h=300&fit=crop',
    time: 'Dec 8, 2:46 PM',
    isOwn: true,
    status: 'delivered' as const,
  },
]

// Voice message bubble data
export const demoVoiceMessage = {
  duration: '0:42',
  avatarUrl: 'https://i.pravatar.cc/150?u=mickael',
  avatarFallback: 'M',
  time: 'Dec 8, 3:15 PM',
}

// Reaction message data
export const demoReactionMessage = {
  content: 'We just hit 10,000 users!',
  avatarFallback: 'T',
  time: 'Dec 8, 4:20 PM',
  reactions: [
    { emoji: '🎉', count: 5 },
    { emoji: '❤️', count: 3 },
    { emoji: '👏', count: 2 },
  ],
}
