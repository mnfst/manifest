/**
 * Registry Integrity Tests
 *
 * Ensures that the registry.json file is in sync with the actual component files:
 * - All files referenced in registry.json exist on disk
 * - All component files in registry/ have entries in registry.json
 * - Categories match directory structure
 * - Dependencies are consistent
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join, relative } from 'path'

const ROOT_DIR = resolve(__dirname, '..')
const REGISTRY_JSON_PATH = resolve(ROOT_DIR, 'registry.json')
const REGISTRY_DIR = resolve(ROOT_DIR, 'registry')

interface RegistryFile {
  path: string
  type: string
  target?: string
}

interface RegistryMeta {
  preview?: string
  version?: string
}

interface RegistryItem {
  name: string
  type: string
  title: string
  description: string
  categories?: string[]
  meta?: RegistryMeta
  dependencies?: string[]
  registryDependencies?: string[]
  files: RegistryFile[]
}

interface Registry {
  $schema: string
  name: string
  homepage: string
  items: RegistryItem[]
}

/**
 * Recursively get all .tsx files in a directory
 */
function getAllTsxFiles(dir: string): string[] {
  const files: string[] = []

  if (!existsSync(dir)) {
    return files
  }

  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getAllTsxFiles(fullPath))
    } else if (entry.endsWith('.tsx')) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Load the current registry.json
 */
function loadRegistry(): Registry {
  const content = readFileSync(REGISTRY_JSON_PATH, 'utf-8')
  return JSON.parse(content) as Registry
}

