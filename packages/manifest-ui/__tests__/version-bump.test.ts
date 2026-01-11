/**
 * Version Bump Enforcement Tests
 *
 * These tests ensure that when a block/component file is modified,
 * its version in registry.json must also be updated.
 *
 * This prevents the situation where changes are made to a component
 * without incrementing its version number.
 *
 * Additionally, tests ensure that every version has a corresponding
 * changelog entry in changelog.json.
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const REGISTRY_JSON_PATH = resolve(__dirname, '..', 'registry.json')
const CHANGELOG_JSON_PATH = resolve(__dirname, '..', 'changelog.json')

interface RegistryItem {
  name: string
  version: string
  files: Array<{ path: string }>
}

interface Registry {
  items: RegistryItem[]
}

interface Changelog {
  components: Record<string, Record<string, string>>
}

/**
 * Load the changelog.json file
 */
function loadChangelog(): Changelog {
  if (!existsSync(CHANGELOG_JSON_PATH)) {
    return { components: {} }
  }
  const content = readFileSync(CHANGELOG_JSON_PATH, 'utf-8')
  return JSON.parse(content)
}

/**
 * Get the list of files changed in the current branch compared to base
 */
function getChangedFiles(baseBranch = 'main'): string[] {
  try {
    // Try to get files changed compared to main/master
    const result = execSync(
      `git diff --name-only ${baseBranch}...HEAD 2>/dev/null || git diff --name-only HEAD~1 2>/dev/null || echo ""`,
      { encoding: 'utf-8', cwd: resolve(__dirname, '..') }
    )
    return result
      .split('\n')
      .filter((line) => line.trim().length > 0)
  } catch {
    return []
  }
}

/**
 * Get the previous version of registry.json from git
 */
function getPreviousRegistry(baseBranch = 'main'): Registry | null {
  try {
    const content = execSync(
      `git show ${baseBranch}:packages/manifest-ui/registry.json 2>/dev/null || git show HEAD~1:packages/manifest-ui/registry.json 2>/dev/null`,
      { encoding: 'utf-8', cwd: resolve(__dirname, '../../..') }
    )
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Load the current registry.json
 */
function loadCurrentRegistry(): Registry {
  const content = readFileSync(REGISTRY_JSON_PATH, 'utf-8')
  return JSON.parse(content)
}

/**
 * Build a map of component name to version
 */
function buildVersionMap(registry: Registry): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of registry.items) {
    map.set(item.name, item.version)
  }
  return map
}

/**
 * Build a map of file path to component name
 */
function buildFileToComponentMap(registry: Registry): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of registry.items) {
    for (const file of item.files) {
      // Normalize path - registry files are relative to packages/manifest-ui
      map.set(file.path, item.name)
    }
  }
  return map
}

