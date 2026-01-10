'use client'

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  name: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  baseUrl?: string
}

/**
 * SEO-friendly Breadcrumb component with JSON-LD structured data
 * Automatically generates BreadcrumbList schema for search engines
 */
export function Breadcrumb({ items, baseUrl = 'https://ui.manifest.build' }: BreadcrumbProps) {
  // Build full items array including Home
  const fullItems: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    ...items
  ]

  // Generate JSON-LD structured data
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: fullItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      // Last item doesn't need an item URL (it's the current page)
      ...(item.href && index < fullItems.length - 1
        ? { item: `${baseUrl}${item.href}` }
        : item.href
          ? { item: `${baseUrl}${item.href}` }
          : {})
    }))
  }

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Visual Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-1 text-sm text-muted-foreground">
          {fullItems.map((item, index) => (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              )}
              {item.href && index < fullItems.length - 1 ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {index === 0 && <Home className="h-3.5 w-3.5" />}
                  <span>{item.name}</span>
                </Link>
              ) : (
                <span className="flex items-center gap-1 text-foreground font-medium">
                  {index === 0 && <Home className="h-3.5 w-3.5" />}
                  <span>{item.name}</span>
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}

/**
 * Helper function to generate breadcrumb items for block pages
 * Use this for automatic breadcrumb generation based on category and block
 */
export function generateBlockBreadcrumbs(
  categoryId?: string,
  categoryName?: string,
  blockName?: string
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { name: 'Blocks', href: '/blocks' }
  ]

  if (categoryId && categoryName) {
    // Category is not linkable since we don't have category-only pages
    // But we include it in the trail for context
    items.push({ name: categoryName })
  }

  if (blockName) {
    // Block name is the current page (no href needed)
    // Replace the category item to include the block
    if (categoryId && categoryName) {
      items.pop() // Remove category without href
      items.push({ name: categoryName }) // Re-add category (could link to /blocks with filter in future)
    }
    items.push({ name: blockName })
  }

  return items
}
