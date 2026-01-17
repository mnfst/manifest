/**
 * Local Assets Test
 *
 * This test ensures that all image assets are stored locally in the repository
 * and no external URLs (Unsplash, Pravatar, etc.) are used in the codebase.
 *
 * Why this matters:
 * - External assets can be removed or changed without notice
 * - External services can become unavailable, breaking the application
 * - Local assets ensure consistent, reliable behavior
 *
 * Allowed patterns:
 * - Local paths: /demo/*, /images/*, /previews/*, /favicon.*, /logo*, /og-*
 * - Relative paths: ./*, ../*
 * - Data URLs: data:image/*
 * - Example URLs in JSDoc comments: https://example.com/*
 *
 * Forbidden patterns:
 * - External image hosts: images.unsplash.com, i.pravatar.cc, etc.
 * - Any external URL in actual code/data (not comments)
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { describe, it, expect } from 'vitest'

const ROOT_PATH = resolve(__dirname, '..')

/**
 * External domains that should NOT be used for assets
 */
const FORBIDDEN_DOMAINS = [
  'images.unsplash.com',
  'i.pravatar.cc',
  'pravatar.cc',
  'unsplash.com',
  'picsum.photos',
  'placeholder.com',
  'placekitten.com',
  'placehold.it',
  'placeimg.com',
  'lorempixel.com',
  'dummyimage.com',
  'via.placeholder.com',
  'source.unsplash.com',
  'loremflickr.com',
  'cloudinary.com/demo',
  'res.cloudinary.com',
  'imgix.net',
]

/**
 * Patterns to match external image URLs
 * These regex patterns will catch URLs that reference external image services
 */
const FORBIDDEN_URL_PATTERNS = FORBIDDEN_DOMAINS.map(
  (domain) => new RegExp(`https?://[^'"\\s]*${domain.replace(/\./g, '\\.')}[^'"\\s]*`, 'gi')
)

/**
 * Directories to scan for external URLs
 */
const SCAN_DIRECTORIES = ['registry', 'app', 'lib', 'components']

/**
 * File extensions to check
 */
const FILE_EXTENSIONS = ['.tsx', '.ts', '.js', '.jsx']

/**
 * Recursively get all source files in a directory
 */
function getAllSourceFiles(dir: string): string[] {
  const files: string[] = []

  if (!existsSync(dir)) return files

  const entries = readdirSync(dir)

  for (const entry of entries) {
    // Skip node_modules and hidden directories
    if (entry === 'node_modules' || entry.startsWith('.')) continue

    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getAllSourceFiles(fullPath))
    } else if (FILE_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Check if a line is a JSDoc comment or regular comment
 */
function isCommentLine(line: string): boolean {
  const trimmed = line.trim()
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('/**')
  )
}

/**
 * Check if a URL is allowed (example.com URLs in comments are allowed)
 */
function isAllowedUrl(url: string, line: string): boolean {
  // Allow example.com URLs (documentation purposes)
  if (url.includes('example.com')) {
    return true
  }

  // Allow if it's in a comment line
  if (isCommentLine(line)) {
    return true
  }

  return false
}

/**
 * Find all external asset URLs in a file
 */
function findExternalAssetUrls(
  filePath: string
): { line: number; url: string; content: string }[] {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const externalUrls: { line: number; url: string; content: string }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    for (const pattern of FORBIDDEN_URL_PATTERNS) {
      // Reset regex state for each line
      pattern.lastIndex = 0

      let match
      while ((match = pattern.exec(line)) !== null) {
        const url = match[0]

        // Skip if it's an allowed URL pattern
        if (!isAllowedUrl(url, line)) {
          externalUrls.push({
            line: i + 1,
            url: url,
            content: line.trim(),
          })
        }
      }
    }
  }

  return externalUrls
}

