/**
 * Preview Components Import Consistency Test
 *
 * Validates that lib/preview-components.tsx:
 * - Imports demo data from the correct centralized demo files
 * - References symbols that actually exist in the demo files
 * - Imports components that match registry.json entries
 * - Does not reference renamed or removed components
 *
 * This prevents regressions where preview images break silently
 * because demo data imports point to wrong files or missing exports.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, relative } from 'path'
import { describe, it, expect } from 'vitest'

const ROOT_PATH = resolve(__dirname, '..')
const PREVIEW_PATH = resolve(ROOT_PATH, 'lib', 'preview-components.tsx')
const REGISTRY_JSON_PATH = resolve(ROOT_PATH, 'registry.json')

const previewContent = existsSync(PREVIEW_PATH)
  ? readFileSync(PREVIEW_PATH, 'utf-8')
  : ''

const registryJson = JSON.parse(
  readFileSync(REGISTRY_JSON_PATH, 'utf-8')
)

interface ImportInfo {
  symbols: string[]
  importPath: string
  line: number
}

/**
 * Extract all imports from preview-components.tsx
 */
function extractAllImports(): ImportInfo[] {
  const lines = previewContent.split('\n')
  const imports: ImportInfo[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const match = line.match(
      /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/
    )
    if (match) {
      const symbols = match[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('type '))
      imports.push({ symbols, importPath: match[2], line: i + 1 })
    }
  }

  return imports
}

/**
 * Extract exported symbols from a file
 */
function extractExports(filePath: string): string[] {
  if (!existsSync(filePath)) return []
  const content = readFileSync(filePath, 'utf-8')
  const symbols: string[] = []

  for (const match of content.matchAll(
    /export\s+(?:const|function|class|type|interface)\s+(\w+)/g
  )) {
    symbols.push(match[1])
  }
  for (const match of content.matchAll(/export\s+\{([^}]+)\}/g)) {
    const syms = match[1]
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/).pop()!.trim())
      .filter((s) => s.length > 0)
    symbols.push(...syms)
  }
  for (const match of content.matchAll(
    /export\s+default\s+(?:function|class)\s+(\w+)/g
  )) {
    symbols.push(match[1])
  }

  return symbols
}

describe('Preview Components Import Consistency', () => {
  it('preview-components.tsx should exist', () => {
    expect(existsSync(PREVIEW_PATH)).toBe(true)
  })

  describe('All @/registry/ imports must resolve to existing files', () => {
    const imports = extractAllImports().filter((i) =>
      i.importPath.startsWith('@/registry/')
    )

    for (const imp of imports) {
      it(`import from "${imp.importPath}" (line ${imp.line}) must resolve`, () => {
        const relPath = imp.importPath.replace('@/', '')
        const extensions = ['.tsx', '.ts', '.js', '.jsx', '']
        let found = false

        for (const ext of extensions) {
          if (existsSync(resolve(ROOT_PATH, relPath + ext))) {
            found = true
            break
          }
        }

        expect(
          found,
          `Import from "${imp.importPath}" at line ${imp.line} does not resolve. ` +
            `Preview generation will fail for components using these imports.`
        ).toBe(true)
      })
    }
  })

  describe('All imported symbols must be exported by their source files', () => {
    const imports = extractAllImports().filter((i) =>
      i.importPath.startsWith('@/registry/')
    )

    for (const imp of imports) {
      const relPath = imp.importPath.replace('@/', '')
      const extensions = ['.tsx', '.ts', '.js', '.jsx', '']
      let resolvedPath: string | null = null

      for (const ext of extensions) {
        const fullPath = resolve(ROOT_PATH, relPath + ext)
        if (existsSync(fullPath)) {
          resolvedPath = fullPath
          break
        }
      }

      if (!resolvedPath) continue

      it(`symbols ${imp.symbols.join(', ')} must be exported by ${relative(ROOT_PATH, resolvedPath)}`, () => {
        const exports = extractExports(resolvedPath!)
        const missing = imp.symbols.filter((s) => !exports.includes(s))

        expect(
          missing,
          `preview-components.tsx imports { ${missing.join(', ')} } from "${imp.importPath}" ` +
            `but these are not exported. Check for renamed or removed exports.`
        ).toHaveLength(0)
      })
    }
  })

  describe('Preview component keys must match registry.json names', () => {
    // Extract the keys from previewComponents map
    const keyMatches =
      previewContent.matchAll(/['"]([a-z][a-z0-9-]+)['"]\s*:\s*\{/g) || []
    const previewKeys = [...keyMatches].map((m) => m[1])
    const registryNames = new Set(
      registryJson.items.map((i: { name: string }) => i.name)
    )

    for (const key of previewKeys) {
      it(`preview key "${key}" must exist in registry.json`, () => {
        expect(
          registryNames.has(key),
          `preview-components.tsx has entry for "${key}" but this component ` +
            `doesn't exist in registry.json. Remove stale preview entries.`
        ).toBe(true)
      })
    }
  })

  describe('Demo data imports use centralized demo files (not inline)', () => {
    const demoImports = extractAllImports().filter((i) =>
      i.importPath.includes('/demo/')
    )

    for (const imp of demoImports) {
      it(`demo import "${imp.importPath}" follows centralized pattern`, () => {
        // Must be from @/registry/<category>/demo/<category>
        const match = imp.importPath.match(
          /^@\/registry\/([^/]+)\/demo\/([^/]+)$/
        )

        expect(
          match,
          `Demo import "${imp.importPath}" doesn't follow the pattern ` +
            `@/registry/<category>/demo/<category>. ` +
            `This can cause 404 errors on GitHub raw URLs.`
        ).not.toBeNull()

        if (match) {
          expect(
            match[1],
            `Demo file name "${match[2]}" doesn't match category "${match[1]}". ` +
              `File should be named "${match[1]}.ts".`
          ).toBe(match[2])
        }
      })
    }
  })
})
