/**
 * Shared utilities for OG image generation.
 */

/** Map block IDs to display names */
export const blockNames: Record<string, string> = {
  'contact-form': 'Contact Form',
  'date-time-picker': 'Date & Time Picker',
  'issue-report-form': 'Issue Report Form',
  'order-confirm': 'Order Confirmation',
  'payment-confirmed': 'Payment Confirmed',
  'product-list': 'Product List',
  'option-list': 'Option List',
  'amount-input': 'Amount Input',
  'tag-select': 'Tag Selection',
  'quick-reply': 'Quick Reply',
  'progress-steps': 'Progress Steps',
  'status-badge': 'Status Badge',
  stats: 'Stats Cards',
  'post-card': 'Post Card',
  'post-list': 'Post List',
  'post-detail': 'Post Detail',
  table: 'Data Table',
  'message-bubble': 'Message Bubble',
  'chat-conversation': 'Chat Conversation',
  'x-post': 'X Post',
  'instagram-post': 'Instagram Post',
  'linkedin-post': 'LinkedIn Post',
  'youtube-post': 'YouTube Post',
  'map-carousel': 'Map Carousel',
  'event-card': 'Event Card',
  'event-list': 'Event List',
  'event-detail': 'Event Detail',
  'ticket-tier-select': 'Ticket Selection',
  'event-confirmation': 'Event Confirmation'
}

/** Category display names */
export const categoryNames: Record<string, string> = {
  blog: 'Blogging',
  events: 'Events',
  form: 'Forms',
  list: 'Lists & Tables',
  map: 'Map',
  messaging: 'Messaging',
  misc: 'Miscellaneous',
  payment: 'Payment',
  products: 'Products',
  selection: 'Selection',
  social: 'Social',
  status: 'Status & Progress'
}

/** Block descriptions for SEO */
export const blockDescriptions: Record<string, string> = {
  'contact-form':
    'A customizable contact form with name, email, phone, message fields and file attachments.',
  'date-time-picker':
    'Interactive date and time picker with calendar view and time slot selection.',
  'issue-report-form':
    'Bug report form with categories, severity levels, and file attachment support.',
  'order-confirm':
    'Order confirmation with product image, details, and delivery information.',
  'payment-confirmed':
    'Payment confirmed screen with product image and tracking button.',
  'product-list': 'Product list with list, grid, carousel, and picker display variants.',
  'option-list': 'Option list with single and multiple selection modes.',
  'amount-input':
    'Amount input with increment/decrement buttons and preset value options.',
  'tag-select': 'Tag selection component with color variants and multi-select support.',
  'quick-reply': 'Quick reply buttons for chat interfaces with customizable options.',
  'progress-steps': 'Progress indicator with horizontal and vertical layout options.',
  'status-badge': 'Status badges with multiple states like success, pending, error.',
  stats: 'Scrollable stat cards with trends and metric displays.',
  'post-card':
    'Blog post card with default, compact, horizontal, and covered variants.',
  'post-list': 'Blog post list with list, grid, carousel, and fullwidth variants.',
  'post-detail': 'Full blog post view with cover image, author info, and related posts.',
  table: 'Data table with single and multi-select row selection modes.',
  'message-bubble':
    'Chat message bubble with text, image, voice, and reaction variants.',
  'chat-conversation': 'Full chat conversation view with multiple message types.',
  'x-post': 'X (Twitter) post embed with engagement metrics display.',
  'instagram-post': 'Instagram post embed with image and engagement display.',
  'linkedin-post': 'LinkedIn post embed with professional styling.',
  'youtube-post': 'YouTube video embed with playable video.',
  'map-carousel': 'Interactive map with location cards carousel.',
  'event-card': 'Event card with default, compact, horizontal, and covered variants.',
  'event-list': 'Event list with grid, list, carousel layouts and map integration.',
  'event-detail':
    'Full event details with image carousel, organizer info, and ticket purchase.',
  'ticket-tier-select':
    'Ticket tier selection with quantity controls and price breakdown.',
  'event-confirmation':
    'Event booking confirmation with order details and social sharing.'
}

/** Format block ID to display name */
export function formatBlockName(block: string): string {
  return block
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Format category ID to display name */
export function formatCategoryName(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

/** Get block display name */
export function getBlockName(block: string): string {
  return blockNames[block] || formatBlockName(block)
}

/** Get category display name */
export function getCategoryName(category: string): string {
  return categoryNames[category] || formatCategoryName(category)
}

/** Get block description */
export function getBlockDescription(block: string, blockName: string): string {
  return (
    blockDescriptions[block] ||
    `${blockName} component for building ChatGPT apps and agentic UIs.`
  )
}

/** OG image dimensions (standard for social media) */
export const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630
}

/** Gradient background for OG images */
export const OG_GRADIENT =
  'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)'