describe('Local Asset Storage', () => {
  // Collect all source files
  const allFiles: string[] = []
  for (const dir of SCAN_DIRECTORIES) {
    const dirPath = join(ROOT_PATH, dir)
    allFiles.push(...getAllSourceFiles(dirPath))
  }

  it('should find source files to scan', () => {
    expect(allFiles.length).toBeGreaterThan(0)
  })

  describe('No external asset URLs in source files', () => {
    // Group files by directory for cleaner test output
    const filesByDir: Record<string, string[]> = {}

    for (const file of allFiles) {
      const relativePath = file.replace(ROOT_PATH + '/', '')
      const dir = relativePath.split('/')[0]
      if (!filesByDir[dir]) filesByDir[dir] = []
      filesByDir[dir].push(file)
    }

    for (const [dir, files] of Object.entries(filesByDir)) {
      describe(`${dir}/ directory`, () => {
        for (const filePath of files) {
          const relativePath = filePath.replace(ROOT_PATH + '/', '')

          it(`${relativePath} should not have external asset URLs`, () => {
            const externalUrls = findExternalAssetUrls(filePath)

            if (externalUrls.length > 0) {
              const errorMessage = [
                `File "${relativePath}" contains external asset URLs!`,
                '',
                'Found external URLs:',
                ...externalUrls.map(
                  ({ line, url }) => `  Line ${line}: ${url}`
                ),
                '',
                'Why this is a problem:',
                '  - External assets can disappear or change without notice',
                '  - External services can become unavailable',
                '  - This breaks the application for users',
                '',
                'How to fix:',
                '  1. Download the image locally to public/demo/images/ or public/demo/avatars/',
                '  2. Update the URL to use the local path (e.g., "/demo/images/my-image.jpg")',
                '  3. Run "node scripts/download-assets.mjs" to download all external assets',
                '',
                'Local asset locations:',
                '  - Content images: /public/demo/images/',
                '  - Avatar images: /public/demo/avatars/',
                '  - Product images: /public/demo/',
              ].join('\n')

              throw new Error(errorMessage)
            }

            expect(externalUrls).toHaveLength(0)
          })
        }
      })
    }
  })

  it('should provide a summary of all external URLs found', () => {
    const allExternalUrls: {
      file: string
      urls: { line: number; url: string }[]
    }[] = []

    for (const file of allFiles) {
      const externalUrls = findExternalAssetUrls(file)
      if (externalUrls.length > 0) {
        allExternalUrls.push({
          file: file.replace(ROOT_PATH + '/', ''),
          urls: externalUrls.map(({ line, url }) => ({ line, url })),
        })
      }
    }

    if (allExternalUrls.length > 0) {
      console.log('\n=== External Asset URLs Found ===\n')

      // Count unique URLs
      const uniqueUrls = new Set<string>()
      for (const { urls } of allExternalUrls) {
        for (const { url } of urls) {
          uniqueUrls.add(url)
        }
      }

      console.log(`Total files with external URLs: ${allExternalUrls.length}`)
      console.log(`Total unique external URLs: ${uniqueUrls.size}`)

      console.log('\nFiles with external URLs:')
      for (const { file, urls } of allExternalUrls) {
        console.log(`\n  ${file}:`)
        for (const { line, url } of urls) {
          console.log(`    Line ${line}: ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`)
        }
      }

      console.log('\n\nTo fix this, run: node scripts/download-assets.mjs')
    }

    // This test intentionally passes to show the summary
    // Individual file tests will fail if external URLs are found
    expect(true).toBe(true)
  })
})

describe('Local Asset Files Exist', () => {
  const DEMO_DIR = join(ROOT_PATH, 'public', 'demo')
  const IMAGES_DIR = join(DEMO_DIR, 'images')
  const AVATARS_DIR = join(DEMO_DIR, 'avatars')

  it('should have demo directory', () => {
    expect(existsSync(DEMO_DIR)).toBe(true)
  })

  it('should have images directory for content images', () => {
    expect(existsSync(IMAGES_DIR)).toBe(true)
  })

  it('should have avatars directory for avatar images', () => {
    expect(existsSync(AVATARS_DIR)).toBe(true)
  })
})
