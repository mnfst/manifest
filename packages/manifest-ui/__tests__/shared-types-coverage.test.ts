/**
 * Shared Types Coverage Test
 *
 * Validates that every named import from './types' or '../types' in registry
 * files actually exists as an export in registry/shared-types.ts.
 *
 * This prevents the scenario where a component imports a type that exists in
 * a local types.ts file but is missing from the shared types file that gets
 * installed as components/ui/types.ts via the manifest-types registry item.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve, relative } from 'path'
import { describe, it, expect } from 'vitest'

const ROOT_PATH = resolve(__dirname, '..')
const REGISTRY_PATH = resolve(ROOT_PATH, 'registry')
const SHARED_TYPES_PATH = resolve(REGISTRY_PATH, 'shared-types.ts')

/**
 * Get all exported names from shared-types.ts
 */
function getSharedTypeExports(): Set<string> {
  const content = readFileSync(SHARED_TYPES_PATH, 'utf-8')
  const exports = new Set<string>()

  // Match: export interface Name
  // Match: export type Name
  // Match: export enum Name
  // Match: export const Name
  // Match: export function Name
  const exportRegex = /^export\s+(?:interface|type|enum|const|function)\s+(\w+)/gm
  let match: RegExpExecArray | null
  while ((match = exportRegex.exec(content)) !== null) {
    exports.add(match[1])
  }

  return exports
}

/**
 * Extract named imports from types paths in a file
 */
function extractTypesImports(
  filePath: string
): { names: string[]; line: number; importPath: string }[] {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const results: { names: string[]; line: number; importPath: string }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match imports from ./types or ../types (with optional type keyword)
    const match = line.match(
      /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"](\.\.\?\/types|\.\/types)['"]/
    )
    if (!match) continue

    const namesStr = match[1]
    const importPath = match[2]
    const names = namesStr
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0)
      // Handle `type X` inside import { type X, Y }
      .map((n) => n.replace(/^type\s+/, ''))

    results.push({ names, line: i + 1, importPath })
  }

  return results
}

/**
 * Get all .ts/.tsx files recursively in a directory
 */
function getAllFiles(dir: string): string[] {
  const files: string[] = []
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath))
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(fullPath)
    }
  }

  return files
}

describe('Shared Types Coverage', () => {
  const sharedExports = getSharedTypeExports()
  const allFiles = getAllFiles(REGISTRY_PATH).filter(
    (f) => !f.endsWith('shared-types.ts')
  )

  it('should have exports in shared-types.ts', () => {
    expect(sharedExports.size).toBeGreaterThan(0)
  })

  for (const absPath of allFiles) {
    const relPath = relative(ROOT_PATH, absPath)
    const imports = extractTypesImports(absPath)

    if (imports.length === 0) continue

    it(`${relPath} — all types imports exist in shared-types.ts`, () => {
      const errors: string[] = []

      for (const imp of imports) {
        for (const name of imp.names) {
          if (!sharedExports.has(name)) {
            errors.push(
              `"${name}" is imported from '${imp.importPath}' at line ${imp.line} but is not exported from shared-types.ts`
            )
          }
        }
      }

      if (errors.length > 0) {
        throw new Error(
          `File "${relPath}" imports types not found in shared-types.ts:\n\n` +
            errors.map((e) => `  ${e}`).join('\n') +
            '\n\n' +
            'When a component is installed via shadcn CLI, imports from ./types or ../types\n' +
            'resolve to components/ui/types.ts (shared-types.ts). Every named import must\n' +
            'be exported from registry/shared-types.ts.'
        )
      }

      expect(errors).toHaveLength(0)
    })
  }
})
