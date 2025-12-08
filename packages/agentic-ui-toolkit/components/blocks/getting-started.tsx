'use client'

import Link from 'next/link'
import { CodeBlock } from './code-block'

const REGISTRY_URL = 'https://ui.manifest.build/r/{name}.json'

const categories = [
  {
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
    name: 'Products',
    blocks: [
      { id: 'product-grid', name: 'Product Grid' },
      { id: 'product-carousel', name: 'Product Carousel' },
      { id: 'product-horizontal', name: 'Product Horizontal' },
      { id: 'product-horizontal-grid', name: 'Product Horizontal Grid' },
      {
        id: 'product-horizontal-carousel',
        name: 'Product Horizontal Carousel'
      },
      { id: 'product-picker', name: 'Product Picker' }
    ]
  },
  {
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
    name: 'Status & Progress',
    blocks: [
      { id: 'progress-steps', name: 'Progress Steps' },
      { id: 'status-badges', name: 'Status Badges' }
    ]
  },
  {
    name: 'Lists & Tables',
    blocks: [
      { id: 'table', name: 'Table' },
      { id: 'table-single-select', name: 'Table Single Select' },
      { id: 'table-multi-select', name: 'Table Multi Select' }
    ]
  },
  {
    name: 'Miscellaneous',
    blocks: [
      { id: 'stats-cards', name: 'Stats Cards' },
      { id: 'weather-widget', name: 'Weather Widget' }
    ]
  }
]

export function GettingStarted() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Getting Started</h1>
        <p className="text-muted-foreground mt-2">
          Agentic UI is a block registry for building conversational interfaces.
          These blocks are designed to be displayed within chat interfaces like
          ChatGPT or Claude.
        </p>
      </div>

      {/* Quick Start */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Quick Start</h2>
        <p className="text-sm text-muted-foreground">
          Make sure you have shadcn/ui initialized in your project. If not, run:
        </p>
        <CodeBlock code="npx shadcn@latest init" />
      </section>

      {/* Registry Configuration */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Registry Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Add Manifest UI as a custom registry in your{' '}
          <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
            components.json
          </code>{' '}
          file:
        </p>
        <CodeBlock
          code={`{
  "registries": {
    "@manifest": "${REGISTRY_URL}"
  }
}`}
          language="json"
        />
        <p className="text-sm text-muted-foreground">
          Then install any block from the registry:
        </p>
        <CodeBlock code="npx shadcn@latest add @manifest/inline-card-form" />
      </section>

      {/* Available blocks */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Available blocks</h2>
        <p className="text-sm text-muted-foreground">
          Browse our collection of blocks designed for conversational
          interfaces. Click on any block to see a live preview and get the
          installation command.
        </p>
        <div className="grid gap-4 mt-4">
          {categories.map((category) => (
            <div key={category.name} className="rounded-lg border bg-card p-4">
              <h3 className="font-medium text-sm mb-3">{category.name}</h3>
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
      </section>
    </div>
  )
}
