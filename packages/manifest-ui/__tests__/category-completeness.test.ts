/**
 * Category Completeness Test
 *
 * Validates that the category navigation system is complete and consistent:
 * - Every registry category has a display name in blocks-categories.ts
 * - Every registry category is in the categoryOrder array
 * - Category pages exist for all categories with blocks
 * - No orphaned categories exist in navigation that have no blocks
 *
 * This prevents regressions where new categories are added to the registry
 * but missing from navigation, making blocks unreachable in the UI.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { describe, it, expect } from 'vitest'

const ROOT_PATH = resolve(__dirname, '..')
const REGISTRY_PATH = resolve(ROOT_PATH, 'registry')
const CATEGORIES_PATH = resolve(ROOT_PATH, 'lib', 'blocks-categories.ts')
const REGISTRY_JSON_PATH = resolve(ROOT_PATH, 'registry.json')

const registryJson = JSON.parse(
  readFileSync(REGISTRY_JSON_PATH, 'utf-8')
)

const categoriesContent = existsSync(CATEGORIES_PATH)
  ? readFileSync(CATEGORIES_PATH, 'utf-8')
  : ''

/**
 * Get all unique categories from registry.json
 */
function getRegistryCategories(): string[] {
  const categories = new Set<string>()

  for (const item of registryJson.items) {
    if (item.type !== 'registry:block') continue
    if (item.categories) {
      for (const cat of item.categories) {
        categories.add(cat)
      }
    }
    // Also support the legacy 'category' field
    if (item.category) {
      categories.add(item.category)
    }
  }

  return [...categories].sort()
}

/**
 * Get all category directories that contain .tsx component files
 */
function getFileSystemCategories(): string[] {
  const entries = readdirSync(REGISTRY_PATH)
  const categories: string[] = []

  for (const entry of entries) {
    const fullPath = join(REGISTRY_PATH, entry)
    if (!statSync(fullPath).isDirectory()) continue

    // Check if directory contains .tsx files
    const files = readdirSync(fullPath)
    if (files.some((f) => f.endsWith('.tsx'))) {
      categories.push(entry)
    }
  }

  return categories.sort()
}

/**
 * Extract category display names from blocks-categories.ts
 */
function extractDisplayNames(): Record<string, string> {
  const match = categoriesContent.match(
    /categoryDisplayNames[^{]*\{([^}]+)\}/s
  )
  if (!match) return {}

  const entries: Record<string, string> = {}
  const entryMatches = match[1].matchAll(
    /['"]?(\w+)['"]?\s*:\s*['"]([^'"]+)['"]/g
  )
  for (const m of entryMatches) {
    entries[m[1]] = m[2]
  }

  return entries
}

/**
 * Extract category order array from blocks-categories.ts
 */
function extractCategoryOrder(): string[] {
  const match = categoriesContent.match(
    /categoryOrder\s*=\s*\[([\s\S]*?)\]/
  )
  if (!match) return []

  const entries = match[1].matchAll(/['"](\w+)['"]/g)
  return [...entries].map((m) => m[1])
}

describe('Category Completeness', () => {
  const registryCategories = getRegistryCategories()
  const fsCategories = getFileSystemCategories()
  const displayNames = extractDisplayNames()
  const categoryOrder = extractCategoryOrder()

  it('should find categories to validate', () => {
    expect(registryCategories.length).toBeGreaterThan(0)
  })

  describe('Registry categories must match file system directories', () => {
    for (const category of registryCategories) {
      it(`category "${category}" must have a corresponding directory in registry/`, () => {
        expect(
          fsCategories.includes(category),
          `Category "${category}" is in registry.json but has no directory ` +
            `at registry/${category}/. Either create the directory or fix the category name.`
        ).toBe(true)
      })
    }
  })

  describe('File system category directories must be in registry.json', () => {
    for (const category of fsCategories) {
      it(`directory registry/${category}/ must have blocks registered in registry.json`, () => {
        expect(
          registryCategories.includes(category),
          `Directory registry/${category}/ has .tsx files but no blocks registered ` +
            `in registry.json with this category. Either register the blocks or remove the directory.`
        ).toBe(true)
      })
    }
  })

  describe('Every registry category must have a display name', () => {
    for (const category of registryCategories) {
      it(`category "${category}" must have a display name in blocks-categories.ts`, () => {
        expect(
          displayNames[category],
          `Category "${category}" is in registry.json but has no display name ` +
            `in blocks-categories.ts. Add it to categoryDisplayNames.`
        ).toBeDefined()
      })
    }
  })

  describe('Every registry category must be in categoryOrder', () => {
    for (const category of registryCategories) {
      it(`category "${category}" must be in categoryOrder array`, () => {
        expect(
          categoryOrder.includes(category),
          `Category "${category}" is in registry.json but not in the categoryOrder array ` +
            `in blocks-categories.ts. It will appear at the bottom of the sidebar.`
        ).toBe(true)
      })
    }
  })

  describe('No orphaned categories in navigation', () => {
    for (const category of Object.keys(displayNames)) {
      it(`display name category "${category}" must have blocks in registry`, () => {
        expect(
          registryCategories.includes(category),
          `Category "${category}" has a display name in blocks-categories.ts ` +
            `but no blocks in registry.json. Remove the stale entry.`
        ).toBe(true)
      })
    }
  })

  describe('Demo data directory exists for every category', () => {
    for (const category of registryCategories) {
      it(`category "${category}" must have a demo/ directory`, () => {
        const demoDir = join(REGISTRY_PATH, category, 'demo')
        expect(
          existsSync(demoDir),
          `Category "${category}" has no demo/ directory. ` +
            `Create registry/${category}/demo/${category}.ts with demo data.`
        ).toBe(true)
      })

      it(`category "${category}" must have demo/${category}.ts file`, () => {
        const demoFile = join(
          REGISTRY_PATH,
          category,
          'demo',
          `${category}.ts`
        )
        expect(
          existsSync(demoFile),
          `Category "${category}" is missing demo/${category}.ts. ` +
            `This causes 404 errors when the system looks for demo data at the expected path.`
        ).toBe(true)
      })
    }
  })
})
