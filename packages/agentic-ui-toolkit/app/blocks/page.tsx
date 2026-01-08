'use client'

import { cn } from '@/lib/utils'
import { ChevronRight, Zap } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

// Form components
import { ContactForm } from '@/registry/form/contact-form'
import { DateTimePicker } from '@/registry/form/date-time-picker'
import { IssueReportForm } from '@/registry/form/issue-report-form'

// Blogging components
import { PostCardDemo } from '@/components/blocks/post-card-demo'
import { PostListDemo } from '@/components/blocks/post-list-demo'
import { PostDetail } from '@/registry/blogging/post-detail'

// List components
import { TableDemo } from '@/components/blocks/table-demo'
import { Table } from '@/registry/list/table'
import { ProductList } from '@/registry/list/product-list'

// Payment components
import { AmountInput } from '@/registry/payment/amount-input'
import { BankCardForm } from '@/registry/payment/bank-card-form'
import { OrderConfirm } from '@/registry/payment/order-confirm'
import { PaymentConfirmed } from '@/registry/payment/payment-confirmed'
import { PaymentMethods } from '@/registry/payment/payment-methods'
import { PaymentSuccess } from '@/registry/payment/payment-success'

// Messaging components
import { ChatConversation } from '@/registry/messaging/chat-conversation'
import {
  ImageMessageBubble,
  MessageBubble,
  MessageWithReactions,
  VoiceMessageBubble
} from '@/registry/messaging/message-bubble'
import { QuickReply } from '@/registry/miscellaneous/quick-reply'

// Miscellaneous components
import { InstagramPost } from '@/registry/miscellaneous/instagram-post'
import { LinkedInPost } from '@/registry/miscellaneous/linkedin-post'
import { MapCarousel } from '@/registry/miscellaneous/map-carousel'
import { OptionList } from '@/registry/miscellaneous/option-list'
import { ProgressSteps } from '@/registry/miscellaneous/progress-steps'
import {
  SkeletonProductCard,
  SkeletonStats
} from '@/registry/miscellaneous/skeleton'
import { Stats } from '@/registry/miscellaneous/stat-card'
import { StatusBadge } from '@/registry/miscellaneous/status-badge'
import { TagSelect } from '@/registry/miscellaneous/tag-select'
import { XPost } from '@/registry/miscellaneous/x-post'
import { YouTubePost } from '@/registry/miscellaneous/youtube-post'

// UI components
import { GettingStarted } from '@/components/blocks/getting-started'
import { VariantSection } from '@/components/blocks/variant-section'

// Types for the new structure
interface BlockVariant {
  id: string
  name: string
  component: React.ReactNode
  fullscreenComponent?: React.ReactNode
  usageCode?: string
}

type LayoutMode = 'inline' | 'fullscreen' | 'pip'

interface BlockGroup {
  id: string
  name: string
  description: string
  registryName: string
  layouts: LayoutMode[]
  actionCount: number
  variants: BlockVariant[]
}

interface Category {
  id: string
  name: string
  blocks: BlockGroup[]
}

