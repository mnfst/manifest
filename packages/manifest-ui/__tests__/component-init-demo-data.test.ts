/**
 * Component Demo Data Initialization Test
 *
 * Ensures every registered block with a `data?` prop uses the `resolved`
 * initialization pattern:
 *   const resolved: NonNullable<Props['data']> = data ?? demoData
 *
 * This guarantees components render meaningful content when called without
 * arguments (e.g. `<Component />`), which is required for MCP Jam previews
 * and zero-config usage.
 *
 * Components without a `data?` prop (e.g. utility libs, types-only files)
 * are excluded automatically.
 */

import { readFileSync } from 'fs'
import { resolve, relative } from 'path'
import { describe, it, expect } from 'vitest'

const ROOT_PATH = resolve(__dirname, '..')

interface RegistryFile {
  path: string
  type: string
  target: string
}

interface RegistryItem {
  name: string
  type: string
  files: RegistryFile[]
}

/**
 * Read registry.json and return only `registry:block` items
 * (excluding libs, types, and shared utilities).
 */
function getRegisteredBlocks(): RegistryItem[] {
  const registryJson = JSON.parse(
    readFileSync(resolve(ROOT_PATH, 'registry.json'), 'utf-8')
  )
  return registryJson.items.filter(
    (item: RegistryItem) => item.type === 'registry:block'
  )
}

/**
 * Find the main .tsx block file for a registry item.
 * The main file is the first `registry:block` typed file.
 */
function getMainBlockFile(item: RegistryItem): string | null {
  const blockFile = item.files.find((f) => f.type === 'registry:block')
  return blockFile ? blockFile.path : null
}

/**
 * Check if a component file has a `data?` prop in its Props interface.
 */
function hasDataProp(content: string): boolean {
  // Match interfaces with data?: { ... } pattern
  return /interface\s+\w+Props\s*\{[^}]*\bdata\?:/s.test(content)
}

/**
 * Extract the category from a registry file path.
 * e.g. "registry/form/contact-form.tsx" -> "form"
 */
function getCategoryFromPath(filePath: string): string | null {
  const match = filePath.match(/^registry\/([^/]+)\//)
  return match ? match[1] : null
}

describe('Component Demo Data Initialization', () => {
  const blocks = getRegisteredBlocks()

  it('should find registered blocks to check', () => {
    expect(blocks.length).toBeGreaterThan(0)
  })

  for (const block of blocks) {
    const mainFile = getMainBlockFile(block)
    if (!mainFile) continue

    const absPath = resolve(ROOT_PATH, mainFile)
    let content: string
    try {
      content = readFileSync(absPath, 'utf-8')
    } catch {
      continue
    }

    // Skip components without a data? prop
    if (!hasDataProp(content)) continue

    const category = getCategoryFromPath(mainFile)
    const relPath = relative(ROOT_PATH, absPath)

    describe(`${block.name} (${relPath})`, () => {
      it('must import demo data from ./demo/<category>', () => {
        const importPattern = new RegExp(
          `from\\s+['"]\\./demo/${category}['"]`
        )
        expect(content).toMatch(importPattern)
      })

      it('must use data ?? demo fallback pattern', () => {
        // Match: data ?? demo<Something> or data ?? { ... demo<Something> }
        const fallbackPattern = /=\s*data\s*\?\?\s*(?:demo\w+|\{[^}]*demo\w+)/
        expect(content).toMatch(fallbackPattern)
      })
    })
  }
})
