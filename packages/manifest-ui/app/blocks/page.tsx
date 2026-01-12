'use client'

import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

// UI components
import { GettingStarted } from '@/components/blocks/getting-started'

// SEO components
import { Breadcrumb } from '@/components/seo/breadcrumb'

// Sidebar navigation data
interface Block {
  id: string
  name: string
}

interface Category {
  id: string
  name: string
  blocks: Block[]
}

const categories: Category[] = [
  {
    id: 'blog',
    name: 'Blogging',
    blocks: [
      { id: 'post-card', name: 'Post Card' },
      { id: 'post-list', name: 'Post List' }
    ]
  },
  {
    id: 'events',
    name: 'Events',
    blocks: [
      { id: 'event-card', name: 'Event Card' },
      { id: 'event-list', name: 'Event List' }
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
    name: 'List',
    blocks: [
      { id: 'product-list', name: 'Product List' },
      { id: 'table', name: 'Table' }
    ]
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
      { id: 'message-bubble', name: 'Message Bubble' },
      { id: 'chat-conversation', name: 'Chat Conversation' }
    ]
  },
  {
    id: 'misc',
    name: 'Miscellaneous',
    blocks: [
      { id: 'option-list', name: 'Option List' },
      { id: 'progress-steps', name: 'Progress Steps' },
      { id: 'quick-reply', name: 'Quick Reply' },
      { id: 'stats', name: 'Stats Cards' },
      { id: 'status-badge', name: 'Status Badge' },
      { id: 'tag-select', name: 'Tag Select' }
    ]
  },
  {
    id: 'payment',
    name: 'Payment',
    blocks: [
      { id: 'order-confirm', name: 'Order Confirmation' },
      { id: 'payment-methods', name: 'Payment Methods' },
      { id: 'bank-card-form', name: 'Bank Card Form' },
      { id: 'amount-input', name: 'Amount Input' },
      { id: 'payment-success', name: 'Payment Success' },
      { id: 'payment-confirmed', name: 'Payment Confirmation' }
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
  }
]

export default function BlocksPage() {
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

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-card">
      {/* Sidebar */}
      <aside className="hidden md:block w-[226px] shrink-0 p-6 overflow-y-auto">
        <nav className="space-y-1">
          <Link
            href="/blocks"
            className="block text-xs font-medium rounded-sm transition-colors py-1 px-2 mb-2 bg-muted text-foreground"
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
                      href={`/blocks/${category.id}/${block.id}`}
                      className="block my-1 text-xs rounded-sm transition-colors py-1 px-2 text-foreground/70 hover:text-foreground hover:bg-muted/50"
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
        <div className="max-w-3xl mx-auto">
          <Breadcrumb items={[{ name: 'Blocks' }]} />
          <GettingStarted />
        </div>
      </div>
    </div>
  )
}
