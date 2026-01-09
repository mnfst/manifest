import { MetadataRoute } from 'next'
import { blockCategories } from '@/lib/blocks-categories'

/**
 * Dynamic sitemap generation for Manifest UI
 *
 * This sitemap is automatically served at /sitemap.xml
 * and helps search engines discover and index all pages.
 *
 * Block URLs are dynamically generated from the blockCategories
 * configuration to ensure the sitemap stays in sync with available blocks.
 *
 * Priority levels:
 * - 1.0: Homepage (most important)
 * - 0.9: Main feature pages (blocks gallery)
 * - 0.8: Individual block pages
 *
 * Change frequency:
 * - weekly: Pages that are regularly updated with new content
 * - monthly: Pages that change less frequently
 */

const BASE_URL = 'https://ui.manifest.build'

export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/blocks`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ]

  // Dynamic block pages generated from blockCategories
  const blockPages: MetadataRoute.Sitemap = blockCategories.flatMap((category) =>
    category.blocks.map((block) => ({
      url: `${BASE_URL}/blocks/${category.id}/${block.id}`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }))
  )

  return [...staticPages, ...blockPages]
}
