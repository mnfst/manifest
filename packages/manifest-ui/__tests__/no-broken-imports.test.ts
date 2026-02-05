/**
 * No Broken Imports Test
 *
 * Validates that every import in registry components resolves to either:
 * 1. A file included in the component's `files` array in registry.json
 * 2. A standard shadcn path (@/components/ui/*, @/lib/utils)
 * 3. An npm package (no ./, ../, or @/ prefix — or listed in dependencies)
 * 4. A relative sibling included in the component's files or transitively
 *    via registryDependencies
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join, resolve, dirname, relative } from 'path'
import { describe, it, expect } from 'vitest'

const ROOT_PATH = resolve(__dirname, '..')
const REGISTRY_PATH = resolve(ROOT_PATH, 'registry')

interface RegistryItem {
  name: string
  files: { path: string; type: string; target: string }[]
  dependencies?: string[]
  registryDependencies?: string[]
}

// Load registry.json
const registryJson = JSON.parse(
  readFileSync(resolve(ROOT_PATH, 'registry.json'), 'utf-8')
)
const registryItems: RegistryItem[] = registryJson.items

// Standard shadcn paths that are always available
const STANDARD_SHADCN_PATHS = [
  '@/components/ui/',
  '@/lib/utils',
  '@/hooks/',
]

/**
 * Extract all import paths from a TypeScript/TSX file
 */
function extractImports(filePath: string): { path: string; line: number }[] {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const imports: { path: string; line: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match: import ... from 'path'
    // Match: import 'path' (side-effect imports)
    // Match: import type ... from 'path'
    const importMatch = line.match(
      /(?:import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"])/
    )
    if (importMatch) {
      imports.push({ path: importMatch[1], line: i + 1 })
    }

    // Match: require('path')
    const requireMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/)
    if (requireMatch) {
      imports.push({ path: requireMatch[1], line: i + 1 })
    }
  }

  return imports
}

/**
 * Check if an import path is a standard shadcn path
 */
function isShadcnPath(importPath: string): boolean {
  return STANDARD_SHADCN_PATHS.some((prefix) => importPath.startsWith(prefix))
}

/**
 * Check if an import path is an npm package (not a relative or alias import)
 */
function isNpmPackage(importPath: string): boolean {
  // Relative imports start with . or ..
  if (importPath.startsWith('.')) return false
  // Alias imports start with @/ (project alias)
  if (importPath.startsWith('@/')) return false
  // Everything else is an npm package (including @scope/package)
  return true
}

/**
 * Collect all files from a registry item and its registryDependencies (transitive)
 */
function collectAllFiles(
  itemName: string,
  visited = new Set<string>()
): string[] {
  if (visited.has(itemName)) return []
  visited.add(itemName)

  const item = registryItems.find((i) => i.name === itemName)
  if (!item) return []

  const files = item.files.map((f) => f.path)

  // Resolve registry dependencies (including URL-based ones)
  for (const dep of item.registryDependencies ?? []) {
    let depName = dep
    // Extract component name from URL: https://ui.manifest.build/r/event-card.json -> event-card
    if (dep.startsWith('http')) {
      const urlMatch = dep.match(/\/r\/([^.]+)\.json$/)
      if (urlMatch) {
        depName = urlMatch[1]
      } else {
        continue
      }
    }
    files.push(...collectAllFiles(depName, visited))
  }

  return files
}

/**
 * Resolve a relative import to a registry file path
 */
function resolveRelativeImport(
  importPath: string,
  sourceFile: string
): string | null {
  const sourceDir = dirname(sourceFile)
  const resolved = join(sourceDir, importPath)

  // Try with common extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx']
  for (const ext of extensions) {
    const fullPath = resolved + ext
    if (existsSync(resolve(ROOT_PATH, fullPath))) {
      return fullPath
    }
  }

  // Try as directory with index file
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    const indexPath = join(resolved, `index${ext}`)
    if (existsSync(resolve(ROOT_PATH, indexPath))) {
      return indexPath
    }
  }

  return null
}

/**
 * Get all .tsx/.ts files recursively
 */
function getAllRegistryFiles(dir: string): string[] {
  const files: string[] = []
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getAllRegistryFiles(fullPath))
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

