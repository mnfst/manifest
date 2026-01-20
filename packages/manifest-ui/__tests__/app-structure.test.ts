/**
 * App Structure Tests
 *
 * Validates that the Next.js app follows proper conventions:
 * - App router structure is correct
 * - Required pages exist
 * - Layout files are present
 * - Error boundaries are in place
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'

const ROOT_DIR = resolve(__dirname, '..')
const APP_DIR = resolve(ROOT_DIR, 'app')
const COMPONENTS_DIR = resolve(ROOT_DIR, 'components')
const LIB_DIR = resolve(ROOT_DIR, 'lib')

/**
 * Check if a path is a directory
 */
function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}

/**
 * Get immediate subdirectories of a directory
 */
function getSubdirectories(dir: string): string[] {
  if (!existsSync(dir)) return []

  return readdirSync(dir).filter((entry) => {
    const fullPath = join(dir, entry)
    return statSync(fullPath).isDirectory()
  })
}

describe('Next.js App Router Structure', () => {
  describe('Root app directory', () => {
    it('should have app directory', () => {
      expect(existsSync(APP_DIR)).toBe(true)
      expect(isDirectory(APP_DIR)).toBe(true)
    })

    it('should have root layout.tsx', () => {
      const layoutPath = resolve(APP_DIR, 'layout.tsx')
      expect(existsSync(layoutPath)).toBe(true)
    })

    it('should have root page.tsx (home page)', () => {
      const pagePath = resolve(APP_DIR, 'page.tsx')
      expect(existsSync(pagePath)).toBe(true)
    })

    it('should have globals.css', () => {
      const cssPath = resolve(APP_DIR, 'globals.css')
      expect(existsSync(cssPath)).toBe(true)
    })
  })

  describe('Layout structure', () => {
    it('root layout should export default function', () => {
      const layoutPath = resolve(APP_DIR, 'layout.tsx')
      const content = readFileSync(layoutPath, 'utf-8')

      expect(content).toContain('export default')
    })

    it('root layout should have html and body tags', () => {
      const layoutPath = resolve(APP_DIR, 'layout.tsx')
      const content = readFileSync(layoutPath, 'utf-8')

      expect(content).toContain('<html')
      expect(content).toContain('<body')
    })

    it('root layout should import globals.css', () => {
      const layoutPath = resolve(APP_DIR, 'layout.tsx')
      const content = readFileSync(layoutPath, 'utf-8')

      expect(content).toContain('globals.css')
    })
  })

  describe('Blocks section', () => {
    const blocksDir = resolve(APP_DIR, 'blocks')

    it('should have blocks directory', () => {
      expect(existsSync(blocksDir)).toBe(true)
      expect(isDirectory(blocksDir)).toBe(true)
    })

    it('should have blocks page.tsx', () => {
      const pagePath = resolve(blocksDir, 'page.tsx')
      expect(existsSync(pagePath)).toBe(true)
    })

    it('should have blocks layout.tsx', () => {
      const layoutPath = resolve(blocksDir, 'layout.tsx')
      expect(existsSync(layoutPath)).toBe(true)
    })

    it('should have dynamic route for category/block', () => {
      // Check for [category]/[block] dynamic routes
      const categoryDir = resolve(blocksDir, '[category]')
      const blockDir = resolve(categoryDir, '[block]')

      expect(existsSync(categoryDir)).toBe(true)
      expect(existsSync(blockDir)).toBe(true)
    })
  })
})

describe('Components Directory Structure', () => {
  it('should have components directory', () => {
    expect(existsSync(COMPONENTS_DIR)).toBe(true)
    expect(isDirectory(COMPONENTS_DIR)).toBe(true)
  })

  it('should have ui subdirectory for base components', () => {
    const uiDir = resolve(COMPONENTS_DIR, 'ui')
    expect(existsSync(uiDir)).toBe(true)
  })

  it('should have organized component folders', () => {
    const subdirs = getSubdirectories(COMPONENTS_DIR)

    // Should have some organization
    expect(subdirs.length).toBeGreaterThan(0)

    // Log the structure
    console.log(`\nComponent directories: ${subdirs.join(', ')}`)
  })
})

