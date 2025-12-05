'use client'

import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'

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
import { InlineProgressSteps } from '@/registry/inline/inline-progress-steps'
import { InlineQuickReply } from '@/registry/inline/inline-quick-reply'
import { InlineStats } from '@/registry/inline/inline-stat-card'
import { InlineStatusBadge } from '@/registry/inline/inline-status-badge'
import { InlineTagSelect } from '@/registry/inline/inline-tag-select'
import { WeatherWidget } from '@/registry/misc/weather-widget/weather-widget'

// UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GettingStarted } from '@/components/blocks/getting-started'
import { InstallCommands } from '@/components/blocks/install-commands'
import { CodeBlock } from '@/components/blocks/code-block'

interface BlockItem {
  id: string
  name: string
  component: React.ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
  registryName?: string // Name in the registry for install command
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
        padding: 'none',
        registryName: 'inline-order-confirm'
      },
      {
        id: 'payment-methods',
        name: 'Payment Methods',
        component: <InlinePaymentMethods />,
        padding: 'sm',
        registryName: 'inline-payment-methods'
      },
      {
        id: 'card-form',
        name: 'Card Form',
        component: <InlineCardForm />,
        padding: 'none',
        registryName: 'inline-card-form'
      },
      {
        id: 'amount-input',
        name: 'Amount Input',
        component: <InlineAmountInput />,
        padding: 'sm',
        registryName: 'inline-amount-input'
      },
      {
        id: 'payment-success',
        name: 'Payment Success',
        component: <InlinePaymentSuccessCompact />,
        padding: 'none',
        registryName: 'inline-payment-success'
      },
      {
        id: 'payment-confirmed',
        name: 'Payment Confirmed',
        component: <InlinePaymentConfirmed />,
        padding: 'none',
        registryName: 'inline-payment-confirmed'
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
        padding: 'lg',
        registryName: 'inline-product-grid'
      },
      {
        id: 'product-carousel',
        name: 'Product Carousel',
        component: <InlineProductCarousel />,
        padding: 'lg',
        registryName: 'inline-product-carousel'
      },
      {
        id: 'product-horizontal',
        name: 'Product Horizontal',
        component: <InlineProductHorizontal />,
        padding: 'lg',
        registryName: 'inline-product-horizontal'
      },
      {
        id: 'product-horizontal-grid',
        name: 'Product Horizontal Grid',
        component: <InlineProductHorizontalGrid />,
        padding: 'lg',
        registryName: 'inline-product-horizontal-grid'
      },
      {
        id: 'product-horizontal-carousel',
        name: 'Product Horizontal Carousel',
        component: <InlineProductHorizontalCarousel />,
        padding: 'lg',
        registryName: 'inline-product-horizontal-carousel'
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
        padding: 'lg',
        registryName: 'inline-option-list'
      },
      {
        id: 'tag-select',
        name: 'Tag Select',
        component: <InlineTagSelect />,
        padding: 'lg',
        registryName: 'inline-tag-select'
      },
      {
        id: 'quick-reply',
        name: 'Quick Reply',
        component: <InlineQuickReply />,
        padding: 'lg',
        registryName: 'inline-quick-reply'
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
        padding: 'lg',
        registryName: 'inline-progress-steps'
      },
      {
        id: 'status-badges',
        name: 'Status Badges',
        padding: 'lg',
        registryName: 'inline-status-badge',
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
    id: 'charts',
    name: 'Charts & Stats',
    blocks: [
      {
        id: 'stats',
        name: 'Stats Cards',
        component: <InlineStats />,
        padding: 'lg',
        registryName: 'inline-stats'
      }
    ]
  },
  {
    id: 'misc',
    name: 'Miscellaneous',
    blocks: [
      {
        id: 'weather',
        name: 'Weather Widget',
        component: <WeatherWidget />,
        padding: 'none',
        registryName: 'weather-widget'
      }
    ]
  }
]

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

function CodeViewer({ registryName }: { registryName: string }) {
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCode() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/r/${registryName}.json`)
        if (!response.ok) {
          throw new Error('Failed to fetch component')
        }
        const data = await response.json()
        const content = data.files?.[0]?.content
        if (content) {
          setCode(content)
        } else {
          setError('No source code available')
        }
      } catch {
        setError('Failed to load source code')
      } finally {
        setLoading(false)
      }
    }
    fetchCode()
  }, [registryName])

  if (loading) {
    return (
      <div className="rounded-lg bg-muted p-4 animate-pulse">
        <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2" />
        <div className="h-4 bg-muted-foreground/20 rounded w-1/2 mb-2" />
        <div className="h-4 bg-muted-foreground/20 rounded w-2/3" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-muted p-4 text-muted-foreground text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="max-h-[500px] overflow-y-auto rounded-lg">
      <CodeBlock code={code || ''} language="tsx" />
    </div>
  )
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
      <aside className="w-56 p-6 overflow-y-auto">
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

            {/* Install Commands */}
            {selectedBlock.registryName && (
              <InstallCommands componentName={selectedBlock.registryName} />
            )}

            {/* Preview / Code Tabs */}
            <Tabs defaultValue="preview" className="w-full">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="code">Code</TabsTrigger>
              </TabsList>
              <TabsContent value="preview">
                <div
                  className={cn(
                    'rounded-lg border bg-card shadow-block',
                    getPaddingClass(selectedBlock.padding)
                  )}
                >
                  {selectedBlock.component}
                </div>
              </TabsContent>
              <TabsContent value="code">
                {selectedBlock.registryName ? (
                  <CodeViewer registryName={selectedBlock.registryName} />
                ) : (
                  <div className="rounded-lg bg-muted p-4 text-muted-foreground text-sm">
                    No source code available for this component
                  </div>
                )}
              </TabsContent>
            </Tabs>
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
    <Suspense fallback={<div className="flex min-h-[calc(100vh-3.5rem)] bg-card" />}>
      <BlocksContent />
    </Suspense>
  )
}
