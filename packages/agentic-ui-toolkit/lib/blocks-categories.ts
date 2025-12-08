// Shared block categories for sidebar navigation
export interface BlockCategory {
  id: string
  name: string
  blocks: { id: string; name: string }[]
}

export const blockCategories: BlockCategory[] = [
  {
    id: 'blog',
    name: 'Blog & Articles',
    blocks: [
      { id: 'blog-post-card', name: 'Post Card' },
      { id: 'blog-post-card-no-image', name: 'Post Card (No Image)' },
      { id: 'blog-post-card-compact', name: 'Post Card (Compact)' },
      { id: 'blog-post-card-horizontal', name: 'Post Card (Horizontal)' },
      { id: 'blog-post-list', name: 'Post List' },
      { id: 'blog-post-grid', name: 'Post Grid' },
      { id: 'blog-post-grid-3col', name: 'Post Grid (3 Columns)' },
      { id: 'blog-post-carousel', name: 'Post Carousel' },
      { id: 'blog-excerpt-card', name: 'Excerpt Card' },
      { id: 'article-detail', name: 'Article Detail' },
      { id: 'article-detail-no-cover', name: 'Article Detail (No Cover)' },
      { id: 'featured-article', name: 'Featured Article' }
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
      { id: 'product-horizontal-grid', name: 'Product Horizontal Grid' },
      { id: 'product-horizontal-carousel', name: 'Product Horizontal Carousel' },
      { id: 'product-picker', name: 'Product Picker' }
    ]
  },
  {
    id: 'selection',
    name: 'Selection',
    blocks: [
      { id: 'option-list', name: 'Option List' },
      { id: 'card-selection', name: 'Card Selection' },
      { id: 'multi-card-selection', name: 'Multi Card Selection' },
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
    blocks: [
      { id: 'table', name: 'Table' },
      { id: 'table-single-select', name: 'Table Single Select' },
      { id: 'table-multi-select', name: 'Table Multi Select' }
    ]
  },
  {
    id: 'messaging',
    name: 'Messaging',
    blocks: [
      { id: 'message-bubble', name: 'Message Bubble' },
      { id: 'image-message', name: 'Image Message' },
      { id: 'chat-conversation', name: 'Chat Conversation' },
      { id: 'message-reactions', name: 'Message with Reactions' },
      { id: 'voice-message', name: 'Voice Message' }
    ]
  },
  {
    id: 'social',
    name: 'Social Posts',
    blocks: [
      { id: 'x-post', name: 'X Post' },
      { id: 'instagram-post', name: 'Instagram Post' },
      { id: 'linkedin-post', name: 'LinkedIn Post' },
      { id: 'youtube-post', name: 'YouTube Post' }
    ]
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
