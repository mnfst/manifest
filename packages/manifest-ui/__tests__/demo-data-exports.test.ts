/**
 * Demo Data Exports Validation Test
 *
 * Prevents regressions where demo data files:
 * - Don't exist at the expected path (causes 404 on GitHub raw URLs)
 * - Don't export the symbols that components actually import
 * - Aren't included in registry.json files array (breaks shadcn CLI distribution)
 *
 * This test catches the specific regression where registry/blogging/demo/data.ts
 * was referenced but the actual file was registry/blogging/demo/blogging.ts.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, relative, dirname, basename } from 'path'
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
  registryDependencies?: string[]
}

const registryJson = JSON.parse(
  readFileSync(resolve(ROOT_PATH, 'registry.json'), 'utf-8')
)
const registryItems: RegistryItem[] = registryJson.items

/**
 * Extract all import paths from a file that reference ./demo/ directories
 */
function extractDemoImports(
  filePath: string
): { importPath: string; symbols: string[]; line: number }[] {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const imports: { importPath: string; symbols: string[]; line: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match imports from ./demo/ paths
    if (!line.includes('/demo/')) continue

    // Match: import { sym1, sym2 } from './demo/category'
    const namedMatch = line.match(
      /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]*\/demo\/[^'"]+)['"]/
    )
    if (namedMatch) {
      const symbols = namedMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      imports.push({ importPath: namedMatch[2], symbols, line: i + 1 })
      continue
    }

    // Match: import DefaultExport from './demo/category'
    const defaultMatch = line.match(
      /import\s+(\w+)\s+from\s+['"]([^'"]*\/demo\/[^'"]+)['"]/
    )
    if (defaultMatch) {
      imports.push({
        importPath: defaultMatch[2],
        symbols: [defaultMatch[1]],
        line: i + 1,
      })
    }
  }

  return imports
}

/**
 * Extract all named export symbols from a file
 */
function extractExportedSymbols(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8')
  const symbols: string[] = []

  // Match: export const symbolName
  const constExports = content.matchAll(/export\s+const\s+(\w+)/g)
  for (const match of constExports) {
    symbols.push(match[1])
  }

  // Match: export function symbolName
  const funcExports = content.matchAll(/export\s+function\s+(\w+)/g)
  for (const match of funcExports) {
    symbols.push(match[1])
  }

  // Match: export type symbolName / export interface symbolName
  const typeExports = content.matchAll(
    /export\s+(?:type|interface)\s+(\w+)/g
  )
  for (const match of typeExports) {
    symbols.push(match[1])
  }

  // Match: export { sym1, sym2 }
  const reExportBlocks = content.matchAll(/export\s+\{([^}]+)\}/g)
  for (const match of reExportBlocks) {
    const syms = match[1]
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/).pop()!.trim())
      .filter((s) => s.length > 0)
    symbols.push(...syms)
  }

  return symbols
}

/**
 * Resolve a demo import path to an absolute file path
 */
function resolveDemoImportPath(
  importPath: string,
  sourceFile: string
): string | null {
  const sourceDir = dirname(sourceFile)
  const resolved = resolve(sourceDir, importPath)

  const extensions = ['.ts', '.tsx', '.js', '.jsx', '']
  for (const ext of extensions) {
    const fullPath = resolved + ext
    if (existsSync(fullPath)) {
      return fullPath
    }
  }

  return null
}

