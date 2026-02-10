/**
 * Preview Generation Tests
 *
 * These tests ensure that the preview generation system is properly configured:
 * 1. All components in registry.json have a corresponding preview configuration
 * 2. Preview backgrounds are defined for all categories
 * 3. Preview URLs (when present) are valid
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const REGISTRY_JSON_PATH = resolve(__dirname, '..', 'registry.json')
const PREVIEW_COMPONENTS_PATH = resolve(
  __dirname,
  '..',
  'lib',
  'preview-components.tsx'
)
const PREVIEW_BACKGROUNDS_PATH = resolve(
  __dirname,
  '..',
  'lib',
  'preview-backgrounds.ts'
)
const PREVIEWS_DIR = resolve(__dirname, '..', 'public', 'previews')

interface RegistryItem {
  name: string
  version: string
  category?: string
  preview?: string
  files: Array<{ path: string }>
}

interface Registry {
  items: RegistryItem[]
}

/**
 * Load the current registry.json
 */
function loadRegistry(): Registry {
  const content = readFileSync(REGISTRY_JSON_PATH, 'utf-8')
  return JSON.parse(content)
}

/**
 * Extract component names from preview-components.tsx
 */
function getPreviewComponentNames(): string[] {
  if (!existsSync(PREVIEW_COMPONENTS_PATH)) {
    return []
  }
  const content = readFileSync(PREVIEW_COMPONENTS_PATH, 'utf-8')

  // Extract keys from previewComponents object
  const matches = content.match(/['"]([a-z-]+)['"]\s*:\s*\{/g)
  if (!matches) return []

  return matches.map((match) => {
    const nameMatch = match.match(/['"]([a-z-]+)['"]/)
    return nameMatch ? nameMatch[1] : ''
  }).filter(Boolean)
}

/**
 * Extract category names from preview-backgrounds.ts
 */
function getPreviewBackgroundCategories(): string[] {
  if (!existsSync(PREVIEW_BACKGROUNDS_PATH)) {
    return []
  }
  const content = readFileSync(PREVIEW_BACKGROUNDS_PATH, 'utf-8')

  // Extract keys from categoryBackgrounds object
  const matches = content.match(/^\s+([a-z]+):\s*\{/gm)
  if (!matches) return []

  return matches.map((match) => {
    const nameMatch = match.match(/([a-z]+):/)
    return nameMatch ? nameMatch[1] : ''
  }).filter(Boolean)
}

describe('Preview Generation Configuration', () => {
  const registry = loadRegistry()

  describe('Preview components file', () => {
    it('should exist', () => {
      expect(existsSync(PREVIEW_COMPONENTS_PATH)).toBe(true)
    })

    it('should export previewComponents map', () => {
      const content = readFileSync(PREVIEW_COMPONENTS_PATH, 'utf-8')
      expect(content).toContain('export const previewComponents')
    })

    it('should have configurations for registry components', () => {
      const previewComponentNames = getPreviewComponentNames()

      // Check that we have at least some preview components defined
      expect(previewComponentNames.length).toBeGreaterThan(0)

      // Check coverage - at least 80% of registry components should have previews
      const registryComponentNames = registry.items.map((item) => item.name)
      const coveredComponents = registryComponentNames.filter((name) =>
        previewComponentNames.includes(name)
      )

      const coverage = coveredComponents.length / registryComponentNames.length

      console.log(
        `Preview coverage: ${coveredComponents.length}/${registryComponentNames.length} (${(coverage * 100).toFixed(1)}%)`
      )

      // Warn about missing components
      const missingComponents = registryComponentNames.filter(
        (name) => !previewComponentNames.includes(name)
      )
      if (missingComponents.length > 0) {
        console.log('Missing preview configurations:')
        for (const name of missingComponents) {
          console.log(`  - ${name}`)
        }
      }

      expect(coverage).toBeGreaterThanOrEqual(0.8)
    })
  })

  describe('Preview backgrounds file', () => {
    it('should exist', () => {
      expect(existsSync(PREVIEW_BACKGROUNDS_PATH)).toBe(true)
    })

    it('should export categoryBackgrounds', () => {
      const content = readFileSync(PREVIEW_BACKGROUNDS_PATH, 'utf-8')
      expect(content).toContain('export const categoryBackgrounds')
    })

    it('should export PREVIEW_VIEWPORT', () => {
      const content = readFileSync(PREVIEW_BACKGROUNDS_PATH, 'utf-8')
      expect(content).toContain('export const PREVIEW_VIEWPORT')
    })

    it('should have backgrounds for all registry categories', () => {
      const backgroundCategories = getPreviewBackgroundCategories()

      // Get unique categories from registry (only block items need preview backgrounds)
      const registryCategories = [
        ...new Set(
          registry.items
            .filter((item: { name: string }) => item.name !== 'manifest-types')
            .map((item: { category?: string }) => item.category)
            .filter(Boolean)
        )
      ]

      // Check that all registry categories have backgrounds
      const missingCategories = registryCategories.filter(
        (cat) => !backgroundCategories.includes(cat!)
      )

      if (missingCategories.length > 0) {
        console.log('Categories missing backgrounds:')
        for (const cat of missingCategories) {
          console.log(`  - ${cat}`)
        }
      }

      expect(missingCategories.length).toBe(0)
    })
  })

  describe('Preview URL validation', () => {
    const componentsWithPreviews = registry.items.filter(
      (item) => item.preview
    )

    if (componentsWithPreviews.length === 0) {
      it.skip('no preview URLs defined yet', () => {})
    } else {
      it('preview URLs should have correct format', () => {
        for (const item of componentsWithPreviews) {
          expect(item.preview).toMatch(
            /^https:\/\/ui\.manifest\.build\/previews\/[a-z-]+\.png$/
          )
        }
      })

      it('preview URLs should match component names', () => {
        for (const item of componentsWithPreviews) {
          const expectedUrl = `https://ui.manifest.build/previews/${item.name}.png`
          expect(item.preview).toBe(expectedUrl)
        }
      })
    }
  })

  describe('Previews directory', () => {
    it('should exist', () => {
      expect(existsSync(PREVIEWS_DIR)).toBe(true)
    })
  })
})

describe('Preview component to registry mapping', () => {
  const registry = loadRegistry()
  const previewComponentNames = getPreviewComponentNames()

  for (const componentName of previewComponentNames) {
    it(`"${componentName}" should exist in registry.json`, () => {
      const registryItem = registry.items.find(
        (item) => item.name === componentName
      )
      expect(registryItem).toBeDefined()
    })
  }
})

describe('Registry components should have preview configurations', () => {
  const registry = loadRegistry()
  const previewComponentNames = getPreviewComponentNames()

  // Components that may be difficult to render in isolation
  const skippedComponents: string[] = ['manifest-types', 'event-shared']

  for (const item of registry.items) {
    const { name } = item

    if (skippedComponents.includes(name)) {
      it.skip(`"${name}" is skipped (utility component)`, () => {})
      continue
    }

    it(`"${name}" should have a preview configuration`, () => {
      const hasPreview = previewComponentNames.includes(name)
      if (!hasPreview) {
        console.warn(
          `Component "${name}" is missing preview configuration in lib/preview-components.tsx`
        )
      }
      expect(hasPreview).toBe(true)
    })
  }
})
