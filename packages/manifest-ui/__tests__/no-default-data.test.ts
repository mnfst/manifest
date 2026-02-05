/**
 * No Default Data Enforcement Test
 *
 * Validates that component files do NOT contain hardcoded inline default data.
 * Components may import from demo/<category> and use as ?? fallback (this is the
 * intended demo data strategy for shadcn distribution).
 *
 * Rules enforced:
 * B) Components must not destructure data props with inline string/object defaults
 * C) Components must not use ?? with string literals for content data props
 *
 * Exceptions:
 * - Files in demo/ directories
 * - page.tsx files (preview pages)
 * - preview-components.tsx
 * - Appearance/control prop defaults (variant, currency, isLoading, etc.)
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve, relative } from 'path'
import { describe, it, expect } from 'vitest'

const ROOT_PATH = resolve(__dirname, '..')
const REGISTRY_PATH = resolve(ROOT_PATH, 'registry')

/**
 * Get all .tsx files recursively, excluding demo/ dirs and test files
 */
function getComponentFiles(dir: string): string[] {
  const files: string[] = []
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      if (entry === 'demo') continue
      files.push(...getComponentFiles(fullPath))
    } else if (entry.endsWith('.tsx')) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Appearance/control prop names that are allowed to have defaults.
 * These control layout/styling, not content data.
 */
const ALLOWED_DEFAULT_PROPS = [
  'variant',
  'currency',
  'displayMode',
  'columns',
  'showHeader',
  'showAuthor',
  'showCategory',
  'showImage',
  'showTitle',
  'compact',
  'stickyHeader',
  'isLoading',
  'disabled',
  'postsPerPage',
  'submitLabel',
  'emptyMessage',
  'selectionMode',
  'multiSelect',
  'isPlaying',
  'progress',
  'layout',
  'showFilters',
  'status',
]

describe('No Default Data in Components', () => {
  const componentFiles = getComponentFiles(REGISTRY_PATH)

  it('should find component files to check', () => {
    expect(componentFiles.length).toBeGreaterThan(0)
  })

  describe('Rule B: No inline content defaults in data destructuring', () => {
    for (const absPath of componentFiles) {
      const relPath = relative(ROOT_PATH, absPath)

      it(`${relPath}`, () => {
        const content = readFileSync(absPath, 'utf-8')
        const issues: string[] = []

        // Match destructuring with string defaults from data
        // e.g., title = 'Contact Us' or title = "Contact Us"
        const destructurePattern =
          /(?:data|data\s*\?\?\s*\{\})\s*;?\s*\n?\s*(?:const|let)\s*\{([^}]+)\}/g
        let match
        while ((match = destructurePattern.exec(content)) !== null) {
          const props = match[1]
          // Find props with string defaults like: propName = 'value'
          const defaultPattern =
            /(\w+)\s*=\s*['"][^'"]+['"]/g
          let propMatch
          while ((propMatch = defaultPattern.exec(props)) !== null) {
            const propName = propMatch[1]
            if (!ALLOWED_DEFAULT_PROPS.includes(propName)) {
              issues.push(
                `Destructures "${propName}" with a string default. ` +
                  'Content data should not have defaults.'
              )
            }
          }

          // Find props with object/array defaults like: propName = { or propName = [
          const objDefaultPattern = /(\w+)\s*=\s*[{[]/g
          let objMatch
          while ((objMatch = objDefaultPattern.exec(props)) !== null) {
            const propName = objMatch[1]
            if (!ALLOWED_DEFAULT_PROPS.includes(propName)) {
              issues.push(
                `Destructures "${propName}" with an object/array default. ` +
                  'Content data should not have defaults.'
              )
            }
          }
        }

        if (issues.length > 0) {
          throw new Error(issues.join('\n'))
        }
      })
    }
  })

  describe('Rule C: No ?? string literal fallbacks for content data', () => {
    for (const absPath of componentFiles) {
      const relPath = relative(ROOT_PATH, absPath)

      it(`${relPath}`, () => {
        const content = readFileSync(absPath, 'utf-8')
        const issues: string[] = []

        // Match patterns like: data?.propName ?? 'Default String'
        const fallbackPattern =
          /data\?\.\s*(\w+)\s*\?\?\s*['"][^'"]{3,}['"]/g
        let match
        while ((match = fallbackPattern.exec(content)) !== null) {
          const propName = match[1]
          if (!ALLOWED_DEFAULT_PROPS.includes(propName)) {
            issues.push(
              `Uses data?.${propName} ?? 'string' fallback. ` +
                'Content data should not have string defaults.'
            )
          }
        }

        if (issues.length > 0) {
          throw new Error(issues.join('\n'))
        }
      })
    }
  })
})

describe('Registry file validation for demo data imports', () => {
  const registryJson = JSON.parse(
    readFileSync(resolve(ROOT_PATH, 'registry.json'), 'utf-8')
  )

  interface RegistryItem {
    name: string
    files: { path: string; type: string; target: string }[]
  }

  const registryItems: RegistryItem[] = registryJson.items

  const fileToItems = new Map<string, RegistryItem[]>()
  for (const item of registryItems) {
    for (const file of item.files) {
      const existing = fileToItems.get(file.path) ?? []
      existing.push(item)
      fileToItems.set(file.path, existing)
    }
  }

  // Also include .ts files for this check
  function getAllTsFiles(dir: string): string[] {
    const files: string[] = []
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        if (entry === 'demo') continue
        files.push(...getAllTsFiles(fullPath))
      } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
        files.push(fullPath)
      }
    }
    return files
  }

  const allTsFiles = getAllTsFiles(REGISTRY_PATH)
  const filesWithDemoImport = allTsFiles.filter((f) => {
    const content = readFileSync(f, 'utf-8')
    return /from\s+['"]\.\/demo\/[a-z-]+['"]/.test(content)
  })

  it('should validate demo data imports are in registry (if any exist)', () => {
    // This test ensures the suite is never empty
    expect(true).toBe(true)
  })

  for (const absPath of filesWithDemoImport) {
    const relPath = relative(ROOT_PATH, absPath)

    it(`${relPath} must have demo/<category>.ts in registry files`, () => {
      const ownerItems = fileToItems.get(relPath) ?? []
      if (ownerItems.length === 0) return

      const errors: string[] = []
      for (const item of ownerItems) {
        const filePaths = item.files.map((f) => f.path)
        const parts = relPath.split('/')
        const categoryIndex = parts.indexOf('registry') + 1
        if (categoryIndex < parts.length) {
          const category = parts[categoryIndex]
          const demoDataPath = `registry/${category}/demo/${category}.ts`
          if (!filePaths.includes(demoDataPath)) {
            errors.push(
              `"${item.name}" imports demo/${category} but ` +
                `"${demoDataPath}" is not in its registry files`
            )
          }
        }
      }

      if (errors.length > 0) {
        throw new Error(errors.join('\n'))
      }
    })
  }
})
