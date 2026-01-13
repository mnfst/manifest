'use client'

/**
 * Component map for preview generation.
 * Maps component names to their rendered React elements with default demo data.
 */

import { ReactNode } from 'react'

// Form components
import { ContactForm } from '@/registry/form/contact-form'
import { DateTimePicker } from '@/registry/form/date-time-picker'
import { IssueReportForm } from '@/registry/form/issue-report-form'

// Payment components
import { CardForm } from '@/registry/payment/card-form'
import { PayConfirm } from '@/registry/payment/pay-confirm'
import { OrderSummary } from '@/registry/payment/order-summary'
import { SavedCards } from '@/registry/payment/saved-cards'
import { PaymentSuccess } from '@/registry/payment/payment-success'
import { BankCardForm } from '@/registry/payment/bank-card-form'
import { PaymentMethods } from '@/registry/payment/payment-methods'
import { OrderConfirm } from '@/registry/payment/order-confirm'
import { PaymentConfirmed } from '@/registry/payment/payment-confirmed'
import { AmountInput } from '@/registry/payment/amount-input'

// List components
import { ProductList } from '@/registry/list/product-list'
import { Table } from '@/registry/list/table'

// Miscellaneous components
import { OptionList } from '@/registry/miscellaneous/option-list'
import { TagSelect } from '@/registry/miscellaneous/tag-select'
import { QuickReply } from '@/registry/miscellaneous/quick-reply'
import { ProgressSteps } from '@/registry/miscellaneous/progress-steps'
import { StatusBadge } from '@/registry/miscellaneous/status-badge'
import { Stats } from '@/registry/miscellaneous/stat-card'
import { XPost } from '@/registry/miscellaneous/x-post'
import { InstagramPost } from '@/registry/miscellaneous/instagram-post'
import { LinkedInPost } from '@/registry/miscellaneous/linkedin-post'
import { YouTubePost } from '@/registry/miscellaneous/youtube-post'
import { MapCarousel } from '@/registry/miscellaneous/map-carousel'

// Blogging components
import { PostCard } from '@/registry/blogging/post-card'
import { PostList } from '@/registry/blogging/post-list'
import { PostDetail } from '@/registry/blogging/post-detail'

// Messaging components
import { MessageBubble } from '@/registry/messaging/message-bubble'
import { ChatConversation } from '@/registry/messaging/chat-conversation'

// Events components
import { EventCard } from '@/registry/events/event-card'
import { EventList } from '@/registry/events/event-list'
import { EventDetail } from '@/registry/events/event-detail'
import { TicketTierSelect } from '@/registry/events/ticket-tier-select'
import { EventCheckout } from '@/registry/events/event-checkout'
import { EventConfirmation } from '@/registry/events/event-confirmation'

// Demo data
const demoPost = {
  id: '1',
  title: 'Getting Started with Agentic UI',
  excerpt: 'Learn how to build conversational interfaces with our component library.',
  coverImage: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
  author: { name: 'Sarah Chen', avatar: 'https://i.pravatar.cc/150?u=sarah' },
  publishedAt: '2024-01-15',
  readTime: '5 min read',
  tags: ['Tutorial', 'Components'],
  category: 'Tutorial'
}

const demoPosts = Array.from({ length: 6 }, (_, i) => ({
  ...demoPost,
  id: String(i + 1),
  title: `Post Title ${i + 1}`,
  excerpt: `This is the excerpt for post ${i + 1}.`
}))

const demoEvent = {
  id: '1',
  title: 'Summer Music Festival',
  category: 'Music',
  venue: 'Central Park',
  neighborhood: 'Manhattan',
  city: 'New York',
  startDateTime: new Date(Date.now() + 86400000 * 7).toISOString(),
  priceRange: '$45 - $150',
  image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800',
  vibeTags: ['High energy', 'Outdoor', 'Social'] as const,
  eventSignal: 'popular' as const
}

const demoProducts = [
  { id: '1', name: 'Premium Headphones', price: 299, image: '/demo/shoe-1.png' },
  { id: '2', name: 'Wireless Earbuds', price: 149, image: '/demo/shoe-2.png' },
  { id: '3', name: 'Smart Speaker', price: 199, image: '/demo/shoe-3.png' }
]

const demoTableData = {
  columns: [
    { key: 'name', label: 'Name', type: 'text' as const },
    { key: 'email', label: 'Email', type: 'text' as const },
    { key: 'status', label: 'Status', type: 'badge' as const }
  ],
  rows: [
    { id: '1', name: 'John Doe', email: 'john@example.com', status: 'Active' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'Pending' },
    { id: '3', name: 'Bob Johnson', email: 'bob@example.com', status: 'Active' }
  ]
}

const demoOrderItems = [
  { id: '1', name: 'Wireless Headphones', quantity: 1, price: 199.99 },
  { id: '2', name: 'Phone Case', quantity: 2, price: 29.99 }
]

