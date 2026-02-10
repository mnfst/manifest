/**
 * Absolute URL Enforcement Tests
 *
 * These tests ensure that all image URLs in demo data and usageCode
 * use absolute URLs (starting with https://) rather than relative paths.
 *
 * Relative paths like "/demo/shoe-1.png" cause 404 errors when users
 * copy-paste the usage code to test in MCP Jam or their own projects.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'

const ROOT_DIR = resolve(__dirname, '..')
const REGISTRY_DIR = resolve(ROOT_DIR, 'registry')
const PAGE_TSX_PATH = resolve(ROOT_DIR, 'app/blocks/[category]/[block]/page.tsx')
const LIB_DIR = resolve(ROOT_DIR, 'lib')

/**
 * Pattern to match relative URLs in image paths
 * Matches: "/demo/...", '/demo/...', "image: "/path", image: '/path'
 */
const RELATIVE_URL_PATTERNS = [
  /image:\s*['"]\/[^'"]+['"]/g,  // image: "/path" or image: '/path'
  /Image:\s*['"]\/[^'"]+['"]/g,  // Image: "/path" (capitalized)
  /productImage:\s*['"]\/[^'"]+['"]/g,  // productImage: "/path"
  /coverImage:\s*['"]\/[^'"]+['"]/g,  // coverImage: "/path"
  /src:\s*['"]\/demo\/[^'"]+['"]/g,  // src: "/demo/..."
  /url:\s*['"]\/demo\/[^'"]+['"]/g,  // url: "/demo/..."
]

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir: string, extension: string): string[] {
  const files: string[] = []

  if (!existsSync(dir)) {
    return files
  }

  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, extension))
    } else if (entry.endsWith(extension)) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Find relative URLs in file content
 */
