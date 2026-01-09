// Shared block categories for sidebar navigation
// Each block can have multiple variants displayed on the same page
export interface BlockCategory {
  id: string
  name: string
  blocks: { id: string; name: string }[]
}

export const blockCategories: BlockCategory[] = [
  {
    id: 'blog',
    name: 'Blogging',
    blocks: [
      { id: 'post-card', name: 'Post Card' },
      { id: 'post-detail', name: 'Post Detail' },
      { id: 'post-list', name: 'Post List' }
    ]
  },
  {
    id: 'form',
    name: 'Forms',
    blocks: [
      { id: 'contact-form', name: 'Contact Form' },
      { id: 'date-time-picker', name: 'Date & Time Picker' },
      { id: 'issue-report-form', name: 'Issue Report Form' }
    ]
  },
  {
    id: 'list',
    name: 'Lists & Tables',
    blocks: [{ id: 'table', name: 'Table' }]
  },
  {
    id: 'map',
    name: 'Map',
    blocks: [{ id: 'map-carousel', name: 'Map Carousel' }]
  },
  {
    id: 'messaging',
    name: 'Messaging',
    blocks: [
      { id: 'chat-conversation', name: 'Chat Conversation' },
      { id: 'message-bubble', name: 'Message Bubble' }
    ]
  },
  {
    id: 'misc',
    name: 'Miscellaneous',
    blocks: [
      { id: 'stats-cards', name: 'Stats Cards' },
      { id: 'weather-widget', name: 'Weather Widget' }
    ]
  },
  {
    id: 'payment',
    name: 'Payment',
    blocks: [
      { id: 'amount-input', name: 'Amount Input' },
      { id: 'card-form', name: 'Card Form' },
      { id: 'order-confirm', name: 'Order Confirmation' },
      { id: 'payment-confirmed', name: 'Payment Confirmed' },
      { id: 'payment-methods', name: 'Payment Methods' },
      { id: 'payment-success', name: 'Payment Success' }
    ]
  },
  {
    id: 'products',
    name: 'Products',
    blocks: [
      { id: 'product-carousel', name: 'Product Carousel' },
      { id: 'product-grid', name: 'Product Grid' },
      { id: 'product-horizontal', name: 'Product Horizontal' },
      { id: 'product-picker', name: 'Product Picker' }
    ]
  },
  {
    id: 'selection',
    name: 'Selection',
    blocks: [
      { id: 'card-selection', name: 'Card Selection' },
      { id: 'option-list', name: 'Option List' },
      { id: 'quick-reply', name: 'Quick Reply' },
      { id: 'tag-selection', name: 'Tag Selection' }
    ]
  },
  {
    id: 'social',
    name: 'Social',
    blocks: [
      { id: 'instagram-post', name: 'Instagram Post' },
      { id: 'linkedin-post', name: 'LinkedIn Post' },
      { id: 'x-post', name: 'X Post' },
      { id: 'youtube-post', name: 'YouTube Post' }
    ]
  },
  {
    id: 'status',
    name: 'Status & Progress',
    blocks: [
      { id: 'progress-steps', name: 'Progress Steps' },
      { id: 'status-badges', name: 'Status Badges' }
    ]
  }
]