const demoSavedCards = [
  { id: '1', brand: 'visa' as const, lastFour: '4242', expiryMonth: '12', expiryYear: '25', isDefault: true },
  { id: '2', brand: 'mastercard' as const, lastFour: '5555', expiryMonth: '06', expiryYear: '26', isDefault: false }
]

const demoTicketTiers = [
  { id: '1', name: 'General Admission', price: 45, available: 100, maxPerOrder: 10 },
  { id: '2', name: 'VIP', price: 150, available: 20, maxPerOrder: 4, description: 'Includes backstage access' }
]

const demoMapLocations = [
  { id: '1', name: 'Coffee Shop', lat: 40.7128, lng: -74.006, description: 'Best coffee in town' },
  { id: '2', name: 'Book Store', lat: 40.7138, lng: -74.008, description: 'Rare books collection' },
  { id: '3', name: 'Park', lat: 40.7148, lng: -74.004, description: 'Beautiful city park' }
]

export interface PreviewComponentConfig {
  component: ReactNode
  category: string
}

/**
 * Map of component names to their preview configurations.
 * Each entry contains the rendered component and its category for background styling.
 */
export const previewComponents: Record<string, PreviewComponentConfig> = {
  // Form components
  'contact-form': {
    component: <ContactForm />,
    category: 'form'
  },
  'date-time-picker': {
    component: <DateTimePicker />,
    category: 'form'
  },
  'issue-report-form': {
    component: <IssueReportForm />,
    category: 'form'
  },

  // Payment components
  'card-form': {
    component: <CardForm />,
    category: 'payment'
  },
  'pay-confirm': {
    component: <PayConfirm data={{ amount: 259.97, cardLastFour: '4242', cardBrand: 'visa' }} />,
    category: 'payment'
  },
  'order-summary': {
    component: <OrderSummary data={{ items: demoOrderItems, subtotal: 259.97, shipping: 9.99, tax: 21.60, total: 291.56 }} />,
    category: 'payment'
  },
  'saved-cards': {
    component: <SavedCards data={{ cards: demoSavedCards }} />,
    category: 'payment'
  },
  'payment-success': {
    component: <PaymentSuccess data={{ orderId: 'ORD-12345', email: 'customer@example.com', total: 291.56 }} />,
    category: 'payment'
  },
  'bank-card-form': {
    component: <BankCardForm />,
    category: 'payment'
  },
  'payment-methods': {
    component: <PaymentMethods />,
    category: 'payment'
  },
  'order-confirm': {
    component: <OrderConfirm data={{ productName: 'Premium Headphones', productImage: '/demo/shoe-1.png', price: 299, deliveryDate: 'Jan 20, 2024' }} />,
    category: 'payment'
  },
  'payment-confirmed': {
    component: <PaymentConfirmed data={{ productName: 'Premium Headphones', productImage: '/demo/shoe-1.png', price: 299, deliveryDate: 'Jan 20, 2024', trackingNumber: 'TRK123456' }} />,
    category: 'payment'
  },
  'amount-input': {
    component: <AmountInput data={{ presets: [10, 25, 50, 100] }} />,
    category: 'payment'
  },

  // List components
  'product-list': {
    component: <ProductList data={{ products: demoProducts }} appearance={{ variant: 'grid' }} />,
    category: 'list'
  },
  'table': {
    component: <Table data={demoTableData} />,
    category: 'list'
  },

  // Miscellaneous components
  'option-list': {
    component: <OptionList data={{ options: [{ id: '1', label: 'Option A' }, { id: '2', label: 'Option B' }, { id: '3', label: 'Option C' }] }} />,
    category: 'miscellaneous'
  },
  'tag-select': {
    component: <TagSelect data={{ tags: [{ id: '1', label: 'Important', color: 'red' }, { id: '2', label: 'In Progress', color: 'yellow' }, { id: '3', label: 'Done', color: 'green' }] }} />,
    category: 'miscellaneous'
  },
  'quick-reply': {
    component: <QuickReply data={{ options: ['Yes, please', 'No, thanks', 'Tell me more'] }} />,
    category: 'miscellaneous'
  },
  'progress-steps': {
    component: <ProgressSteps data={{ steps: [{ id: '1', label: 'Cart' }, { id: '2', label: 'Shipping' }, { id: '3', label: 'Payment' }, { id: '4', label: 'Confirm' }], currentStep: 2 }} />,
    category: 'miscellaneous'
  },
  'status-badge': {
    component: <StatusBadge data={{ status: 'processing', label: 'Processing' }} />,
    category: 'miscellaneous'
  },
  'stats': {
    component: <Stats data={{ stats: [{ label: 'Revenue', value: '$12,345', change: 12.5 }, { label: 'Orders', value: '1,234', change: -3.2 }, { label: 'Customers', value: '567', change: 8.1 }] }} />,
    category: 'miscellaneous'
  },
  'skeleton': {
    component: <div className="space-y-3"><div className="h-4 bg-muted rounded animate-pulse w-3/4" /><div className="h-4 bg-muted rounded animate-pulse w-1/2" /><div className="h-20 bg-muted rounded animate-pulse" /></div>,
    category: 'miscellaneous'
  },
  'x-post': {
    component: <XPost data={{ author: { name: 'Elon Musk', handle: 'elonmusk', avatar: 'https://i.pravatar.cc/150?u=elon', verified: true }, content: 'The future of AI is here! 🚀', timestamp: '2h', likes: 42000, reposts: 8500, replies: 3200 }} />,
    category: 'miscellaneous'
  },
  'instagram-post': {
    component: <InstagramPost data={{ author: { name: 'National Geographic', handle: 'natgeo', avatar: 'https://i.pravatar.cc/150?u=natgeo', verified: true }, image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', caption: 'Nature at its finest 🌿', likes: 125000, comments: 2340 }} />,
    category: 'miscellaneous'
  },
  'linkedin-post': {
    component: <LinkedInPost data={{ author: { name: 'Satya Nadella', headline: 'CEO at Microsoft', avatar: 'https://i.pravatar.cc/150?u=satya' }, content: 'Excited to announce our latest AI innovations...', timestamp: '1d', likes: 15000, comments: 890, reposts: 2100 }} />,
    category: 'miscellaneous'
  },
  'youtube-post': {
    component: <YouTubePost data={{ title: 'Building the Future of AI', channel: { name: 'TechTalks', avatar: 'https://i.pravatar.cc/150?u=techtalks', subscribers: '2.5M' }, thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800', views: '1.2M', timestamp: '3 days ago', duration: '15:42' }} />,
    category: 'miscellaneous'
  },
  'map-carousel': {
    component: <MapCarousel data={{ locations: demoMapLocations, center: { lat: 40.7128, lng: -74.006 } }} />,
    category: 'miscellaneous'
  },

  // Blogging components
  'post-card': {
    component: <PostCard data={{ post: demoPost }} />,
    category: 'blogging'
  },
  'post-list': {
    component: <PostList data={{ posts: demoPosts }} appearance={{ variant: 'grid' }} />,
    category: 'blogging'
  },
  'post-detail': {
    component: <PostDetail data={{ post: { ...demoPost, content: '<p>This is the full article content...</p>' } }} />,
    category: 'blogging'
  },

  // Messaging components
  'message-bubble': {
    component: (
      <div className="space-y-4 w-full max-w-md">
        <MessageBubble data={{ content: 'Hey! How are you doing?', avatarFallback: 'J', time: '10:30 AM' }} />
        <MessageBubble data={{ content: "I'm doing great, thanks for asking!", time: '10:31 AM' }} appearance={{ isOwn: true }} control={{ status: 'read' }} />
      </div>
    ),
    category: 'messaging'
  },
  'chat-conversation': {
    component: <ChatConversation data={{ messages: [
      { id: '1', content: 'Hello! How can I help you today?', sender: 'assistant', timestamp: '10:00 AM' },
      { id: '2', content: 'I need help with my order', sender: 'user', timestamp: '10:01 AM' },
      { id: '3', content: 'Of course! Could you please provide your order number?', sender: 'assistant', timestamp: '10:01 AM' }
    ] }} />,
    category: 'messaging'
  },

  // Events components
  'event-card': {
    component: <EventCard data={{ event: demoEvent }} />,
    category: 'events'
  },
  'event-list': {
    component: <EventList data={{ events: [demoEvent, { ...demoEvent, id: '2', title: 'Jazz Night', category: 'Music' }, { ...demoEvent, id: '3', title: 'Comedy Show', category: 'Comedy' }] }} appearance={{ variant: 'grid' }} />,
    category: 'events'
  },
  'event-detail': {
    component: <EventDetail data={{ event: { ...demoEvent, description: 'Join us for an amazing summer music festival!', organizer: { name: 'Live Events Co', avatar: 'https://i.pravatar.cc/150?u=live', verified: true } } }} />,
    category: 'events'
  },
  'ticket-tier-select': {
    component: <TicketTierSelect data={{ tiers: demoTicketTiers, eventTitle: 'Summer Music Festival' }} />,
    category: 'events'
  },
  'event-checkout': {
    component: <EventCheckout data={{ event: demoEvent, selectedTiers: [{ tierId: '1', quantity: 2, price: 45 }], subtotal: 90, fees: 9, total: 99 }} />,
    category: 'events'
  },
  'event-confirmation': {
    component: <EventConfirmation data={{ event: demoEvent, orderNumber: 'EVT-12345', tickets: [{ tierName: 'General Admission', quantity: 2 }], total: 99 }} />,
    category: 'events'
  }
}

/**
 * Get the list of all available component names for preview generation.
 */
export function getPreviewComponentNames(): string[] {
  return Object.keys(previewComponents)
}