describe('Demo Data Exports Validation', () => {
  const blockItems = registryItems.filter(
    (item) => item.type === 'registry:block'
  )

  it('should find block items to validate', () => {
    expect(blockItems.length).toBeGreaterThan(0)
  })

  describe('Component demo data imports resolve to existing files', () => {
    for (const item of blockItems) {
      const mainFile = item.files.find((f) => f.type === 'registry:block')
      if (!mainFile) continue

      const absPath = resolve(ROOT_PATH, mainFile.path)
      if (!existsSync(absPath)) continue

      const demoImports = extractDemoImports(absPath)
      if (demoImports.length === 0) continue

      describe(`${item.name} (${mainFile.path})`, () => {
        for (const imp of demoImports) {
          it(`demo import "${imp.importPath}" must resolve to an existing file`, () => {
            const resolved = resolveDemoImportPath(imp.importPath, absPath)
            expect(
              resolved,
              `Import "${imp.importPath}" at line ${imp.line} does not resolve to any file. ` +
                `Check that the demo data file exists at the expected path.`
            ).not.toBeNull()
          })

          it(`demo import "${imp.importPath}" must export all imported symbols`, () => {
            const resolved = resolveDemoImportPath(imp.importPath, absPath)
            if (!resolved) return // Already caught by previous test

            const exportedSymbols = extractExportedSymbols(resolved)
            const missingSymbols = imp.symbols.filter(
              (s) => !exportedSymbols.includes(s)
            )

            expect(
              missingSymbols,
              `File "${relative(ROOT_PATH, resolved)}" is missing exports: ${missingSymbols.join(', ')}. ` +
                `Component "${item.name}" imports these at line ${imp.line}.`
            ).toHaveLength(0)
          })
        }
      })
    }
  })

  describe('Demo data files must be included in registry.json for distribution', () => {
    for (const item of blockItems) {
      const mainFile = item.files.find((f) => f.type === 'registry:block')
      if (!mainFile) continue

      const absPath = resolve(ROOT_PATH, mainFile.path)
      if (!existsSync(absPath)) continue

      const demoImports = extractDemoImports(absPath)
      if (demoImports.length === 0) continue

      it(`${item.name}: demo data files must be in registry.json files array`, () => {
        const registryFilePaths = item.files.map((f) => f.path)
        const errors: string[] = []

        for (const imp of demoImports) {
          const resolved = resolveDemoImportPath(imp.importPath, absPath)
          if (!resolved) continue

          const relPath = relative(ROOT_PATH, resolved)

          if (!registryFilePaths.includes(relPath)) {
            errors.push(
              `"${relPath}" is imported by the component but not listed in registry.json files array. ` +
                `Users installing via shadcn CLI will get a broken component.`
            )
          }
        }

        if (errors.length > 0) {
          throw new Error(
            `Component "${item.name}" has demo data files missing from registry.json:\n` +
              errors.map((e) => `  - ${e}`).join('\n')
          )
        }
      })
    }
  })

  describe('Demo data files must export at least one non-type value', () => {
    for (const item of blockItems) {
      const mainFile = item.files.find((f) => f.type === 'registry:block')
      if (!mainFile) continue

      const absPath = resolve(ROOT_PATH, mainFile.path)
      if (!existsSync(absPath)) continue

      const demoImports = extractDemoImports(absPath)
      if (demoImports.length === 0) continue

      for (const imp of demoImports) {
        const resolved = resolveDemoImportPath(imp.importPath, absPath)
        if (!resolved) continue

        const relPath = relative(ROOT_PATH, resolved)

        it(`${relPath} must export value symbols (not just types)`, () => {
          const content = readFileSync(resolved, 'utf-8')

          // Check for at least one value export (const or function, not type/interface)
          const hasValueExport =
            /export\s+const\s+\w+/.test(content) ||
            /export\s+function\s+\w+/.test(content)

          expect(
            hasValueExport,
            `Demo data file "${relPath}" only exports types. ` +
              `It must export at least one const/function for runtime use.`
          ).toBe(true)
        })
      }
    }
  })
})

describe('Demo data file naming follows category convention', () => {
  /**
   * Demo data files MUST be named <category>.ts to match the convention
   * registry/<category>/demo/<category>.ts
   *
   * A file named "data.ts" would cause 404 on GitHub raw URLs when
   * the system expects "<category>.ts".
   */
  const blockItemsForNaming: RegistryItem[] = registryItems.filter(
    (item) => item.type === 'registry:block'
  )

  for (const item of blockItemsForNaming) {
    const mainFile = item.files.find((f) => f.type === 'registry:block')
    if (!mainFile) continue

    // Extract category from path: registry/<category>/component.tsx
    const pathMatch = mainFile.path.match(/^registry\/([^/]+)\//)
    if (!pathMatch) continue
    const category = pathMatch[1]

    const demoFiles = item.files.filter((f) => f.path.includes('/demo/'))
    if (demoFiles.length === 0) continue

    for (const demoFile of demoFiles) {
      it(`${item.name}: demo file "${demoFile.path}" should follow naming convention`, () => {
        const fileName = basename(demoFile.path, '.ts')
        // Demo file should be named after the category
        expect(
          fileName,
          `Demo file "${demoFile.path}" should be named "${category}.ts" (not "${fileName}.ts"). ` +
            `Mismatched naming causes 404 errors on GitHub raw URLs.`
        ).toBe(category)
      })
    }
  }
})