const categories: Category[] = [
  {
    id: 'form',
    name: 'Forms',
    blocks: [
      {
        id: 'contact-form',
        name: 'Contact Form',
        description: 'A complete contact form with name fields, phone number with country selector, email, message textarea, and file attachment.',
        registryName: 'contact-form',
        layouts: ['inline'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <ContactForm />,
            usageCode: `<ContactForm />`
          }
        ]
      },
      {
        id: 'date-time-picker',
        name: 'Date & Time Picker',
        description: 'A Calendly-style date and time picker. Select a date to reveal available time slots, then select a time to show the Next button.',
        registryName: 'date-time-picker',
        layouts: ['inline'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <DateTimePicker />,
            usageCode: `<DateTimePicker />`
          }
        ]
      },
      {
        id: 'issue-report-form',
        name: 'Issue Report Form',
        description: 'A compact issue reporting form for team members with categories, subcategories, impact/urgency levels, and file attachments. Collapsible sections keep it chat-friendly.',
        registryName: 'issue-report-form',
        layouts: ['inline'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <IssueReportForm />,
            usageCode: `<IssueReportForm />`
          }
        ]
      }
    ]
  },
  {
    id: 'blog',
    name: 'Blogging',
    blocks: [
      {
        id: 'post-card',
        name: 'Post Card',
        description:
          'Display blog posts with various layouts and styles. Click "Read" to see fullscreen mode.',
        registryName: 'post-card',
        layouts: ['inline', 'fullscreen'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <PostCardDemo />,
            fullscreenComponent: <PostDetail appearance={{ displayMode: 'fullscreen' }} />,
            usageCode: `<PostCard />`
          },
          {
            id: 'no-image',
            name: 'Without Image',
            component: <PostCardDemo appearance={{ showImage: false }} />,
            fullscreenComponent: <PostDetail appearance={{ displayMode: 'fullscreen' }} />,
            usageCode: `<PostCard appearance={{ showImage: false }} />`
          },
          {
            id: 'compact',
            name: 'Compact',
            component: <PostCardDemo appearance={{ variant: 'compact' }} />,
            fullscreenComponent: <PostDetail appearance={{ displayMode: 'fullscreen' }} />,
            usageCode: `<PostCard appearance={{ variant: "compact" }} />`
          },
          {
            id: 'horizontal',
            name: 'Horizontal',
            component: <PostCardDemo appearance={{ variant: 'horizontal' }} />,
            fullscreenComponent: <PostDetail appearance={{ displayMode: 'fullscreen' }} />,
            usageCode: `<PostCard appearance={{ variant: "horizontal" }} />`
          },
          {
            id: 'covered',
            name: 'Covered',
            component: <PostCardDemo appearance={{ variant: 'covered' }} />,
            fullscreenComponent: <PostDetail appearance={{ displayMode: 'fullscreen' }} />,
            usageCode: `<PostCard appearance={{ variant: "covered" }} />`
          }
        ]
      },
      {
        id: 'post-list',
        name: 'Post List',
        description: 'Display multiple posts in various layouts',
        registryName: 'post-list',
        layouts: ['inline', 'fullscreen'],
        actionCount: 1,
        variants: [
          {
            id: 'list',
            name: 'List',
            component: <PostListDemo appearance={{ variant: 'list' }} />,
            fullscreenComponent: <PostDetail appearance={{ displayMode: 'fullscreen' }} />,
            usageCode: `<PostList appearance={{ variant: "list" }} />`
          },
          {
            id: 'grid',
            name: 'Grid',
            component: <PostListDemo appearance={{ variant: 'grid' }} />,
            fullscreenComponent: <PostDetail appearance={{ displayMode: 'fullscreen' }} />,
            usageCode: `<PostList appearance={{ variant: "grid" }} />`
          },
          {
            id: 'carousel',
            name: 'Carousel',
            component: <PostListDemo appearance={{ variant: 'carousel' }} />,
            fullscreenComponent: <PostDetail appearance={{ displayMode: 'fullscreen' }} />,
            usageCode: `<PostList appearance={{ variant: "carousel" }} />`
          }
        ]
      }
    ]
  },
  {
    id: 'data',
    name: 'List',
    blocks: [
      {
        id: 'product-list',
        name: 'Product List',
        description: 'Display products in various layouts',
        registryName: 'product-list',
        layouts: ['inline'],
        actionCount: 2,
        variants: [
          {
            id: 'list',
            name: 'List',
            component: <ProductList appearance={{ variant: 'list' }} />,
            usageCode: `<ProductList
  data={{
    products: [
      {
        id: "1",
        name: "Air Force 1 '07",
        description: "Nike",
        price: 119,
        image: "/demo/shoe-1.png",
        rating: 4.9,
        badge: "New",
        inStock: true
      },
      // ... more products
    ]
  }}
  appearance={{ variant: "list", currency: "EUR" }}
  actions={{ onSelectProduct: (product) => console.log(product) }}
/>`
          },
          {
            id: 'grid',
            name: 'Grid',
            component: <ProductList appearance={{ variant: 'grid' }} />,
            usageCode: `<ProductList
  data={{ products: [...] }}
  appearance={{ variant: "grid", columns: 4, currency: "USD" }}
  actions={{ onSelectProduct: (product) => console.log(product) }}
/>`
          },
          {
            id: 'carousel',
            name: 'Carousel',
            component: <ProductList appearance={{ variant: 'carousel' }} />,
            usageCode: `<ProductList
  data={{ products: [...] }}
  appearance={{ variant: "carousel" }}
  actions={{ onSelectProduct: (product) => console.log(product) }}
/>`
          },
          {
            id: 'picker',
            name: 'Picker',
            component: <ProductList appearance={{ variant: 'picker' }} />,
            usageCode: `<ProductList
  data={{ products: [...] }}
  appearance={{ variant: "picker", buttonLabel: "Add to cart" }}
  actions={{ onAddToCart: (products) => console.log("Cart:", products) }}
/>`
          }
        ]
      },
      {
        id: 'table',
        name: 'Table',
        description:
          'Data table with header, footer, expand to fullscreen, and optional selection',
        registryName: 'table',
        layouts: ['inline', 'fullscreen'],
        actionCount: 6,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <TableDemo data={{ title: 'API Usage' }} />,
            fullscreenComponent: <Table data={{ title: 'API Usage' }} appearance={{ displayMode: 'fullscreen' }} />,
            usageCode: `<Table data={{ title: "API Usage" }} />`
          },
          {
            id: 'single-select',
            name: 'Single Select',
            component: (
              <TableDemo
                data={{ title: 'Models' }}
                appearance={{ selectable: 'single' }}
                actions={{ onCopy: (rows) => console.log('Copy:', rows) }}
              />
            ),
            fullscreenComponent: (
              <Table
                data={{ title: 'Models' }}
                appearance={{ selectable: 'single', displayMode: 'fullscreen' }}
                actions={{ onCopy: (rows) => console.log('Copy:', rows) }}
              />
            ),
            usageCode: `<Table data={{ title: "Models" }} appearance={{ selectable: "single" }} actions={{ onCopy: (rows) => ... }} />`
          },
          {
            id: 'multi-select',
            name: 'Multi Select',
            component: (
              <TableDemo
                data={{ title: 'Export Data' }}
                appearance={{ selectable: 'multi' }}
                actions={{
                  onDownload: (rows) => console.log('Download:', rows),
                  onShare: (rows) => console.log('Share:', rows)
                }}
              />
            ),
            fullscreenComponent: (
              <Table
                data={{ title: 'Export Data' }}
                appearance={{ selectable: 'multi', displayMode: 'fullscreen' }}
                actions={{
                  onDownload: (rows) => console.log('Download:', rows),
                  onShare: (rows) => console.log('Share:', rows)
                }}
              />
            ),
            usageCode: `<Table data={{ title: "Export Data" }} appearance={{ selectable: "multi" }} actions={{ onDownload, onShare }} />`
          }
        ]
      }
    ]
  },
  {
    id: 'payment',
    name: 'Payment',
    blocks: [
      {
        id: 'order-confirm',
        name: 'Order Confirmation',
        description: 'Display order summary before payment',
        registryName: 'order-confirm',
        layouts: ['inline'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <OrderConfirm />,
            usageCode: `<OrderConfirm
  data={{
    productName: "MacBook Pro 14-inch",
    productVariant: "Space Gray, M3 Pro",
    productImage: "https://store.storeimages.cdn-apple.com/...",
    quantity: 1,
    price: 1999,
    deliveryDate: "Wed. Jan 15",
    deliveryAddress: "123 Main Street, San Francisco, CA 94102",
    freeShipping: true
  }}
  appearance={{ currency: "USD" }}
  actions={{ onConfirm: () => console.log("Order confirmed!") }}
  control={{ isLoading: false }}
/>`
          }
        ]
      },
      {
        id: 'payment-methods',
        name: 'Payment Methods',
        description: 'Select payment method',
        registryName: 'payment-methods',
        layouts: ['inline'],
        actionCount: 3,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <PaymentMethods />,
            usageCode: `<PaymentMethods
  data={{
    methods: [
      { id: "1", type: "card", brand: "visa", last4: "4242" },
      { id: "2", type: "card", brand: "mastercard", last4: "8888", isDefault: true },
      { id: "3", type: "apple_pay" }
    ],
    amount: 279.00
  }}
  appearance={{ currency: "EUR" }}
  actions={{
    onSelectMethod: (methodId) => console.log("Selected:", methodId),
    onAddCard: () => console.log("Add card"),
    onPay: (methodId) => console.log("Pay with:", methodId)
  }}
/>`
          }
        ]
      },
      {
        id: 'card-form',
        name: 'Bank Card Form',
        description: 'Credit card input form',
        registryName: 'bank-card-form',
        layouts: ['inline'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <BankCardForm />,
            usageCode: `<BankCardForm
  data={{ amount: 149.99 }}
  appearance={{ currency: "USD", submitLabel: "Pay $149.99" }}
  actions={{
    onSubmit: (data) => console.log("Card:", data.cardNumber)
  }}
/>`
          }
        ]
      },
      {
        id: 'amount-input',
        name: 'Amount Input',
        description: 'Input for monetary amounts',
        registryName: 'amount-input',
        layouts: ['inline'],
        actionCount: 2,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <AmountInput />,
            usageCode: `<AmountInput
  data={{ presets: [20, 50, 100, 200] }}
  appearance={{
    min: 10,
    max: 1000,
    step: 10,
    currency: "USD",
    label: "Donation Amount"
  }}
  control={{ value: 50 }}
  actions={{
    onChange: (value) => console.log("Amount:", value),
    onConfirm: (value) => console.log("Confirmed:", value)
  }}
/>`
          }
        ]
      },
      {
        id: 'payment-success',
        name: 'Payment Success',
        description: 'Success confirmation after payment',
        registryName: 'payment-success',
        layouts: ['inline'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <PaymentSuccess />,
            usageCode: `<PaymentSuccess
  data={{
    orderId: "ORD-2024-7842",
    productName: "Air Force 1 '07",
    productImage: "/demo/shoe-1.png",
    price: 119,
    deliveryDate: "Tue. Dec 10"
  }}
  appearance={{ currency: "EUR" }}
  actions={{ onTrackOrder: () => console.log("Track order") }}
/>`
          }
        ]
      },
      {
        id: 'payment-confirmed',
        name: 'Payment Confirmation',
        description: 'Detailed payment confirmation',
        registryName: 'payment-confirmed',
        layouts: ['inline'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <PaymentConfirmed />,
            usageCode: `<PaymentConfirmed
  data={{
    orderId: "ORD-2024-7842",
    productName: "Air Force 1 '07",
    productDescription: "Nike - Size 42 - White",
    productImage: "/demo/shoe-1.png",
    price: 119,
    deliveryDate: "Tue. Dec 10"
  }}
  appearance={{ currency: "EUR" }}
  actions={{ onTrackOrder: () => console.log("Track order") }}
/>`
          }
        ]
      }
    ]
  },
  {
    id: 'messaging',
    name: 'Messaging',
    blocks: [
      {
        id: 'message-bubble',
        name: 'Message Bubble',
        description: 'Chat message bubbles',
        registryName: 'chat-conversation',
        layouts: ['inline'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Text Messages',
            component: (
              <div className="space-y-3">
                <MessageBubble
                  data={{
                    content: 'Hey! How are you doing today?',
                    avatar: 'S',
                    time: 'Dec 8, 10:30 AM'
                  }}
                />
                <MessageBubble
                  data={{
                    content: "I'm doing great, thanks for asking!",
                    avatar: 'Y',
                    time: 'Dec 8, 10:31 AM'
                  }}
                  appearance={{ isOwn: true }}
                  control={{ status: 'read' }}
                />
              </div>
            ),
            usageCode: `<MessageBubble
  data={{
    content: "Hey! How are you doing today?",
    avatar: "S",
    author: "Sarah",
    time: "10:30 AM"
  }}
/>

// Own message with status
<MessageBubble
  data={{ content: "I'm doing great!", avatar: "Y", time: "10:31 AM" }}
  appearance={{ isOwn: true }}
  control={{ status: "read" }}
/>`
          },
          {
            id: 'image',
            name: 'Image Messages',
            component: (
              <div className="space-y-3">
                <ImageMessageBubble
                  data={{
                    image:
                      'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=400&h=300&fit=crop',
                    caption: 'Check out this view!',
                    avatar: 'A',
                    time: 'Dec 8, 2:45 PM'
                  }}
                />
                <ImageMessageBubble
                  data={{
                    image:
                      'https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=400&h=300&fit=crop',
                    time: 'Dec 8, 2:46 PM'
                  }}
                  appearance={{ isOwn: true }}
                  control={{ status: 'delivered' }}
                />
              </div>
            ),
            usageCode: `<ImageMessageBubble
  data={{
    image: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba",
    caption: "Check out this view!",
    avatar: "A",
    author: "Alex",
    time: "2:45 PM"
  }}
/>

// Own image message
<ImageMessageBubble
  data={{ image: "...", time: "2:46 PM" }}
  appearance={{ isOwn: true }}
  control={{ status: "delivered" }}
/>`
          },
          {
            id: 'reactions',
            name: 'With Reactions',
            component: (
              <MessageWithReactions
                data={{
                  content: 'We just hit 10,000 users!',
                  avatar: 'T',
                  time: 'Dec 8, 4:20 PM',
                  reactions: [
                    { emoji: '🎉', count: 5 },
                    { emoji: '❤️', count: 3 },
                    { emoji: '👏', count: 2 }
                  ]
                }}
              />
            ),
            usageCode: `<MessageWithReactions
  data={{
    content: "We just hit 10,000 users!",
    avatar: "T",
    author: "Team",
    time: "4:20 PM",
    reactions: [
      { emoji: "🎉", count: 5 },
      { emoji: "❤️", count: 3 },
      { emoji: "👏", count: 2 }
    ]
  }}
/>`
          },
          {
            id: 'voice',
            name: 'Voice Messages',
            component: (
              <div className="space-y-3">
                <VoiceMessageBubble
                  data={{
                    duration: '0:42',
                    avatar: 'M',
                    time: 'Dec 8, 3:15 PM'
                  }}
                />
                <VoiceMessageBubble
                  data={{
                    duration: '1:23',
                    avatar: 'Y',
                    time: 'Dec 8, 3:17 PM'
                  }}
                  appearance={{ isOwn: true }}
                  control={{ status: 'read' }}
                />
              </div>
            ),
            usageCode: `<VoiceMessageBubble
  data={{
    duration: "0:42",
    avatar: "M",
    author: "Mike",
    time: "3:15 PM"
  }}
/>

// Own voice message
<VoiceMessageBubble
  data={{ duration: "1:23", avatar: "Y", time: "3:17 PM" }}
  appearance={{ isOwn: true }}
  control={{ status: "read" }}
/>`
          }
        ]
      },
      {
        id: 'chat-conversation',
        name: 'Chat Conversation',
        description: 'Full chat conversation view',
        registryName: 'chat-conversation',
        layouts: ['inline'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <ChatConversation />,
            usageCode: `<ChatConversation
  data={{
    messages: [
      {
        id: "1",
        type: "text",
        content: "Hey! Check out this new feature!",
        author: "Sarah",
        avatar: "S",
        time: "10:30 AM",
        isOwn: false
      },
      {
        id: "2",
        type: "text",
        content: "That looks amazing!",
        author: "You",
        avatar: "Y",
        time: "10:31 AM",
        isOwn: true,
        status: "read"
      },
      {
        id: "3",
        type: "image",
        content: "",
        image: "https://images.unsplash.com/...",
        caption: "Here's a preview",
        author: "Sarah",
        avatar: "S",
        time: "10:32 AM",
        isOwn: false
      }
    ]
  }}
/>`
          }
        ]
      }
    ]
  },
  {
    id: 'misc',
    name: 'Miscellaneous',
    blocks: [
      {
        id: 'map-carousel',
        name: 'Map Carousel',
        description:
          'Interactive map with location markers and a draggable carousel of cards',
        registryName: 'map-carousel',
        layouts: ['inline'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <MapCarousel data={{ mapStyle: 'jawg-lagoon', jawgAccessToken: '22bVROs6auuCAJ3QALhiCdA2wbAj4w0KPtPmNr5Eq5Hbpi2ug7foYlemD85sIi9Q' }} />,
            usageCode: `<MapCarousel />`
          }
        ]
      },
      {
        id: 'x-post',
        name: 'X Post',
        description: 'X (Twitter) post card',
        registryName: 'x-post',
        layouts: ['inline'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <XPost />,
            usageCode: `<XPost
  data={{
    author: "Manifest",
    username: "manifest",
    avatar: "M",
    content: "Just shipped a new feature! Build stunning agentic UIs that work seamlessly inside ChatGPT and Claude.",
    time: "2h",
    likes: "1.2K",
    retweets: "234",
    replies: "56",
    views: "45.2K",
    verified: true
  }}
/>`
          }
        ]
      },
      {
        id: 'instagram-post',
        name: 'Instagram Post',
        description: 'Instagram post card',
        registryName: 'instagram-post',
        layouts: ['inline'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <InstagramPost />,
            usageCode: `<InstagramPost
  data={{
    author: "manifest.ai",
    avatar: "M",
    image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600",
    likes: "2,847",
    caption: "Building the future of agentic UIs. What component would you love to see next?",
    time: "2 hours ago",
    verified: true
  }}
/>`
          }
        ]
      },
      {
        id: 'linkedin-post',
        name: 'LinkedIn Post',
        description: 'LinkedIn post card',
        registryName: 'linkedin-post',
        layouts: ['inline'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <LinkedInPost />,
            usageCode: `<LinkedInPost
  data={{
    author: "Manifest",
    headline: "Agentic UI Toolkit | 10K+ Developers",
    avatar: "M",
    content: "Excited to announce our latest milestone!\\n\\nWe've just crossed 10,000 developers using Manifest to build agentic UIs.\\n\\n#AI #AgenticUI #Developer",
    likes: "1,234",
    comments: "89",
    reposts: "45",
    time: "2h"
  }}
/>`
          }
        ]
      },
      {
        id: 'youtube-post',
        name: 'YouTube Post',
        description: 'YouTube video card',
        registryName: 'youtube-post',
        layouts: ['inline'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <YouTubePost />,
            usageCode: `<YouTubePost
  data={{
    channel: "NetworkChuck",
    avatar: "N",
    title: "you need to learn MCP RIGHT NOW!!",
    views: "1M views",
    time: "2 weeks ago",
    duration: "18:42",
    thumbnail: "https://img.youtube.com/vi/GuTcle5edjk/maxresdefault.jpg",
    verified: true,
    videoId: "GuTcle5edjk"
  }}
/>`
          }
        ]
      },
      {
        id: 'status-badges',
        name: 'Status Badge',
        description: 'Various status indicators',
        registryName: 'status-badge',
        layouts: ['inline'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'All Statuses',
            component: (
              <div className="flex flex-wrap gap-2 bg-white dark:bg-zinc-900 p-4 rounded-md">
                <StatusBadge data={{ status: 'success' }} />
                <StatusBadge data={{ status: 'pending' }} />
                <StatusBadge data={{ status: 'processing' }} />
                <StatusBadge data={{ status: 'shipped' }} />
                <StatusBadge data={{ status: 'delivered' }} />
                <StatusBadge data={{ status: 'error' }} />
              </div>
            ),
            usageCode: `<StatusBadge data={{ status: "success" }} />`
          }
        ]
      },
      {
        id: 'progress-steps',
        name: 'Progress Steps',
        description: 'Step-by-step progress indicator',
        registryName: 'progress-steps',
        layouts: ['inline'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <ProgressSteps />,
            usageCode: `<ProgressSteps
  data={{
    steps: [
      { id: "1", label: "Order received", status: "completed" },
      { id: "2", label: "Processing", status: "completed" },
      { id: "3", label: "Shipping", status: "current" },
      { id: "4", label: "Delivery", status: "pending" }
    ]
  }}
/>`
          }
        ]
      },
      {
        id: 'stats-cards',
        name: 'Stats Cards',
        description: 'Display statistics and metrics',
        registryName: 'stats',
        layouts: ['inline'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <Stats />,
            usageCode: `<Stats
  data={{
    stats: [
      { label: "Sales", value: "$12,543", change: 12.5, trend: "up" },
      { label: "Orders", value: "342", change: -3.2, trend: "down" },
      { label: "Customers", value: "1,205", change: 0, trend: "neutral" }
    ]
  }}
/>`
          }
        ]
      },
      {
        id: 'skeleton',
        name: 'Skeleton',
        description: 'Loading placeholder components',
        registryName: 'skeleton',
        layouts: ['inline'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: (
              <div className="space-y-4">
                <SkeletonProductCard />
                <SkeletonStats />
              </div>
            ),
            usageCode: `// Basic skeleton
<Skeleton appearance={{ className: "h-4 w-32" }} />

// Product card skeleton
<SkeletonProductCard />

// Stats skeleton
<SkeletonStats />`
          }
        ]
      },
      {
        id: 'quick-reply',
        name: 'Quick Reply',
        description: 'Quick reply buttons for chat',
        registryName: 'quick-reply',
        layouts: ['inline'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <QuickReply />,
            usageCode: `<QuickReply
  data={{
    replies: [
      { id: "1", label: "Yes, confirm" },
      { id: "2", label: "No thanks" },
      { id: "3", label: "I have a question" },
      { id: "4", label: "View details" }
    ]
  }}
  actions={{
    onSelectReply: (reply) => console.log("Selected:", reply.label)
  }}
/>`
          }
        ]
      },
      {
        id: 'option-list',
        name: 'Option List',
        description: 'Tag-style option selector',
        registryName: 'option-list',
        layouts: ['inline'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <OptionList />,
            usageCode: `<OptionList
  data={{
    options: [
      { id: "1", label: "Standard shipping", description: "3-5 business days" },
      { id: "2", label: "Express shipping", description: "1-2 business days" },
      { id: "3", label: "Store pickup", description: "Available in 2h" }
    ]
  }}
  appearance={{ multiple: false }}
  actions={{
    onSelectOption: (option) => console.log("Selected:", option.label)
  }}
/>`
          }
        ]
      },
      {
        id: 'tag-select',
        name: 'Tag Select',
        description: 'Colored tag selector',
        registryName: 'tag-select',
        layouts: ['inline'],
        actionCount: 2,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <TagSelect />,
            usageCode: `<TagSelect
  data={{
    tags: [
      { id: "1", label: "Electronics" },
      { id: "2", label: "Audio" },
      { id: "3", label: "Wireless" },
      { id: "4", label: "Apple" },
      { id: "5", label: "Premium" },
      { id: "6", label: "Sale" }
    ]
  }}
  appearance={{
    mode: "multiple",
    showClear: true,
    showValidate: true,
    validateLabel: "Apply filters"
  }}
  actions={{
    onSelectTags: (tagIds) => console.log("Tags:", tagIds),
    onValidate: (tagIds) => console.log("Validated:", tagIds)
  }}
/>`
          }
        ]
      }
    ]
  }
]