function findRelativeUrls(content: string, filePath: string): string[] {
  const matches: string[] = []

  for (const pattern of RELATIVE_URL_PATTERNS) {
    const found = content.match(pattern)
    if (found) {
      matches.push(...found)
    }
  }

  // Also check for common patterns in template literals (usageCode)
  const templateLiteralPattern = /`[^`]*`/gs
  const templateLiterals = content.match(templateLiteralPattern)

  if (templateLiterals) {
    for (const literal of templateLiterals) {
      // Check for relative image paths in template literals
      const relativeImageMatch = literal.match(/image:\s*["']\/[^"']+["']/gi)
      if (relativeImageMatch) {
        matches.push(...relativeImageMatch)
      }

      const productImageMatch = literal.match(/productImage:\s*["']\/[^"']+["']/gi)
      if (productImageMatch) {
        matches.push(...productImageMatch)
      }
    }
  }

  // Remove duplicates
  return [...new Set(matches)]
}

describe('Absolute URL Enforcement', () => {
  describe('Registry demo data files', () => {
    // Find all .ts files inside demo/ directories (e.g. registry/<cat>/demo/<cat>.ts)
    const demoDataFiles = getAllFiles(REGISTRY_DIR, '.ts').filter(f => /\/demo\/[^/]+\.ts$/.test(f))

    for (const filePath of demoDataFiles) {
      const relativePath = filePath.replace(ROOT_DIR + '/', '')

      it(`${relativePath} should use absolute URLs for images`, () => {
        const content = readFileSync(filePath, 'utf-8')
        const relativeUrls = findRelativeUrls(content, filePath)

        if (relativeUrls.length > 0) {
          throw new Error(
            `Found relative URLs in ${relativePath}:\n` +
            `  ${relativeUrls.join('\n  ')}\n\n` +
            `Please use absolute URLs like:\n` +
            `  image: "https://ui.manifest.build/demo/shoe-1.png"\n` +
            `instead of:\n` +
            `  image: "/demo/shoe-1.png"\n\n` +
            `Relative URLs cause 404 errors when users copy-paste code.`
          )
        }

        expect(relativeUrls.length).toBe(0)
      })
    }
  })

  describe('Registry component files', () => {
    const componentFiles = getAllFiles(REGISTRY_DIR, '.tsx')

    for (const filePath of componentFiles) {
      const relativePath = filePath.replace(ROOT_DIR + '/', '')

      it(`${relativePath} should use absolute URLs for default images`, () => {
        const content = readFileSync(filePath, 'utf-8')

        // Look specifically for default values with relative URLs
        const defaultValuePattern = /=\s*['"]\/demo\/[^'"]+['"]/g
        const defaultMatches = content.match(defaultValuePattern)

        if (defaultMatches) {
          throw new Error(
            `Found relative URL default values in ${relativePath}:\n` +
            `  ${defaultMatches.join('\n  ')}\n\n` +
            `Please use absolute URLs for default values:\n` +
            `  productImage = "https://ui.manifest.build/demo/shoe-1.png"\n` +
            `instead of:\n` +
            `  productImage = "/demo/shoe-1.png"`
          )
        }

        expect(defaultMatches).toBeNull()
      })
    }
  })

  describe('Block page usageCode', () => {
    it('page.tsx should use absolute URLs in all usageCode examples', () => {
      if (!existsSync(PAGE_TSX_PATH)) {
        console.log('page.tsx not found, skipping')
        return
      }

      const content = readFileSync(PAGE_TSX_PATH, 'utf-8')

      // Extract usageCode blocks
      const usageCodePattern = /usageCode:\s*`([^`]+)`/gs
      const usageCodes = content.match(usageCodePattern) || []

      const relativeUrlsFound: string[] = []

      for (const usageCode of usageCodes) {
        // Check for relative image paths in usageCode
        const relativeMatches = usageCode.match(/image:\s*["']\/[^"']+["']/gi) || []
        const productImageMatches = usageCode.match(/productImage:\s*["']\/[^"']+["']/gi) || []

        relativeUrlsFound.push(...relativeMatches, ...productImageMatches)
      }

      if (relativeUrlsFound.length > 0) {
        throw new Error(
          `Found relative URLs in usageCode examples:\n` +
          `  ${relativeUrlsFound.join('\n  ')}\n\n` +
          `Please use absolute URLs in usageCode:\n` +
          `  image: "https://ui.manifest.build/demo/shoe-1.png"\n\n` +
          `Relative URLs cause 404 errors when users copy-paste code.`
        )
      }

      expect(relativeUrlsFound.length).toBe(0)
    })
  })

  describe('Preview components', () => {
    it('preview-components.tsx should use absolute URLs', () => {
      const previewPath = resolve(LIB_DIR, 'preview-components.tsx')

      if (!existsSync(previewPath)) {
        console.log('preview-components.tsx not found, skipping')
        return
      }

      const content = readFileSync(previewPath, 'utf-8')

      // Check for relative image paths
      const relativeImagePattern = /image:\s*['"]\/[^'"]+['"]/gi
      const productImagePattern = /productImage:\s*['"]\/[^'"]+['"]/gi

      const relativeImages = content.match(relativeImagePattern) || []
      const relativeProductImages = content.match(productImagePattern) || []
      const allRelative = [...relativeImages, ...relativeProductImages]

      if (allRelative.length > 0) {
        throw new Error(
          `Found relative URLs in preview-components.tsx:\n` +
          `  ${allRelative.join('\n  ')}\n\n` +
          `Please use absolute URLs:\n` +
          `  image: "https://ui.manifest.build/demo/shoe-1.png"`
        )
      }

      expect(allRelative.length).toBe(0)
    })
  })
})

describe('URL format validation', () => {
  it('all demo images should use ui.manifest.build domain', () => {
    const allFiles = [
      ...getAllFiles(REGISTRY_DIR, '.tsx'),
      ...getAllFiles(REGISTRY_DIR, '.ts'),
      resolve(LIB_DIR, 'preview-components.tsx'),
    ].filter(existsSync)

    const wrongDomainUrls: Array<{ file: string; url: string }> = []

    for (const filePath of allFiles) {
      const content = readFileSync(filePath, 'utf-8')

      // Find all https://...demo... URLs that don't use ui.manifest.build
      const demoUrlPattern = /https?:\/\/[^'"]+\/demo\/[^'"]+/g
      const demoUrls = content.match(demoUrlPattern) || []

      for (const url of demoUrls) {
        if (!url.startsWith('https://ui.manifest.build/')) {
          wrongDomainUrls.push({
            file: filePath.replace(ROOT_DIR + '/', ''),
            url,
          })
        }
      }
    }

    if (wrongDomainUrls.length > 0) {
      const details = wrongDomainUrls
        .map(({ file, url }) => `  ${file}: ${url}`)
        .join('\n')

      throw new Error(
        `Found demo URLs using wrong domain:\n${details}\n\n` +
        `Please use https://ui.manifest.build/demo/... for all demo assets.`
      )
    }

    expect(wrongDomainUrls.length).toBe(0)
  })
})
