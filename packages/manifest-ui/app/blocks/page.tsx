'use client'

import { cn } from '@/lib/utils'
import { blockCategories } from '@/lib/blocks-categories'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

// UI components
import { GettingStarted } from '@/components/blocks/getting-started'

// SEO components
import { Breadcrumb } from '@/components/seo/breadcrumb'

export default function BlocksPage() {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    blockCategories.map((c) => c.id)
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
          {blockCategories.map((category) => (
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
