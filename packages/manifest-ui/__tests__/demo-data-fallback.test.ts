/**
 * Demo Data Fallback Pattern Test
 *
 * Validates that components importing from ./demo/data follow the correct pattern:
 * 1. The demo/data.ts file must be included in the component's files array in registry.json
 * 2. Components must use demo data as a fallback (e.g., data?.event ?? demoEvent)
 * 3. The fallback must use nullish coalescing (??) so explicitly passed data always wins
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve, relative } from 'path'
import { describe, it, expect } from 'vitest'

const ROOT_PATH = resolve(__dirname, '..')
const REGISTRY_PATH = resolve(ROOT_PATH, 'registry')

interface RegistryItem {
  name: string
  files: { path: string; type: string; target: string }[]
}

const registryJson = JSON.parse(
  readFileSync(resolve(ROOT_PATH, 'registry.json'), 'utf-8')
)
const registryItems: RegistryItem[] = registryJson.items

/**
 * Get all .tsx/.ts files recursively
 */
function getAllFiles(dir: string): string[] {
  const files: string[] = []
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath))
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Check if a file imports from ./demo/data
 */
function importsDemoData(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8')
  return /from\s+['"]\.\/demo\/data['"]/.test(content)
}

/**
 * Extract demo data import names from a file
 */
function getDemoImportNames(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8')
  const match = content.match(
    /import\s+\{([^}]+)\}\s+from\s+['"]\.\/demo\/data['"]/
  )
  if (!match) return []
  return match[1].split(',').map((s) => s.trim()).filter(Boolean)
}

/**
 * Check if demo data is used as a fallback with nullish coalescing
 */
function usesFallbackPattern(filePath: string, importNames: string[]): { valid: boolean; issues: string[] } {
  const content = readFileSync(filePath, 'utf-8')
  const issues: string[] = []

  for (const name of importNames) {
    // Check that the imported name is used somewhere with ?? operator
    const usagePattern = new RegExp(`\\?\\?\\s*${name}\\b`)
    if (!usagePattern.test(content)) {
      issues.push(
        `Imported "${name}" from demo/data but it's not used as a fallback with ?? (nullish coalescing)`
      )
    }
  }

  return { valid: issues.length === 0, issues }
}

describe('Demo Data Fallback Pattern', () => {
  // Find all component files (not demo/data.ts itself) that import from ./demo/data
  const allFiles = getAllFiles(REGISTRY_PATH)
  const componentFiles = allFiles.filter((f) => {
    const rel = relative(REGISTRY_PATH, f)
    // Skip demo data files themselves
    if (rel.includes('demo/data')) return false
    return importsDemoData(f)
  })

  it('should find components that import demo data', () => {
    expect(componentFiles.length).toBeGreaterThan(0)
  })

  // Build file-to-items map
  const fileToItems = new Map<string, RegistryItem[]>()
  for (const item of registryItems) {
    for (const file of item.files) {
      const existing = fileToItems.get(file.path) ?? []
      existing.push(item)
      fileToItems.set(file.path, existing)
    }
  }

  describe('Components importing demo data must include demo/data.ts in registry', () => {
    for (const absPath of componentFiles) {
      const relPath = relative(ROOT_PATH, absPath)
      const displayPath = relPath

      it(`${displayPath} must have demo/data.ts in its registry files`, () => {
        const ownerItems = fileToItems.get(relPath) ?? []
        const errors: string[] = []

        if (ownerItems.length === 0) {
          // File not in any registry item - skip this check
          return
        }

        for (const item of ownerItems) {
          const filePaths = item.files.map((f) => f.path)
          // Determine the category directory from the component file path
          // e.g., registry/events/event-card.tsx -> registry/events/demo/data.ts
          const parts = relPath.split('/')
          const categoryIndex = parts.indexOf('registry') + 1
          if (categoryIndex < parts.length) {
            const category = parts[categoryIndex]
            const demoDataPath = `registry/${category}/demo/data.ts`
            if (!filePaths.includes(demoDataPath)) {
              errors.push(
                `Component "${item.name}" imports from ./demo/data but "${demoDataPath}" is not in its files array in registry.json`
              )
            }
          }
        }

        if (errors.length > 0) {
          throw new Error(errors.join('\n'))
        }

        expect(errors).toHaveLength(0)
      })
    }
  })

  describe('Demo data must be used as fallback with nullish coalescing (??)', () => {
    for (const absPath of componentFiles) {
      const relPath = relative(ROOT_PATH, absPath)

      it(`${relPath} must use demo data with ?? fallback`, () => {
        const importNames = getDemoImportNames(absPath)
        if (importNames.length === 0) return

        const { issues } = usesFallbackPattern(absPath, importNames)

        if (issues.length > 0) {
          throw new Error(
            `File "${relPath}" has demo data fallback issues:\n\n` +
              issues.map((i) => `  ${i}`).join('\n') +
              '\n\n' +
              'Components importing demo data should use the pattern:\n' +
              '  const event = data?.event ?? demoEvent\n' +
              'This ensures explicitly passed data always wins over demo defaults.'
          )
        }

        expect(issues).toHaveLength(0)
      })
    }
  })
})
