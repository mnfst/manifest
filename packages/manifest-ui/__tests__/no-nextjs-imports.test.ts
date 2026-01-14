/**
 * No Next.js Imports Test
 *
 * This test ensures that registry components do not use any Next.js-specific imports.
 * The component library should be pure React to allow usage in any React environment,
 * not just Next.js applications.
 *
 * Forbidden imports include:
 * - next/dynamic
 * - next/image
 * - next/link
 * - next/router
 * - next/navigation
 * - Any other 'next/*' import
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { describe, it, expect } from 'vitest'

const REGISTRY_PATH = resolve(__dirname, '..', 'registry')

/**
 * Recursively get all .tsx files in a directory
 */
function getAllTsxFiles(dir: string): string[] {
  const files: string[] = []
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getAllTsxFiles(fullPath))
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Check if a file contains Next.js imports
 */
function findNextJsImports(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const nextImports: string[] = []

  // Patterns to detect Next.js imports
  const nextImportPatterns = [
    /from\s+['"]next\//,
    /import\s+.*\s+from\s+['"]next\//,
    /require\s*\(\s*['"]next\//,
    /import\s*\(\s*['"]next\//,
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const pattern of nextImportPatterns) {
      if (pattern.test(line)) {
        nextImports.push(`Line ${i + 1}: ${line.trim()}`)
        break
      }
    }
  }

  return nextImports
}

describe('No Next.js Imports in Registry Components', () => {
  const tsxFiles = getAllTsxFiles(REGISTRY_PATH)

  it('should find registry component files', () => {
    expect(tsxFiles.length).toBeGreaterThan(0)
  })

  describe('Component files must not import from next/*', () => {
    for (const filePath of tsxFiles) {
      const relativePath = filePath.replace(REGISTRY_PATH, 'registry')

      it(`${relativePath} should not have Next.js imports`, () => {
        const nextImports = findNextJsImports(filePath)

        if (nextImports.length > 0) {
          throw new Error(
            `File "${relativePath}" contains Next.js imports!\n\n` +
              `Found imports:\n${nextImports.map((i) => `  ${i}`).join('\n')}\n\n` +
              `Registry components must be pure React without Next.js dependencies.\n` +
              `This ensures the components can be used in any React environment.\n\n` +
              `Common replacements:\n` +
              `  - next/dynamic → React.lazy() with Suspense, or useEffect-based lazy loading\n` +
              `  - next/image → standard <img> tag\n` +
              `  - next/link → standard <a> tag or react-router Link\n` +
              `  - next/router → window.location or react-router hooks`
          )
        }

        expect(nextImports).toHaveLength(0)
      })
    }
  })

  it('should provide a summary of any Next.js imports found', () => {
    const filesWithNextImports: { file: string; imports: string[] }[] = []

    for (const filePath of tsxFiles) {
      const nextImports = findNextJsImports(filePath)
      if (nextImports.length > 0) {
        filesWithNextImports.push({
          file: filePath.replace(REGISTRY_PATH, 'registry'),
          imports: nextImports,
        })
      }
    }

    if (filesWithNextImports.length > 0) {
      console.log('\n=== Files with Next.js Imports ===')
      for (const { file, imports } of filesWithNextImports) {
        console.log(`\n${file}:`)
        for (const imp of imports) {
          console.log(`  ${imp}`)
        }
      }
    }

    expect(filesWithNextImports).toHaveLength(0)
  })
})
