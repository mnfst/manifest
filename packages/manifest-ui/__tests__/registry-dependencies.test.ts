/**
 * Registry Dependencies Accuracy Tests
 *
 * Ensures that registryDependencies in registry.json exactly match
 * the actual @/components/ui/* imports in each component's source files.
 *
 * - Missing deps break `npx shadcn@latest add` installation
 * - Extra deps bloat the install with unused packages
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT_DIR = resolve(__dirname, '..')
const REGISTRY_JSON_PATH = resolve(ROOT_DIR, 'registry.json')

interface RegistryFile {
  path: string
  type: string
}

interface RegistryItem {
  name: string
  registryDependencies?: string[]
  files: RegistryFile[]
}

interface Registry {
  items: RegistryItem[]
}

/**
 * Extract all @/components/ui/<name> imports from a TypeScript file.
 * Handles both single-line and multi-line import statements.
 */
function extractUiImports(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8')
  const imports = new Set<string>()

  // Match: from '@/components/ui/<name>' or from "@/components/ui/<name>"
  const regex = /from\s+['"]@\/components\/ui\/([^'"]+)['"]/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    imports.add(match[1])
  }

  return [...imports].sort()
}

function loadRegistry(): Registry {
  const content = readFileSync(REGISTRY_JSON_PATH, 'utf-8')
  return JSON.parse(content) as Registry
}

describe('Registry Dependencies Accuracy', () => {
  const registry = loadRegistry()

  for (const item of registry.items) {
    describe(`${item.name}`, () => {
      it('should declare exactly the shadcn UI primitives it imports', () => {
        // Collect all @/components/ui/* imports from all .tsx files
        const allImports = new Set<string>()

        for (const file of item.files) {
          if (!file.path.endsWith('.tsx')) continue

          const fullPath = resolve(ROOT_DIR, file.path)
          const imports = extractUiImports(fullPath)
          for (const imp of imports) {
            allImports.add(imp)
          }
        }

        // Filter registryDependencies to only shadcn UI primitives
        // Exclude URLs and manifest-types (shared types provided via registry dependency)
        const declared = (item.registryDependencies ?? [])
          .filter((dep) => !dep.includes('/') && dep !== 'manifest-types')
          .sort()

        const actual = [...allImports].sort()

        const missing = actual.filter((imp) => !declared.includes(imp))
        const extra = declared.filter((dep) => !actual.includes(dep))

        if (missing.length > 0) {
          throw new Error(
            `Component "${item.name}" imports ${missing.map((m) => `"${m}"`).join(', ')} ` +
              `from @/components/ui/ but they are NOT in registryDependencies. ` +
              `This breaks \`npx shadcn@latest add\` installation.`
          )
        }

        if (extra.length > 0) {
          throw new Error(
            `Component "${item.name}" declares ${extra.map((e) => `"${e}"`).join(', ')} ` +
              `in registryDependencies but does NOT import them. ` +
              `Remove unused dependencies to avoid bloating installations.`
          )
        }

        expect(actual).toEqual(declared)
      })
    })
  }
})