describe('No Broken Imports in Registry Components', () => {
  // Build a map: registry file path -> list of registry items that include it
  const fileToItems = new Map<string, RegistryItem[]>()
  for (const item of registryItems) {
    for (const file of item.files) {
      const existing = fileToItems.get(file.path) ?? []
      existing.push(item)
      fileToItems.set(file.path, existing)
    }
  }

  const allRegistryFiles = getAllRegistryFiles(REGISTRY_PATH)

  it('should find registry files', () => {
    expect(allRegistryFiles.length).toBeGreaterThan(0)
  })

  for (const absFilePath of allRegistryFiles) {
    const relPath = relative(ROOT_PATH, absFilePath)

    // Find which registry items include this file
    const ownerItems = fileToItems.get(relPath) ?? []

    it(`${relPath} should have all imports resolvable`, () => {
      const imports = extractImports(absFilePath)
      const errors: string[] = []

      for (const imp of imports) {
        // Skip npm packages
        if (isNpmPackage(imp.path)) continue

        // Skip standard shadcn paths
        if (isShadcnPath(imp.path)) continue

        // For @/ imports that aren't standard shadcn paths, check if they resolve
        if (imp.path.startsWith('@/')) {
          // Convert @/ to project root path
          const resolvedPath = imp.path.replace('@/', '')

          // Check if the file exists at the resolved path
          const extensions = ['', '.ts', '.tsx', '.js', '.jsx']
          let found = false
          for (const ext of extensions) {
            if (existsSync(resolve(ROOT_PATH, resolvedPath + ext))) {
              // File exists locally but check if it's in the registry distribution
              const registryPath = resolvedPath + ext
              // If it's under registry/, it should be in the files array
              if (registryPath.startsWith('registry/')) {
                for (const ownerItem of ownerItems) {
                  const allFiles = collectAllFiles(ownerItem.name)
                  if (allFiles.includes(registryPath)) {
                    found = true
                    break
                  }
                }
              } else {
                // Non-registry @/ paths (like @/lib/something) that aren't standard
                // These will break when distributed via shadcn
                errors.push(
                  `Line ${imp.line}: "${imp.path}" is a non-standard @/ import that won't be available when installed via shadcn CLI`
                )
                found = true // prevent double-reporting
              }
              if (found) break
            }
          }

          if (!found) {
            errors.push(
              `Line ${imp.line}: "${imp.path}" is a non-standard @/ import that won't be available when installed via shadcn CLI`
            )
          }
          continue
        }

        // Relative imports: check they resolve to a file in the registry
        if (imp.path.startsWith('.')) {
          const resolvedFile = resolveRelativeImport(imp.path, relPath)

          if (!resolvedFile) {
            errors.push(
              `Line ${imp.line}: "${imp.path}" does not resolve to any file`
            )
            continue
          }

          // Check if the resolved file is in the registry for at least one owner item
          if (ownerItems.length > 0) {
            let inRegistry = false
            for (const ownerItem of ownerItems) {
              const allFiles = collectAllFiles(ownerItem.name)
              if (allFiles.includes(resolvedFile)) {
                inRegistry = true
                break
              }
            }

            if (!inRegistry) {
              // Check if the import is for types provided by manifest-types via registryDependencies.
              // Components import from './types' (resolving to category types.ts locally),
              // but at install time manifest-types provides components/ui/types.ts.
              const isTypesImport = resolvedFile.endsWith('/types.ts')
              const hasManifestTypesDep = ownerItems.some((oi) =>
                oi.registryDependencies?.includes('manifest-types') ||
                oi.registryDependencies?.includes('https://ui.manifest.build/r/manifest-types.json')
              )

              if (!(isTypesImport && hasManifestTypesDep)) {
                errors.push(
                  `Line ${imp.line}: "${imp.path}" resolves to "${resolvedFile}" which is not included in the registry files for any owning component (${ownerItems.map((i) => i.name).join(', ')})`
                )
              }
            }
          }
        }
      }

      if (errors.length > 0) {
        throw new Error(
          `File "${relPath}" has broken imports:\n\n` +
            errors.map((e) => `  ${e}`).join('\n') +
            '\n\n' +
            'Registry components must only import from:\n' +
            '  1. Files included in the component\'s "files" array in registry.json\n' +
            '  2. Standard shadcn paths (@/components/ui/*, @/lib/utils)\n' +
            '  3. npm packages listed in dependencies\n' +
            '  4. Relative siblings that are in the registry files array'
        )
      }

      expect(errors).toHaveLength(0)
    })
  }
})