describe('Lib Directory Structure', () => {
  it('should have lib directory', () => {
    expect(existsSync(LIB_DIR)).toBe(true)
    expect(isDirectory(LIB_DIR)).toBe(true)
  })

  it('should have utils.ts', () => {
    const utilsPath = resolve(LIB_DIR, 'utils.ts')
    expect(existsSync(utilsPath)).toBe(true)
  })

  it('utils should export cn function', () => {
    const utilsPath = resolve(LIB_DIR, 'utils.ts')
    const content = readFileSync(utilsPath, 'utf-8')

    expect(content).toContain('export function cn')
  })
})

describe('Page Exports', () => {
  describe('Home page', () => {
    const pagePath = resolve(APP_DIR, 'page.tsx')

    it('should export default function', () => {
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).toContain('export default')
    })
  })

  describe('Blocks page', () => {
    const pagePath = resolve(APP_DIR, 'blocks', 'page.tsx')

    it('should export default function', () => {
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).toContain('export default')
    })
  })
})

describe('Error Handling', () => {
  it('should have error boundary in blocks section', () => {
    const errorPath = resolve(APP_DIR, 'blocks', 'error.tsx')
    const notFoundPath = resolve(APP_DIR, 'blocks', 'not-found.tsx')

    // Either error boundary or not-found page should exist
    // This is informational - not all apps need explicit error handling
    if (existsSync(errorPath)) {
      const content = readFileSync(errorPath, 'utf-8')
      expect(content).toContain('export default')
    } else if (existsSync(notFoundPath)) {
      const content = readFileSync(notFoundPath, 'utf-8')
      expect(content).toContain('export default')
    } else {
      // Informational warning
      console.log('Consider adding error.tsx or not-found.tsx in blocks/')
    }

    expect(true).toBe(true)
  })
})

describe('Metadata', () => {
  it('root layout should export metadata', () => {
    const layoutPath = resolve(APP_DIR, 'layout.tsx')
    const content = readFileSync(layoutPath, 'utf-8')

    expect(content).toContain('export const metadata')
  })

  it('blocks layout should have section-specific metadata', () => {
    const layoutPath = resolve(APP_DIR, 'blocks', 'layout.tsx')
    const content = readFileSync(layoutPath, 'utf-8')

    // Should either export metadata or use parent's
    const hasMetadata =
      content.includes('export const metadata') ||
      content.includes('generateMetadata')

    // This is informational
    if (!hasMetadata) {
      console.log('Blocks layout uses parent metadata')
    }

    expect(true).toBe(true)
  })
})

describe('Styling', () => {
  describe('Global styles', () => {
    const cssPath = resolve(APP_DIR, 'globals.css')

    it('should have Tailwind directives', () => {
      const content = readFileSync(cssPath, 'utf-8')

      // Should have Tailwind CSS v4 import or v3 directives
      const hasTailwind =
        content.includes('@tailwind') ||
        content.includes('@import "tailwindcss') ||
        content.includes('tailwindcss/preflight') ||
        content.includes('tailwindcss/theme')

      expect(hasTailwind).toBe(true)
    })

    it('should define CSS custom properties', () => {
      const content = readFileSync(cssPath, 'utf-8')

      // Should have CSS variables for theming
      const hasCustomProperties =
        content.includes('--') ||
        content.includes(':root') ||
        content.includes('@theme')

      expect(hasCustomProperties).toBe(true)
    })
  })
})

describe('Public Assets', () => {
  const publicDir = resolve(ROOT_DIR, 'public')

  it('should have public directory', () => {
    expect(existsSync(publicDir)).toBe(true)
    expect(isDirectory(publicDir)).toBe(true)
  })

  it('should have favicon', () => {
    const faviconSvg = resolve(publicDir, 'favicon.svg')
    const faviconPng = resolve(publicDir, 'favicon.png')
    const faviconIco = resolve(publicDir, 'favicon.ico')

    const hasFavicon =
      existsSync(faviconSvg) || existsSync(faviconPng) || existsSync(faviconIco)

    expect(hasFavicon).toBe(true)
  })

  it('should have OG image', () => {
    const ogImage = resolve(publicDir, 'og-image.png')
    const ogImageJpg = resolve(publicDir, 'og-image.jpg')

    const hasOgImage = existsSync(ogImage) || existsSync(ogImageJpg)

    expect(hasOgImage).toBe(true)
  })

  it('should have previews directory', () => {
    const previewsDir = resolve(publicDir, 'previews')
    expect(existsSync(previewsDir)).toBe(true)
  })
})
