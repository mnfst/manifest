'use client'

import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

// Components imports
import { InlineAmountInput } from '@/registry/inline/inline-amount-input'
import { InlineCardForm } from '@/registry/inline/inline-card-form'
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
import { InlineStats } from '@/registry/inline/inline-stat-card'
import { InlineStatusBadge } from '@/registry/inline/inline-status-badge'
import { InlineTable } from '@/registry/inline/inline-table'
import { InlineTagSelect } from '@/registry/inline/inline-tag-select'
import { WeatherWidget } from '@/registry/misc/weather-widget/weather-widget'

interface BlockItem {
  id: string
  name: string
  component: React.ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
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
        id: 'product-table',
        name: 'Product Picker',
        component: <InlineProductTable />,
        padding: 'none'
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
        id: 'select-list',
        name: 'Card Selection',
        component: <InlineSelectList />,
        padding: 'lg'
      },
      {
        id: 'select-list-multi',
        name: 'Multi Card Selection',
        component: <InlineSelectList mode="multi" showConfirm />,
        padding: 'lg'
      },
      {
        id: 'tag-select',
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
        padding: 'none'
      },
      {
        id: 'table-selectable',
        name: 'Select List',
        component: <InlineTable selectable="single" />,
        padding: 'none'
      },
      {
        id: 'table-multi-select',
        name: 'Multi Select List',
        component: <InlineTable selectable="multi" />,
        padding: 'none'
      }
    ]
  },
  {
    id: 'misc',
    name: 'Miscellaneous',
    blocks: [
      {
        id: 'stats',
        name: 'Stats Cards',
        component: <InlineStats />,
        padding: 'lg'
      },
      {
        id: 'weather',
        name: 'Weather Widget',
        component: <WeatherWidget />,
        padding: 'none'
      }
    ]
  }
]

export default function BlocksPage() {
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

  const getPaddingClass = (padding?: 'none' | 'sm' | 'md' | 'lg') => {
    switch (padding) {
      case 'none':
        return ''
      case 'sm':
        return 'p-1 sm:p-2'
      case 'md':
        return 'p-2 sm:p-4'
      case 'lg':
      default:
        return 'p-2 sm:p-6'
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-card">
      {/* Sidebar */}
      <aside className="w-56 p-6 overflow-y-auto">
        <nav className="space-y-1">
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
      </aside>

      {/* Main content */}
      <div className="flex-1 p-8">
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
                'rounded-lg border bg-card shadow-block',
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
