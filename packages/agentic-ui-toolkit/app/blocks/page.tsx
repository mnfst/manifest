'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronRight, Github } from 'lucide-react'
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
import {
  InlineProductHorizontal,
  InlineProductHorizontalCarousel,
  InlineProductHorizontalGrid
} from '@/registry/inline/inline-product-horizontal'
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
        <Button variant="white" size="sm" disabled={selectedCount === 0}>
          Download
        </Button>
        <Button size="sm" disabled={selectedCount === 0}>
          Send
        </Button>
      </div>
    </div>
  )
}

interface BlockItem {
  id: string
  name: string
  component: React.ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'mobile'
}

interface Category {
  id: string
  name: string
  blocks: BlockItem[]
}

const categories: Category[] = [
  {
    id: 'payment',
    name: 'Payment',
    blocks: [
      {
        id: 'order-confirm',
        name: 'Order Confirmation',
        component: <InlineOrderConfirm />,
        padding: 'none'
      },
      {
        id: 'payment-methods',
        name: 'Payment Methods',
        component: <InlinePaymentMethods />,
        padding: 'sm'
      },
      {
        id: 'card-form',
        name: 'Card Form',
        component: <InlineCardForm />,
        padding: 'none'
      },
      {
        id: 'amount-input',
        name: 'Amount Input',
        component: <InlineAmountInput />,
        padding: 'sm'
      },
      {
        id: 'payment-success',
        name: 'Payment Success',
        component: <InlinePaymentSuccessCompact />,
        padding: 'none'
      },
      {
        id: 'payment-confirmed',
        name: 'Payment Confirmed',
        component: <InlinePaymentConfirmed />,
        padding: 'none'
      }
    ]
  },
  {
    id: 'products',
    name: 'Products',
    blocks: [
      {
        id: 'product-grid',
        name: 'Product Grid',
        component: <InlineProductGrid columns={4} />,
        padding: 'lg'
      },
      {
        id: 'product-carousel',
        name: 'Product Carousel',
        component: <InlineProductCarousel />,
        padding: 'lg'
      },
      {
        id: 'product-horizontal',
        name: 'Product Horizontal',
        component: <InlineProductHorizontal />,
        padding: 'lg'
      },
      {
        id: 'product-horizontal-grid',
        name: 'Product Horizontal Grid',
        component: <InlineProductHorizontalGrid />,
        padding: 'lg'
      },
      {
        id: 'product-horizontal-carousel',
        name: 'Product Horizontal Carousel',
        component: <InlineProductHorizontalCarousel />,
        padding: 'lg'
      },
      {
        id: 'product-picker',
        name: 'Product Picker',
        component: <InlineProductTable />,
        padding: 'mobile'
      }
    ]
  },
  {
    id: 'selection',
    name: 'Selection',
    blocks: [
      {
        id: 'option-list',
        name: 'Option List',
        component: <InlineOptionList />,
        padding: 'lg'
      },
      {
        id: 'card-selection',
        name: 'Card Selection',
        component: <InlineSelectList />,
        padding: 'lg'
      },
      {
        id: 'multi-card-selection',
        name: 'Multi Card Selection',
        component: <InlineSelectList mode="multi" showConfirm />,
        padding: 'lg'
      },
      {
        id: 'tag-selection',
        name: 'Tag Selection',
        component: <InlineTagSelect />,
        padding: 'lg'
      },
      {
        id: 'quick-reply',
        name: 'Quick Reply',
        component: <InlineQuickReply />,
        padding: 'lg'
      }
    ]
  },
  {
    id: 'status',
    name: 'Status & Progress',
    blocks: [
      {
        id: 'progress-steps',
        name: 'Progress Steps',
        component: <InlineProgressSteps />,
        padding: 'lg'
      },
      {
        id: 'status-badges',
        name: 'Status Badges',
        padding: 'lg',
        component: (
          <div className="flex flex-wrap gap-2">
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
    id: 'data',
    name: 'Lists & Tables',
    blocks: [
      {
        id: 'table',
        name: 'Table',
        component: <InlineTable />,
        padding: 'mobile'
      },
      {
        id: 'table-single-select',
        name: 'Table Single Select',
        component: <InlineTable selectable="single" />,
        padding: 'mobile'
      },
      {
        id: 'table-multi-select',
        name: 'Table Multi Select',
        component: <TableMultiSelectWithActions />,
        padding: 'mobile'
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
        component: (
          <div className="space-y-3">
            <InlineMessageBubble
              content="Hey! How are you doing today?"
              avatar="S"
              time="10:30 AM"
            />
            <InlineMessageBubble
              content="I'm doing great, thanks for asking! 😊"
              avatar="Y"
              time="10:31 AM"
              isOwn
              status="read"
            />
          </div>
        ),
        padding: 'lg'
      },
      {
        id: 'image-message',
        name: 'Image Message',
        component: (
          <div className="space-y-3">
            <InlineImageMessageBubble
              image="https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=400&h=300&fit=crop"
              caption="Check out this view!"
              avatar="A"
              time="2:45 PM"
            />
            <InlineImageMessageBubble
              image="https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=400&h=300&fit=crop"
              time="2:46 PM"
              isOwn
              status="delivered"
            />
          </div>
        ),
        padding: 'lg'
      },
      {
        id: 'chat-conversation',
        name: 'Chat Conversation',
        component: <InlineChatConversation />,
        padding: 'none'
      },
      {
        id: 'message-reactions',
        name: 'Message with Reactions',
        component: (
          <div className="space-y-6">
            <InlineMessageWithReactions
              content="We just hit 10,000 users! 🎉"
              avatar="T"
              time="4:20 PM"
              reactions={[
                { emoji: '🎉', count: 5 },
                { emoji: '❤️', count: 3 },
                { emoji: '👏', count: 2 }
              ]}
            />
          </div>
        ),
        padding: 'lg'
      },
      {
        id: 'voice-message',
        name: 'Voice Message',
        component: (
          <div className="space-y-3">
            <InlineVoiceMessageBubble
              duration="0:42"
              avatar="M"
              time="3:15 PM"
            />
            <InlineVoiceMessageBubble
              duration="1:23"
              avatar="Y"
              time="3:17 PM"
              isOwn
              status="read"
            />
          </div>
        ),
        padding: 'lg'
      }
    ]
  },
  {
    id: 'social',
    name: 'Social Posts',
    blocks: [
      {
        id: 'x-post',
        name: 'X Post',
        component: <InlineXPost />,
        padding: 'none'
      },
      {
        id: 'instagram-post',
        name: 'Instagram Post',
        component: <InlineInstagramPost />,
        padding: 'lg'
      },
      {
        id: 'linkedin-post',
        name: 'LinkedIn Post',
        component: <InlineLinkedInPost />,
        padding: 'lg'
      },
      {
        id: 'youtube-post',
        name: 'YouTube Post',
        component: <InlineYouTubePost />,
        padding: 'lg'
      }
    ]
  },
  {
    id: 'misc',
    name: 'Miscellaneous',
    blocks: [
      {
        id: 'stats-cards',
        name: 'Stats Cards',
        component: <InlineStats />,
        padding: 'lg'
      },
      {
        id: 'weather-widget',
        name: 'Weather Widget',
        component: <WeatherWidget />,
        padding: 'none'
      }
    ]
  }
]

const getPaddingClass = (padding?: 'none' | 'sm' | 'md' | 'lg' | 'mobile') => {
  switch (padding) {
    case 'none':
      return ''
    case 'sm':
      return 'p-1 sm:p-2'
    case 'md':
      return 'p-2 sm:p-4'
    case 'mobile':
      return 'p-2 sm:p-0'
    case 'lg':
    default:
      return 'p-2 sm:p-4'
  }
}

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

  // Find the selected block
  const selectedBlock = blockId
    ? categories.flatMap((c) => c.blocks).find((b) => b.id === blockId)
    : null

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-card">
      {/* Sidebar */}
      <aside className="w-56 p-6 overflow-y-auto flex flex-col">
        <nav className="space-y-1 flex-1">
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
                <div className=" mt-0.5 space-y-0 mb-4 ">
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

        {/* Social Links */}
        <div className="pt-6 border-t mt-6">
          <div className="flex items-center gap-1 flex-wrap">
            <Link
              href="https://github.com/mnfst/manifest"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-foreground/60 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
            >
              <Github className="h-4 w-4" />
            </Link>
            <Link
              href="https://discord.gg/manifest"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-foreground/60 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
            >
              <DiscordIcon className="h-4 w-4" />
            </Link>
            <Link
              href="https://x.com/AiManifest"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-foreground/60 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
            >
              <XIcon className="h-4 w-4" />
            </Link>
            <Link
              href="https://linkedin.com/company/mnfst"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-foreground/60 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
            >
              <LinkedInIcon className="h-4 w-4" />
            </Link>
            <Link
              href="https://instagram.com/manifest"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-foreground/60 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
            >
              <InstagramIcon className="h-4 w-4" />
            </Link>
            <Link
              href="https://tiktok.com/@manifest"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-foreground/60 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
            >
              <TikTokIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 p-8 bg-muted/50">
        {selectedBlock ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold">{selectedBlock.name}</h1>
              <p className="text-muted-foreground mt-1">
                Preview of the {selectedBlock.name} component
              </p>
            </div>
            <div
              className={cn(
                'rounded-lg  bg-card ',
                getPaddingClass(selectedBlock.padding)
              )}
            >
              {selectedBlock.component}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold">Blocks</h1>
            <p className="text-muted-foreground mt-1">
              Select a block from the sidebar to preview it.
            </p>
            <div className="mt-8 grid gap-4">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-lg border bg-card p-4"
                >
                  <h2 className="font-semibold mb-2">{category.name}</h2>
                  <div className="flex flex-wrap gap-2">
                    {category.blocks.map((block) => (
                      <Link
                        key={block.id}
                        href={`/blocks?block=${block.id}`}
                        className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-muted/80 transition-colors"
                      >
                        {block.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
