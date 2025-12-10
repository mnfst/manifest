'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  )
}

// Components imports
import { InlineAmountInput } from '@/registry/inline/inline-amount-input'
import { PostDetail } from '@/registry/inline/post-detail'
import { InlineBlogPostList } from '@/registry/inline/inline-blog-post-list'
import { InlineBlogPostCard } from '@/registry/inline/inline-blog-post-card'
import { InlineCardForm } from '@/registry/inline/inline-card-form'
import {
  InlineChatConversation,
  InlineImageMessageBubble,
  InlineMessageBubble,
  InlineMessageWithReactions,
  InlineVoiceMessageBubble
} from '@/registry/inline/inline-message-bubble'
import { InlineOptionList } from '@/registry/inline/inline-option-list'
import { InlineOrderConfirm } from '@/registry/inline/inline-order-confirm'
import { InlinePaymentConfirmed } from '@/registry/inline/inline-payment-confirmed'
import { InlinePaymentMethods } from '@/registry/inline/inline-payment-methods'
import { InlinePaymentSuccessCompact } from '@/registry/inline/inline-payment-success-compact'
import { InlineProductCarousel } from '@/registry/inline/inline-product-carousel'
import { InlineProductGrid } from '@/registry/inline/inline-product-grid'
import { InlineProductHorizontal } from '@/registry/inline/inline-product-horizontal'
import { InlineProductTable } from '@/registry/inline/inline-product-table'
import { InlineProgressSteps } from '@/registry/inline/inline-progress-steps'
import { InlineQuickReply } from '@/registry/inline/inline-quick-reply'
import { InlineSelectList } from '@/registry/inline/inline-select-list'
import {
  InlineInstagramPost,
  InlineLinkedInPost,
  InlineXPost,
  InlineYouTubePost
} from '@/registry/inline/inline-social-cards'
import { InlineStats } from '@/registry/inline/inline-stat-card'
import { InlineStatusBadge } from '@/registry/inline/inline-status-badge'
import { InlineTable } from '@/registry/inline/inline-table'
import { InlineTagSelect } from '@/registry/inline/inline-tag-select'
import { WeatherWidget } from '@/registry/misc/weather-widget/weather-widget'

// UI components
import { GettingStarted } from '@/components/blocks/getting-started'
import { VariantSection } from '@/components/blocks/variant-section'

// Wrapper component for Table Multi Select with action buttons
function TableMultiSelectWithActions() {
  const [selectedCount, setSelectedCount] = useState(0)

  return (
    <div>
      <InlineTable
        selectable="multi"
        onSelectionChange={(rows) => setSelectedCount(rows.length)}
      />
      <div className="flex justify-end gap-2 p-3">
        <Button variant="outline" size="sm" disabled={selectedCount === 0}>
          Download
        </Button>
        <Button size="sm" disabled={selectedCount === 0}>
          Send
        </Button>
      </div>
    </div>
  )
}

// Types for the new structure
interface BlockVariant {
  id: string
  name: string
  component: React.ReactNode
  usageCode?: string
}

interface BlockGroup {
  id: string
  name: string
  description: string
  registryName: string
  variants: BlockVariant[]
}

interface Category {
  id: string
  name: string
  blocks: BlockGroup[]
}