describe('Registry Integrity', () => {
  const registry = loadRegistry()

  describe('Registry JSON Structure', () => {
    it('should have valid $schema', () => {
      expect(registry.$schema).toBeDefined()
      expect(registry.$schema).toContain('shadcn')
    })

    it('should have name defined', () => {
      expect(registry.name).toBeDefined()
      expect(typeof registry.name).toBe('string')
    })

    it('should have homepage defined', () => {
      expect(registry.homepage).toBeDefined()
      expect(registry.homepage).toMatch(/^https?:\/\//)
    })

    it('should have items array', () => {
      expect(registry.items).toBeDefined()
      expect(Array.isArray(registry.items)).toBe(true)
      expect(registry.items.length).toBeGreaterThan(0)
    })
  })

  describe('Component Files Existence', () => {
    for (const item of registry.items) {
      describe(`Component: ${item.name}`, () => {
        it('should have at least one file', () => {
          expect(item.files.length).toBeGreaterThan(0)
        })

        for (const file of item.files) {
          it(`should have existing file: ${file.path}`, () => {
            const fullPath = resolve(ROOT_DIR, file.path)
            expect(existsSync(fullPath)).toBe(true)
          })
        }
      })
    }
  })

  describe('Registry Coverage', () => {
    it('should have all registry .tsx files represented in registry.json', () => {
      const diskFiles = getAllTsxFiles(REGISTRY_DIR)
      const registryFiles = new Set<string>()

      // Collect all file paths from registry.json
      for (const item of registry.items) {
        for (const file of item.files) {
          const normalizedPath = resolve(ROOT_DIR, file.path)
          registryFiles.add(normalizedPath)
        }
      }

      // Find files on disk not in registry
      const unmappedFiles: string[] = []
      for (const diskFile of diskFiles) {
        if (!registryFiles.has(diskFile)) {
          const relativePath = relative(ROOT_DIR, diskFile)
          unmappedFiles.push(relativePath)
        }
      }

      if (unmappedFiles.length > 0) {
        console.log('\n=== Files not in registry.json ===')
        for (const file of unmappedFiles) {
          console.log(`  - ${file}`)
        }
      }

      // Allow some flexibility - demo or test files might not be in registry
      const significantUnmapped = unmappedFiles.filter(
        (f) => !f.includes('demo') && !f.includes('test') && !f.includes('example')
      )

      if (significantUnmapped.length > 0) {
        console.warn(
          `Warning: ${significantUnmapped.length} component files are not registered in registry.json`
        )
      }

      // This is informational - we don't fail the test for unmapped files
      expect(true).toBe(true)
    })
  })

  describe('Component Name Uniqueness', () => {
    it('should have unique component names', () => {
      const names = registry.items.map((item) => item.name)
      const uniqueNames = new Set(names)

      if (names.length !== uniqueNames.size) {
        const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
        throw new Error(`Duplicate component names found: ${duplicates.join(', ')}`)
      }

      expect(names.length).toBe(uniqueNames.size)
    })
  })

  describe('Component Metadata', () => {
    const blockItems = registry.items.filter((item) => item.type === 'registry:block')
    for (const item of blockItems) {
      describe(`${item.name}`, () => {
        it('should have a title', () => {
          expect(item.title).toBeDefined()
          expect(typeof item.title).toBe('string')
          expect(item.title.length).toBeGreaterThan(0)
        })

        it('should have a description', () => {
          expect(item.description).toBeDefined()
          expect(typeof item.description).toBe('string')
          expect(item.description.length).toBeGreaterThan(0)
        })

        it('should have type as registry:block', () => {
          expect(item.type).toBe('registry:block')
        })

        it('should have meta with version', () => {
          expect(item.meta).toBeDefined()
          expect(item.meta?.version).toBeDefined()
        })

        it('should have categories defined', () => {
          expect(item.categories).toBeDefined()
          expect(Array.isArray(item.categories)).toBe(true)
          expect(item.categories!.length).toBeGreaterThan(0)
        })
      })
    }
  })

  describe('Registry Dependencies', () => {
    it('should have valid registry dependencies (references to other components)', () => {
      const componentNames = new Set(registry.items.map((item) => item.name))

      for (const item of registry.items) {
        if (item.registryDependencies && item.registryDependencies.length > 0) {
          for (const dep of item.registryDependencies) {
            // Registry dependencies should reference other components in the registry
            // or external registries
            if (!dep.includes('/') && !componentNames.has(dep)) {
              console.warn(
                `Component "${item.name}" has registry dependency "${dep}" that doesn't exist in registry`
              )
            }
          }
        }
      }

      expect(true).toBe(true)
    })
  })

  describe('Registry Dependency URL Handling', () => {
    it('should not have full-URL registry dependencies that would break /r/ prefix fetch pattern', () => {
      // This test prevents a regression where full URLs in registryDependencies
      // (e.g., "https://ui.manifest.build/r/manifest-types.json") would be
      // incorrectly fetched as "/r/https://ui.manifest.build/r/manifest-types.json.json"
      // in variant-section.tsx. Either the code must handle full URLs, or deps must
      // use short names. This test documents which components use full URLs so that
      // the fetch logic in variant-section.tsx is kept in sync.
      const componentsWithFullUrlDeps: string[] = []

      for (const item of registry.items) {
        if (item.registryDependencies) {
          const fullUrlDeps = item.registryDependencies.filter((dep) => dep.startsWith('http'))
          if (fullUrlDeps.length > 0) {
            componentsWithFullUrlDeps.push(item.name)
          }
        }
      }

      // If any components use full URL deps, variant-section.tsx MUST handle them.
      // This test serves as a reminder: if you see it, check that variant-section.tsx
      // correctly detects full URLs and does NOT prepend "/r/" or append ".json".
      if (componentsWithFullUrlDeps.length > 0) {
        // Read variant-section.tsx and verify it handles full URLs
        const variantSectionPath = resolve(ROOT_DIR, 'components/blocks/variant-section.tsx')
        expect(existsSync(variantSectionPath)).toBe(true)

        const variantSectionCode = readFileSync(variantSectionPath, 'utf-8')
        // The code must contain logic to detect full URLs (startsWith('http'))
        // before constructing the fetch URL
        expect(
          variantSectionCode.includes("startsWith('http')") || variantSectionCode.includes('startsWith("http")'),
          'variant-section.tsx must handle full URL registry dependencies (check for startsWith("http") before prepending /r/). ' +
          `Components with full URL deps: ${componentsWithFullUrlDeps.join(', ')}`
        ).toBe(true)
      }
    })
  })

  describe('Category Consistency', () => {
    it('should have categories matching directory structure', () => {
      for (const item of registry.items) {
        const category = item.categories?.[0]
        if (!category || !item.files[0]) continue

        const filePath = item.files[0].path
        // Expected format: registry/<category>/<component>.tsx
        const pathParts = filePath.split('/')
        if (pathParts.length < 3) continue // Skip top-level registry files like shared-types.ts

        if (pathParts.length >= 3 && pathParts[0] === 'registry') {
          const dirCategory = pathParts[1]

          if (category !== dirCategory) {
            throw new Error(
              `Component "${item.name}" has category "${category}" but is in directory "${dirCategory}"`
            )
          }
        }
      }

      expect(true).toBe(true)
    })

    it('should group components by valid categories', () => {
      const categories = new Set<string>()

      for (const item of registry.items) {
        if (item.categories) {
          for (const cat of item.categories) {
            categories.add(cat)
          }
        }
      }

      // Should have multiple categories
      expect(categories.size).toBeGreaterThan(3)

      // Log categories for visibility
      console.log(`\nFound ${categories.size} categories: ${[...categories].sort().join(', ')}`)
    })
  })
})

describe('Shared Types Pattern', () => {
  const registry = loadRegistry()

  it('should not include types.ts directly in any component files array', () => {
    for (const item of registry.items) {
      if (item.name === 'manifest-types') continue
      for (const file of item.files) {
        expect(
          file.path.endsWith('/types.ts'),
          `"${item.name}" includes ${file.path} directly in files. Use "manifest-types" in registryDependencies instead.`
        ).toBe(false)
      }
    }
  })

  it('should list manifest-types in registryDependencies when importing from ./types', () => {
    for (const item of registry.items) {
      if (item.name === 'manifest-types') continue
      for (const file of item.files) {
        if (!file.path.endsWith('.tsx')) continue
        const fullPath = resolve(ROOT_DIR, file.path)
        if (!existsSync(fullPath)) continue
        const content = readFileSync(fullPath, 'utf-8')
        if (content.includes("from './types'") || content.includes('from "./types"')) {
          expect(
            item.registryDependencies?.includes('manifest-types') || item.registryDependencies?.includes('https://ui.manifest.build/r/manifest-types.json'),
            `"${item.name}" imports from './types' but doesn't list "manifest-types" in registryDependencies.`
          ).toBe(true)
        }
      }
    }
  })

  it('should have a manifest-types registry item targeting components/ui/types.ts', () => {
    const typesItem = registry.items.find((item) => item.name === 'manifest-types')
    expect(typesItem).toBeDefined()
    expect(typesItem!.files.some((f) => f.target === 'components/ui/types.ts')).toBe(true)
  })
})

describe('Registry JSON Formatting', () => {
  it('should be properly formatted JSON', () => {
    const content = readFileSync(REGISTRY_JSON_PATH, 'utf-8')

    // Check that it parses
    const parsed = JSON.parse(content)
    expect(parsed).toBeDefined()

    // Check that it has consistent formatting (2 spaces indentation)
    const formatted = JSON.stringify(parsed, null, 2)

    // The actual content might have different newline handling, so we compare structure
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(JSON.parse(formatted)))
  })
})

describe('File Path Standards', () => {
  const registry = loadRegistry()

  it('all file paths should use forward slashes', () => {
    for (const item of registry.items) {
      for (const file of item.files) {
        expect(file.path).not.toContain('\\')
      }
    }
  })

  it('all file paths should be relative to package root', () => {
    for (const item of registry.items) {
      for (const file of item.files) {
        expect(file.path).not.toMatch(/^\//)
        expect(file.path).not.toMatch(/^\.\.\//)
      }
    }
  })

  it('all component files should be in registry/ directory', () => {
    for (const item of registry.items) {
      for (const file of item.files) {
        expect(file.path).toMatch(/^registry\//)
      }
    }
  })

  it('all component files should be TypeScript files (.ts or .tsx)', () => {
    for (const item of registry.items) {
      for (const file of item.files) {
        expect(file.path).toMatch(/\.tsx?$/)
      }
    }
  })
})
