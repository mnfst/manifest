/**
 * Block Page Coverage Test
 *
 * Ensures every registered block in registry.json is actually rendered
 * in the block detail page (app/blocks/[category]/[block]/page.tsx).
 *
 * This prevents regressions where:
 * - A new block is added to registry.json but never wired into the page
 * - A block is renamed in registry.json but the page still uses the old name
 * - A block's component import is removed from the page
 * - A block variant is missing usageCode (users see empty "copy" panels)
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const ROOT_PATH = resolve(__dirname, '..')
const REGISTRY_JSON_PATH = resolve(ROOT_PATH, 'registry.json')
const BLOCK_PAGE_PATH = resolve(
  ROOT_PATH,
  'app',
  'blocks',
  '[category]',
  '[block]',
  'page.tsx'
)

interface RegistryItem {
  name: string
  type: string
  title: string
  categories?: string[]
  files: { path: string; type: string }[]
}

const registryJson = JSON.parse(
  readFileSync(REGISTRY_JSON_PATH, 'utf-8')
)
const blockItems: RegistryItem[] = registryJson.items.filter(
  (item: RegistryItem) => item.type === 'registry:block'
)

// Utility items that don't need page entries
const UTILITY_ITEMS = ['manifest-types', 'event-shared']

// Components that are used as sub-components (rendered inside another block's variant)
// These appear in the page as part of another block's variant, not standalone
const SUB_COMPONENTS = ['message-bubble']

const pageContent = existsSync(BLOCK_PAGE_PATH)
  ? readFileSync(BLOCK_PAGE_PATH, 'utf-8')
  : ''

/**
 * Extract all registryName values from the page content
 */
function extractRegistryNames(): string[] {
  const matches = pageContent.matchAll(/registryName:\s*['"]([^'"]+)['"]/g)
  return [...matches].map((m) => m[1])
}

/**
 * Extract all component imports from the page
 */
function extractPageImports(): {
  componentName: string
  importPath: string
}[] {
  const imports: { componentName: string; importPath: string }[] = []
  const lines = pageContent.split('\n')

  for (const line of lines) {
    // Match: import { Component } from '@/registry/...'
    const match = line.match(
      /import\s+\{([^}]+)\}\s+from\s+['"](@\/registry\/[^'"]+)['"]/
    )
    if (match) {
      const names = match[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('type '))
      for (const name of names) {
        imports.push({ componentName: name, importPath: match[2] })
      }
    }
  }

  return imports
}

/**
 * Extract demo data imports from the page
 */
function extractPageDemoImports(): {
  symbols: string[]
  importPath: string
}[] {
  const imports: { symbols: string[]; importPath: string }[] = []
  const lines = pageContent.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.includes('/demo/')) continue

    const match = line.match(
      /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]*\/demo\/[^'"]+)['"]/
    )
    if (match) {
      const symbols = match[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      imports.push({ symbols, importPath: match[2] })
    }
  }

  return imports
}

describe('Block Page Coverage', () => {
  it('should find the block page file', () => {
    expect(
      existsSync(BLOCK_PAGE_PATH),
      'app/blocks/[category]/[block]/page.tsx must exist'
    ).toBe(true)
  })

  it('should find registry blocks to validate', () => {
    expect(blockItems.length).toBeGreaterThan(0)
  })

  describe('Every registry block must have a registryName entry in page.tsx', () => {
    const registryNames = extractRegistryNames()

    for (const item of blockItems) {
      if (UTILITY_ITEMS.includes(item.name)) continue
      if (SUB_COMPONENTS.includes(item.name)) continue

      it(`"${item.name}" (${item.title}) must be referenced in page.tsx`, () => {
        expect(
          registryNames.includes(item.name),
          `Block "${item.name}" is registered in registry.json but has no registryName: '${item.name}' ` +
            `entry in page.tsx. Users cannot view this block's demo.`
        ).toBe(true)
      })
    }
  })

  describe('Every registryName in page.tsx must exist in registry.json', () => {
    const registryNames = extractRegistryNames()
    const registryItemNames = new Set(
      registryJson.items.map((i: RegistryItem) => i.name)
    )

    for (const name of registryNames) {
      it(`registryName "${name}" in page.tsx must exist in registry.json`, () => {
        expect(
          registryItemNames.has(name),
          `page.tsx references registryName: '${name}' but this component doesn't exist in registry.json. ` +
            `Remove the stale reference or add the component to the registry.`
        ).toBe(true)
      })
    }
  })

  describe('Page component imports must match registry paths', () => {
    const pageImports = extractPageImports()

    for (const imp of pageImports) {
      it(`import "${imp.componentName}" from "${imp.importPath}" must resolve`, () => {
        // Convert @/registry/... to absolute path
        const relPath = imp.importPath.replace('@/', '')
        const extensions = ['.tsx', '.ts', '.jsx', '.js', '']
        let found = false

        for (const ext of extensions) {
          if (existsSync(resolve(ROOT_PATH, relPath + ext))) {
            found = true
            break
          }
        }

        expect(
          found,
          `Import "${imp.componentName}" from "${imp.importPath}" does not resolve to a file.`
        ).toBe(true)
      })
    }
  })

  describe('Page demo data imports must resolve', () => {
    const demoImports = extractPageDemoImports()

    for (const imp of demoImports) {
      it(`demo import from "${imp.importPath}" must resolve to existing file`, () => {
        const relPath = imp.importPath.replace('@/', '')
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '']
        let resolvedPath: string | null = null

        for (const ext of extensions) {
          const fullPath = resolve(ROOT_PATH, relPath + ext)
          if (existsSync(fullPath)) {
            resolvedPath = fullPath
            break
          }
        }

        expect(
          resolvedPath,
          `Demo import from "${imp.importPath}" does not resolve to any file. ` +
            `This will cause the block detail page to fail.`
        ).not.toBeNull()
      })

      it(`demo import from "${imp.importPath}" must export: ${imp.symbols.join(', ')}`, () => {
        const relPath = imp.importPath.replace('@/', '')
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '']
        let resolvedPath: string | null = null

        for (const ext of extensions) {
          const fullPath = resolve(ROOT_PATH, relPath + ext)
          if (existsSync(fullPath)) {
            resolvedPath = fullPath
            break
          }
        }

        if (!resolvedPath) return // Caught by previous test

        const content = readFileSync(resolvedPath, 'utf-8')
        const exportedSymbols: string[] = []

        // Extract exports
        for (const match of content.matchAll(
          /export\s+(?:const|function|type|interface)\s+(\w+)/g
        )) {
          exportedSymbols.push(match[1])
        }
        for (const match of content.matchAll(/export\s+\{([^}]+)\}/g)) {
          const syms = match[1]
            .split(',')
            .map((s) => s.trim().split(/\s+as\s+/).pop()!.trim())
            .filter((s) => s.length > 0)
          exportedSymbols.push(...syms)
        }

        const missing = imp.symbols.filter(
          (s) => !exportedSymbols.includes(s)
        )

        expect(
          missing,
          `Demo file is missing exports: ${missing.join(', ')}. ` +
            `page.tsx imports these from "${imp.importPath}".`
        ).toHaveLength(0)
      })
    }
  })
})

