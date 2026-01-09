import { MetadataRoute } from 'next'

/**
 * Dynamic sitemap generation for Manifest UI
 *
 * This sitemap is automatically served at /sitemap.xml
 * and helps search engines discover and index all pages.
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

// Block IDs from the blocks page - these are the available component demos
const BLOCK_IDS = [
  'post-card',
  'post-list',
  'contact-form',
  'date-time-picker',
  'issue-report-form',
  'product-list',
  'table',
  'map-carousel',
  'message-bubble',
  'chat-conversation',
  'option-list',
  'progress-steps',
  'quick-reply',
  'stats-cards',
  'status-badges',
  'tag-select',
  'order-confirm',
  'payment-methods',
  'card-form',
  'amount-input',
  'payment-success',
  'payment-confirmed',
  'instagram-post',
  'linkedin-post',
  'x-post',
  'youtube-post',
]

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

  // Dynamic block pages (query parameter based)
  // Note: While these use query params, they represent distinct content
  // Search engines can index these as separate pages
  const blockPages: MetadataRoute.Sitemap = BLOCK_IDS.map((blockId) => ({
    url: `${BASE_URL}/blocks?block=${blockId}`,
    lastModified: currentDate,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...blockPages]
}