describe('Version Bump Enforcement', () => {
  const currentRegistry = loadCurrentRegistry()
  const previousRegistry = getPreviousRegistry()
  const changedFiles = getChangedFiles()

  // Skip tests if we can't determine previous state (e.g., initial commit)
  const canCompare = previousRegistry !== null

  it('should be able to load current registry', () => {
    expect(currentRegistry).toBeDefined()
    expect(currentRegistry.items).toBeDefined()
    expect(Array.isArray(currentRegistry.items)).toBe(true)
  })

  describe('Modified components must have version bumps', () => {
    if (!canCompare) {
      it.skip('skipped - no previous registry to compare against', () => {})
      return
    }

    const currentVersions = buildVersionMap(currentRegistry)
    const previousVersions = buildVersionMap(previousRegistry!)
    const fileToComponent = buildFileToComponentMap(currentRegistry)

    // Filter changed files to only registry component files
    const changedComponentFiles = changedFiles.filter(
      (file) =>
        file.startsWith('packages/manifest-ui/registry/') &&
        file.endsWith('.tsx')
    )

    // Get unique component names that have changes
    const modifiedComponents = new Set<string>()
    for (const file of changedComponentFiles) {
      // Extract relative path from packages/manifest-ui/
      const relativePath = file.replace('packages/manifest-ui/', '')
      const componentName = fileToComponent.get(relativePath)
      if (componentName) {
        modifiedComponents.add(componentName)
      }
    }

    if (modifiedComponents.size === 0) {
      it('no component files were modified', () => {
        expect(modifiedComponents.size).toBe(0)
      })
      return
    }

    // Test each modified component
    for (const componentName of modifiedComponents) {
      it(`"${componentName}" was modified and should have version bump`, () => {
        const previousVersion = previousVersions.get(componentName)
        const currentVersion = currentVersions.get(componentName)

        // New components don't need version comparison
        if (!previousVersion) {
          expect(currentVersion).toBeDefined()
          return
        }

        expect(currentVersion).toBeDefined()

        // Parse versions
        const [prevMajor, prevMinor, prevPatch] = previousVersion
          .split('.')
          .map(Number)
        const [currMajor, currMinor, currPatch] = currentVersion!
          .split('.')
          .map(Number)

        const previousTotal = prevMajor * 10000 + prevMinor * 100 + prevPatch
        const currentTotal = currMajor * 10000 + currMinor * 100 + currPatch

        const versionBumped = currentTotal > previousTotal

        if (!versionBumped) {
          throw new Error(
            `Component "${componentName}" was modified but version was not bumped!\n` +
              `  Previous version: ${previousVersion}\n` +
              `  Current version: ${currentVersion}\n` +
              `  Modified files: ${changedComponentFiles
                .filter((f) => {
                  const rel = f.replace('packages/manifest-ui/', '')
                  return fileToComponent.get(rel) === componentName
                })
                .join(', ')}\n\n` +
              `Please bump the version in registry.json for this component.\n` +
              `Use semantic versioning:\n` +
              `  - PATCH (x.y.Z): Bug fixes, minor improvements\n` +
              `  - MINOR (x.Y.z): New features, backward-compatible changes\n` +
              `  - MAJOR (X.y.z): Breaking changes`
          )
        }

        expect(versionBumped).toBe(true)
      })
    }
  })

  describe('Summary of changes', () => {
    it('should report what components would need version bumps', () => {
      if (!canCompare) {
        console.log('No previous registry to compare against')
        return
      }

      const fileToComponent = buildFileToComponentMap(currentRegistry)
      const changedComponentFiles = changedFiles.filter(
        (file) =>
          file.startsWith('packages/manifest-ui/registry/') &&
          file.endsWith('.tsx')
      )

      if (changedComponentFiles.length > 0) {
        console.log('\n=== Changed Component Files ===')
        for (const file of changedComponentFiles) {
          const relativePath = file.replace('packages/manifest-ui/', '')
          const componentName = fileToComponent.get(relativePath) || 'unknown'
          console.log(`  ${file} (component: ${componentName})`)
        }
      }

      expect(true).toBe(true)
    })
  })

  describe('Changelog entries must exist for all versions', () => {
    const changelog = loadChangelog()

    for (const item of currentRegistry.items) {
      const { name, version } = item
      const componentChangelog = changelog.components[name]

      it(`"${name}" v${version} should have a changelog entry`, () => {
        expect(componentChangelog).toBeDefined()
        expect(componentChangelog[version]).toBeDefined()
        expect(typeof componentChangelog[version]).toBe('string')
        expect(componentChangelog[version].length).toBeGreaterThan(0)
      })
    }
  })
})

/**
 * Export utility for use in pre-commit hooks
 */
export function checkVersionBumps(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  try {
    const currentRegistry = loadCurrentRegistry()
    const previousRegistry = getPreviousRegistry()

    if (!previousRegistry) {
      return { valid: true, errors: [] }
    }

    const currentVersions = buildVersionMap(currentRegistry)
    const previousVersions = buildVersionMap(previousRegistry)
    const fileToComponent = buildFileToComponentMap(currentRegistry)
    const changedFiles = getChangedFiles()

    const changedComponentFiles = changedFiles.filter(
      (file) =>
        file.startsWith('packages/manifest-ui/registry/') &&
        file.endsWith('.tsx')
    )

    for (const file of changedComponentFiles) {
      const relativePath = file.replace('packages/manifest-ui/', '')
      const componentName = fileToComponent.get(relativePath)

      if (!componentName) continue

      const previousVersion = previousVersions.get(componentName)
      const currentVersion = currentVersions.get(componentName)

      if (!previousVersion || !currentVersion) continue

      const [prevMajor, prevMinor, prevPatch] = previousVersion
        .split('.')
        .map(Number)
      const [currMajor, currMinor, currPatch] = currentVersion
        .split('.')
        .map(Number)

      const previousTotal = prevMajor * 10000 + prevMinor * 100 + prevPatch
      const currentTotal = currMajor * 10000 + currMinor * 100 + currPatch

      if (currentTotal <= previousTotal) {
        errors.push(
          `${componentName}: modified but version not bumped (${previousVersion} -> ${currentVersion})`
        )
      }
    }

    return { valid: errors.length === 0, errors }
  } catch {
    return { valid: true, errors: [] } // Don't block on errors
  }
}
