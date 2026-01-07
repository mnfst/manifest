// Shared block categories for sidebar navigation
// Each block can have multiple variants displayed on the same page
export interface BlockCategory {
  id: string
  name: string
  blocks: { id: string; name: string }[]
}

export const blockCategories: BlockCategory[] = [
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
    id: 'blog',
    name: 'Blogging',
    blocks: [
      { id: 'post-card', name: 'Post Card' },
      { id: 'post-list', name: 'Post List' },
      { id: 'post-detail', name: 'Post Detail' }
    ]
  },
  {
    id: 'payment',
    name: 'Payment',
    blocks: [
      { id: 'order-confirm', name: 'Order Confirmation' },
      { id: 'payment-methods', name: 'Payment Methods' },
      { id: 'card-form', name: 'Card Form' },
      { id: 'amount-input', name: 'Amount Input' },
      { id: 'payment-success', name: 'Payment Success' },
      { id: 'payment-confirmed', name: 'Payment Confirmed' }
    ]
  },
  {
    id: 'products',
    name: 'Products',
    blocks: [
      { id: 'product-grid', name: 'Product Grid' },
      { id: 'product-carousel', name: 'Product Carousel' },
      { id: 'product-horizontal', name: 'Product Horizontal' },
      { id: 'product-picker', name: 'Product Picker' }
    ]
  },
  {
    id: 'selection',
    name: 'Selection',
    blocks: [
      { id: 'option-list', name: 'Option List' },
      { id: 'card-selection', name: 'Card Selection' },
      { id: 'tag-selection', name: 'Tag Selection' },
      { id: 'quick-reply', name: 'Quick Reply' }
    ]
  },
  {
    id: 'status',
    name: 'Status & Progress',
    blocks: [
      { id: 'progress-steps', name: 'Progress Steps' },
      { id: 'status-badges', name: 'Status Badges' }
    ]
  },
  {
    id: 'data',
    name: 'Lists & Tables',
    blocks: [{ id: 'table', name: 'Table' }]
  },
  {
    id: 'messaging',
    name: 'Messaging',
    blocks: [
      { id: 'message-bubble', name: 'Message Bubble' },
      { id: 'chat-conversation', name: 'Chat Conversation' }
    ]
  },
  {
    id: 'social',
    name: 'Social Posts',
    blocks: [{ id: 'social-posts', name: 'Social Posts' }]
  },
  {
    id: 'misc',
    name: 'Miscellaneous',
    blocks: [
      { id: 'stats-cards', name: 'Stats Cards' },
      { id: 'weather-widget', name: 'Weather Widget' }
    ]
  }
]