function BlocksContent() {
  const searchParams = useSearchParams()
  const blockId = searchParams.get('block')

  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    categories.map((c) => c.id)
  )

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  // Find the selected block group
  const selectedBlock = blockId
    ? categories.flatMap((c) => c.blocks).find((b) => b.id === blockId)
    : null

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-card">
      {/* Sidebar */}
      <aside className="hidden md:block w-[226px] shrink-0 p-6 overflow-y-auto">
        <nav className="space-y-1">
          <Link
            href="/blocks"
            className={cn(
              'block text-xs font-medium rounded-sm transition-colors py-1 px-2 mb-2',
              !blockId
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            Getting Started
          </Link>
          {categories.map((category) => (
            <div key={category.id}>
              <button
                onClick={() => toggleCategory(category.id)}
                className="flex w-full items-center justify-between py-1 px-2 text-xs font-medium text-foreground hover:bg-muted rounded-sm transition-colors"
              >
                {category.name}
                <ChevronRight
                  className={cn(
                    'h-3 w-3 transition-transform',
                    expandedCategories.includes(category.id) && 'rotate-90'
                  )}
                />
              </button>
              {expandedCategories.includes(category.id) && (
                <div className="mt-0.5 space-y-0 mb-4">
                  {category.blocks.map((block) => (
                    <Link
                      key={block.id}
                      href={`/blocks?block=${block.id}`}
                      className={cn(
                        'block my-1 text-xs rounded-sm transition-colors py-1 px-2',
                        blockId === block.id
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-foreground/70 hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      {block.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="w-full md:w-[calc(100vw-226px)] p-4 md:p-8 bg-muted/50">
        {selectedBlock ? (
          <div className="max-w-3xl mx-auto space-y-12">
            {/* Block Title */}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{selectedBlock.name}</h1>
                <div className="flex gap-1.5">
                  {selectedBlock.layouts.map((layout) => (
                    <span
                      key={layout}
                      className={cn(
                        'px-2 py-0.5 text-xs font-medium rounded-full',
                        layout === 'inline' &&
                          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        layout === 'fullscreen' &&
                          'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                        layout === 'pip' &&
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      )}
                    >
                      {layout}
                    </span>
                  ))}
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 inline-flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {selectedBlock.actionCount > 0
                      ? `${selectedBlock.actionCount} action${selectedBlock.actionCount > 1 ? 's' : ''}`
                      : 'read only'}
                  </span>
                </div>
              </div>
              <p className="text-muted-foreground">
                {selectedBlock.description}
              </p>
            </div>

            {/* All Variants */}
            {selectedBlock.variants.map((variant) => (
              <VariantSection
                key={variant.id}
                name={variant.name}
                component={variant.component}
                fullscreenComponent={variant.fullscreenComponent}
                registryName={selectedBlock.registryName}
                usageCode={variant.usageCode}
                layouts={selectedBlock.layouts}
              />
            ))}
          </div>
        ) : (
          <GettingStarted />
        )}
      </div>
    </div>
  )
}

export default function BlocksPage() {
  return (
    <Suspense
      fallback={<div className="flex min-h-[calc(100vh-3.5rem)] bg-card" />}
    >
      <BlocksContent />
    </Suspense>
  )
}
