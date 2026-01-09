import { MetadataRoute } from 'next'

/**
 * Robots.txt configuration for Manifest UI
 *
 * This file controls how search engine crawlers interact with the site.
 * It's automatically served at /robots.txt
 *
 * Current policy:
 * - Allow all crawlers to access all public pages
 * - Point crawlers to the sitemap for efficient discovery
 * - No pages are blocked (all content is public)
 */

const BASE_URL = 'https://ui.manifest.build'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Optionally disallow specific paths:
        // disallow: ['/api/', '/private/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    // Optional: Add host for some crawlers that support it
    host: BASE_URL,
  }
}
