'use client'

import { ArrowRight } from 'lucide-react'
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
          Make sure you have shadcn/ui initialized in your project. If not, see{' '}
          <a
            href="https://ui.shadcn.com/docs/installation"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-primary"
          >
            the shadcn/ui installation guide
          </a>
          .
        </p>
      </section>

      {/* Registry Configuration */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Using a block</h2>
        <p className="text-sm text-muted-foreground">
          Simply browser to the block you want to use and run the provided
          command to add it to your project. For example, to add the Table
          block:
        </p>
        <CodeBlock code="npx shadcn@latest add @manifest/table" />
      </section>

      {/* Next Step */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-lg font-semibold">Next Step</h2>
        <Link
          href="/blocks?block=order-confirm"
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          Explore blocks
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  )
}