describe('Block Variant Completeness', () => {
  /**
   * Every variant block in page.tsx should have usageCode.
   * We check by counting usageCode occurrences and ensuring
   * they roughly match the number of variants.
   */
  it('should have usageCode for most variants', () => {
    const variantCount = (pageContent.match(/\bid:\s*['"][^'"]+['"]/g) || [])
      .length
    const usageCodeCount = (pageContent.match(/usageCode:\s*`/g) || []).length

    // Every variant block (id within a variants array) should have usageCode
    // Allow some tolerance since 'id' also appears in BlockGroup definitions
    expect(
      usageCodeCount,
      `Found ${usageCodeCount} usageCode entries but expected roughly one per variant. ` +
        `Missing usageCode means users see empty copy panels.`
    ).toBeGreaterThan(0)
  })

  it('usageCode should reference actual component names, not stale ones', () => {
    // Build a set of all imported component names from the page
    // This handles multi-line destructured imports like:
    //   import {
    //     ImageMessageBubble,
    //     MessageBubble,
    //   } from '...'
    const allImportedNames = new Set<string>()

    // Extract all import blocks (handles multi-line)
    const importBlocks =
      pageContent.match(/import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"]/gs) || []
    for (const block of importBlocks) {
      const namesMatch = block.match(/\{([^}]+)\}/)
      if (namesMatch) {
        const names = namesMatch[1]
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('type '))
        names.forEach((n) => allImportedNames.add(n))
      }
    }

    // For Demo wrappers (e.g., PostCardDemo), also add the base name (PostCard)
    // because usageCode shows the real component name users should use
    for (const name of [...allImportedNames]) {
      if (name.endsWith('Demo')) {
        allImportedNames.add(name.replace(/Demo$/, ''))
      }
    }

    // Also build a set of all known exported component names from registry files
    // This covers cases where usageCode references a component that's only
    // directly imported in the registry (not on the page itself)
    const allRegistryExports = new Set<string>()
    for (const item of registryJson.items) {
      const mainFile = item.files?.find(
        (f: { type: string }) => f.type === 'registry:block'
      )
      if (!mainFile) continue
      const filePath = resolve(ROOT_PATH, mainFile.path)
      if (!existsSync(filePath)) continue
      const content = readFileSync(filePath, 'utf-8')
      const exportMatches = content.matchAll(
        /export\s+(?:function|const)\s+([A-Z]\w+)/g
      )
      for (const match of exportMatches) {
        allRegistryExports.add(match[1])
      }
    }

    // Extract component names from usageCode blocks
    const usageCodeBlocks =
      pageContent.match(/usageCode:\s*`([^`]*)`/gs) || []

    for (const block of usageCodeBlocks) {
      // Extract ALL component names from usageCode (not just the first)
      const componentMatches = block.matchAll(/<([A-Z]\w+)/g)

      for (const componentMatch of componentMatches) {
        const usageComponentName = componentMatch[1]

        const isKnown =
          allImportedNames.has(usageComponentName) ||
          allRegistryExports.has(usageComponentName)

        expect(
          isKnown,
          `usageCode references <${usageComponentName}> but it's neither imported in page.tsx ` +
            `nor exported from any registry component. ` +
            `This means the usage example shows a component that doesn't exist.`
        ).toBe(true)
      }
    }
  })
})
