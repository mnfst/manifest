import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Component Preview'
export const size = {
  width: 1200,
  height: 630
}
export const contentType = 'image/png'

// Map block IDs to display names
const blockNames: Record<string, string> = {
  'contact-form': 'Contact Form',
  'date-time-picker': 'Date & Time Picker',
  'issue-report-form': 'Issue Report Form',
  'card-form': 'Card Form',
  'pay-confirm': 'Payment Confirmation',
  'order-summary': 'Order Summary',
  'saved-cards': 'Saved Cards',
  'payment-success': 'Payment Success',
  'bank-card-form': 'Bank Card Form',
  'payment-methods': 'Payment Methods',
  'order-confirm': 'Order Confirmation',
  'payment-confirmed': 'Payment Confirmed',
  'product-list': 'Product List',
  'option-list': 'Option List',
  'amount-input': 'Amount Input',
  'tag-select': 'Tag Selection',
  'quick-reply': 'Quick Reply',
  'progress-steps': 'Progress Steps',
  'status-badge': 'Status Badge',
  'stats': 'Stats Cards',
  'skeleton': 'Skeleton',
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
  'event-checkout': 'Event Checkout',
  'event-confirmation': 'Event Confirmation'
}

// Category display names
const categoryNames: Record<string, string> = {
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

export default async function Image({
  params
}: {
  params: Promise<{ category: string; block: string }>
}) {
  const { category, block } = await params

  const blockName = blockNames[block] || formatBlockName(block)
  const categoryName = categoryNames[category] || formatCategoryName(category)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
          padding: '60px'
        }}
      >
        {/* Main card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '24px',
            padding: '60px 80px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '900px'
          }}
        >
          {/* Category badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f0f0ff',
              color: '#6366f1',
              fontSize: '18px',
              fontWeight: 600,
              padding: '8px 20px',
              borderRadius: '999px',
              marginBottom: '24px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            {categoryName}
          </div>

          {/* Component name */}
          <div
            style={{
              fontSize: '56px',
              fontWeight: 700,
              color: '#1a1a2e',
              textAlign: 'center',
              lineHeight: 1.2,
              marginBottom: '20px'
            }}
          >
            {blockName}
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: '22px',
              color: '#6b7280',
              textAlign: 'center'
            }}
          >
            Ready-to-use React component for ChatGPT apps
          </div>
        </div>

        {/* Manifest UI branding at bottom */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '40px',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '20px',
            fontWeight: 500
          }}
        >
          ui.manifest.build
        </div>
      </div>
    ),
    {
      ...size
    }
  )
}

// Helper function to format block names
function formatBlockName(block: string): string {
  return block
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Helper function to format category names
function formatCategoryName(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}