const categories: Category[] = [
  {
    id: 'blog',
    name: 'Blogging',
    blocks: [
      {
        id: 'post-card',
        name: 'Post Card',
        description: 'Display blog posts with various layouts and styles',
        registryName: 'inline-blog-post-card',
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <InlineBlogPostCard />,
            usageCode: `<InlineBlogPostCard />`
          },
          {
            id: 'no-image',
            name: 'Without Image',
            component: <InlineBlogPostCard showImage={false} />,
            usageCode: `<InlineBlogPostCard showImage={false} />`
          },
          {
            id: 'compact',
            name: 'Compact',
            component: <InlineBlogPostCard variant="compact" />,
            usageCode: `<InlineBlogPostCard variant="compact" />`
          },
          {
            id: 'horizontal',
            name: 'Horizontal',
            component: <InlineBlogPostCard variant="horizontal" />,
            usageCode: `<InlineBlogPostCard variant="horizontal" />`
          },
          {
            id: 'covered',
            name: 'Covered',
            component: <InlineBlogPostCard variant="covered" />,
            usageCode: `<InlineBlogPostCard variant="covered" />`
          }
        ]
      },
      {
        id: 'post-list',
        name: 'Post List',
        description: 'Display multiple posts in various layouts',
        registryName: 'inline-blog-post-list',
        variants: [
          {
            id: 'list',
            name: 'List',
            component: <InlineBlogPostList variant="list" />,
            usageCode: `<InlineBlogPostList variant="list" />`
          },
          {
            id: 'grid',
            name: 'Grid',
            component: <InlineBlogPostList variant="grid" />,
            usageCode: `<InlineBlogPostList variant="grid" />`
          },
          {
            id: 'carousel',
            name: 'Carousel',
            component: <InlineBlogPostList variant="carousel" />,
            usageCode: `<InlineBlogPostList variant="carousel" />`
          }
        ]
      },
      {
        id: 'post-detail',
        name: 'Post Detail',
        description: 'Full post view with cover and content',
        registryName: 'post-detail',
        variants: [
          {
            id: 'default',
            name: 'With Cover',
            component: <PostDetail />,
            usageCode: `<PostDetail />`
          },
          {
            id: 'no-cover',
            name: 'Without Cover',
            component: <PostDetail showCover={false} />,
            usageCode: `<PostDetail showCover={false} />`
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
        id: 'table',
        name: 'Table',
        description: 'Data table with optional selection',
        registryName: 'inline-table',
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <InlineTable />,
            usageCode: `<InlineTable />`
          },
          {
            id: 'single-select',
            name: 'Single Select',
            component: <InlineTable selectable="single" />,
            usageCode: `<InlineTable selectable="single" />`
          },
          {
            id: 'multi-select',
            name: 'Multi Select',
            component: <TableMultiSelectWithActions />,
            usageCode: `const [selectedCount, setSelectedCount] = useState(0)

<div>
  <InlineTable
    selectable="multi"
    onSelectionChange={(rows) => setSelectedCount(rows.length)}
  />
  <div className="flex justify-end gap-2 p-3">
    <Button variant="outline" size="sm" disabled={selectedCount === 0}>
      Download
    </Button>
    <Button size="sm" disabled={selectedCount === 0}>
      Send
    </Button>
  </div>
</div>`
          }
        ]
      },
      {
        id: 'product-list',
        name: 'Product List',
        description: 'Display products in various layouts',
        registryName: 'inline-product-grid',
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <InlineProductHorizontal />,
            usageCode: `<InlineProductHorizontal />`
          },
          {
            id: 'grid',
            name: 'Grid',
            component: <InlineProductGrid columns={4} />,
            usageCode: `<InlineProductGrid columns={4} />`
          },
          {
            id: 'carousel',
            name: 'Carousel',
            component: <InlineProductCarousel />,
            usageCode: `<InlineProductCarousel />`
          },
          {
            id: 'picker',
            name: 'Picker',
            component: <InlineProductTable />,
            usageCode: `<InlineProductTable />`
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
        registryName: 'inline-order-confirm',
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <InlineOrderConfirm />
          }
        ]
      },
      {
        id: 'payment-methods',
        name: 'Payment Methods',
        description: 'Select payment method',
        registryName: 'inline-payment-methods',
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <InlinePaymentMethods />
          }
        ]
      },
      {
        id: 'card-form',
        name: 'Bank Card Form',
        description: 'Credit card input form',
        registryName: 'inline-card-form',
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <InlineCardForm />
          }
        ]
      },
      {
        id: 'amount-input',
        name: 'Amount Input',
        description: 'Input for monetary amounts',
        registryName: 'inline-amount-input',
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <InlineAmountInput />
          }
        ]
      },
      {
        id: 'payment-success',
        name: 'Payment Success',
        description: 'Success confirmation after payment',
        registryName: 'inline-payment-success',
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <InlinePaymentSuccessCompact />
          }
        ]
      },
      {
        id: 'payment-confirmed',
        name: 'Payment Confirmation',
        description: 'Detailed payment confirmation',
        registryName: 'inline-payment-confirmed',
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <InlinePaymentConfirmed />
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
        registryName: 'inline-message-bubble',
        variants: [
          {
            id: 'default',
            name: 'Text Messages',
            component: (
              <div className="space-y-3">
                <InlineMessageBubble
                  content="Hey! How are you doing today?"
                  avatar="S"
                  time="Dec 8, 10:30 AM"
                />
                <InlineMessageBubble
                  content="I'm doing great, thanks for asking!"
                  avatar="Y"
                  time="Dec 8, 10:31 AM"
                  isOwn
                  status="read"
                />
              </div>
            )
          },
          {
            id: 'image',
            name: 'Image Messages',
            component: (
              <div className="space-y-3">
                <InlineImageMessageBubble
                  image="https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=400&h=300&fit=crop"
                  caption="Check out this view!"
                  avatar="A"
                  time="Dec 8, 2:45 PM"
                />
                <InlineImageMessageBubble
                  image="https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=400&h=300&fit=crop"
                  time="Dec 8, 2:46 PM"
                  isOwn
                  status="delivered"
                />
              </div>
            )
          },
          {
            id: 'reactions',
            name: 'With Reactions',
            component: (
              <InlineMessageWithReactions
                content="We just hit 10,000 users!"
                avatar="T"
                time="Dec 8, 4:20 PM"
                reactions={[
                  { emoji: '🎉', count: 5 },
                  { emoji: '❤️', count: 3 },
                  { emoji: '👏', count: 2 }
                ]}
              />
            )
          },
          {
            id: 'voice',
            name: 'Voice Messages',
            component: (
              <div className="space-y-3">
                <InlineVoiceMessageBubble
                  duration="0:42"
                  avatar="M"
                  time="Dec 8, 3:15 PM"
                />
                <InlineVoiceMessageBubble
                  duration="1:23"
                  avatar="Y"
                  time="Dec 8, 3:17 PM"
                  isOwn
                  status="read"
                />
              </div>
            )
          }
        ]
      },
      {
        id: 'chat-conversation',
        name: 'Chat Conversation',
        description: 'Full chat conversation view',
        registryName: 'inline-message-bubble',
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <InlineChatConversation />
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
        id: 'selection',
        name: 'Selection',
        description: 'Various selection interfaces for user input',
        registryName: 'inline-select-list',
        variants: [
          {
            id: 'option-list',
            name: 'Option List',
            component: <InlineOptionList />
          },
          {
            id: 'card-selection',
            name: 'Card Selection',
            component: <InlineSelectList mode="multi" showConfirm />
          },
          {
            id: 'tag-selection',
            name: 'Tag Selection',
            component: <InlineTagSelect />
          },
          {
            id: 'quick-reply',
            name: 'Quick Reply',
            component: <InlineQuickReply />
          }
        ]
      },
      {
        id: 'social-posts',
        name: 'Social Cards',
        description: 'Social media post cards',
        registryName: 'inline-social-cards',
        variants: [
          {
            id: 'x',
            name: 'X (Twitter)',
            component: <InlineXPost />
          },
          {
            id: 'instagram',
            name: 'Instagram',
            component: <InlineInstagramPost />
          },
          {
            id: 'linkedin',
            name: 'LinkedIn',
            component: <InlineLinkedInPost />
          },
          {
            id: 'youtube',
            name: 'YouTube',
            component: <InlineYouTubePost />
          }
        ]
      },
      {
        id: 'status-badges',
        name: 'Status Badge',
        description: 'Various status indicators',
        registryName: 'inline-status-badge',
        variants: [
          {
            id: 'default',
            name: 'All Statuses',
            component: (
              <div className="flex flex-wrap gap-2 bg-white dark:bg-zinc-900 p-4 rounded-md">
                <InlineStatusBadge status="success" />
                <InlineStatusBadge status="pending" />
                <InlineStatusBadge status="processing" />
                <InlineStatusBadge status="shipped" />
                <InlineStatusBadge status="delivered" />
                <InlineStatusBadge status="error" />
              </div>
            )
          }
        ]
      },
      {
        id: 'progress-steps',
        name: 'Progress Steps',
        description: 'Step-by-step progress indicator',
        registryName: 'inline-progress-steps',
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <InlineProgressSteps />
          }
        ]
      },
      {
        id: 'stats-cards',
        name: 'Stats Cards',
        description: 'Display statistics and metrics',
        registryName: 'inline-stats',
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <InlineStats />
          }
        ]
      },
      {
        id: 'weather-widget',
        name: 'Weather Widget',
        description: 'Weather information display',
        registryName: 'weather-widget',
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <WeatherWidget />
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
              <h1 className="text-2xl font-bold">{selectedBlock.name}</h1>
              <p className="text-muted-foreground mt-1">
                {selectedBlock.description}
              </p>
            </div>

            {/* All Variants */}
            {selectedBlock.variants.map((variant) => (
              <VariantSection
                key={variant.id}
                name={variant.name}
                component={variant.component}
                registryName={selectedBlock.registryName}
                usageCode={variant.usageCode}
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
