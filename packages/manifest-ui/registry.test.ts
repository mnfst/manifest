import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Semver regex pattern: MAJOR.MINOR.PATCH where each is a non-negative integer
const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

interface RegistryFile {
  path: string
  type: string
  target?: string
}

interface RegistryMeta {
  preview?: string
  version?: string
  changelog?: Record<string, string>
}

interface RegistryItem {
  name: string
  type: string
  title: string
  description: string
  author?: string
  categories?: string[]
  meta?: RegistryMeta
  dependencies?: string[]
  devDependencies?: string[]
  registryDependencies?: string[]
  files: RegistryFile[]
}

interface Registry {
  $schema: string
  name: string
  homepage: string
  items: RegistryItem[]
}

/**
 * Helper to get version from registry item (now in meta.version)
 */
function getVersion(item: RegistryItem): string | undefined {
  return item.meta?.version
}

function loadRegistry(): Registry {
  const registryPath = resolve(__dirname, 'registry.json')
  const content = readFileSync(registryPath, 'utf-8')
  return JSON.parse(content) as Registry
}

describe('Registry Component Versioning', () => {
  const registry = loadRegistry()

  describe('Version field presence', () => {
    it('all components should have a version field', () => {
      const componentsWithoutVersion = registry.items
        .filter((item) => item.type === 'registry:block')
        .filter((item) => !getVersion(item))

      if (componentsWithoutVersion.length > 0) {
        const names = componentsWithoutVersion.map((c) => c.name).join(', ')
        throw new Error(`Components missing version field: ${names}`)
      }

      expect(componentsWithoutVersion).toHaveLength(0)
    })
  })

  describe('Version format validation', () => {
    it('all versions should follow semver format (MAJOR.MINOR.PATCH)', () => {
      const invalidVersions: { name: string; version: string }[] = []

      for (const item of registry.items) {
        const version = getVersion(item)
        if (version && !SEMVER_REGEX.test(version)) {
          invalidVersions.push({ name: item.name, version: version })
        }
      }

      if (invalidVersions.length > 0) {
        const details = invalidVersions
          .map((v) => `${v.name}: "${v.version}"`)
          .join(', ')
        throw new Error(`Invalid version format (expected X.Y.Z): ${details}`)
      }

      expect(invalidVersions).toHaveLength(0)
    })

    it('version numbers should be non-negative integers', () => {
      for (const item of registry.items) {
        const version = getVersion(item)
        if (!version) continue

        const parts = version.split('.')
        expect(parts).toHaveLength(3)

        for (const part of parts) {
          const num = parseInt(part, 10)
          expect(num).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(num)).toBe(true)
        }
      }
    })
  })

  describe('Component registry structure', () => {
    it('all components should have required fields', () => {
      const blockItems = registry.items.filter((item) => item.type === 'registry:block')
      for (const item of blockItems) {
        expect(item.name).toBeDefined()
        expect(typeof item.name).toBe('string')
        expect(item.name.length).toBeGreaterThan(0)

        expect(item.type).toBeDefined()
        expect(item.type).toBe('registry:block')

        expect(item.files).toBeDefined()
        expect(Array.isArray(item.files)).toBe(true)
        expect(item.files.length).toBeGreaterThan(0)
      }
    })

    it('all component files should have valid paths', () => {
      for (const item of registry.items) {
        for (const file of item.files) {
          expect(file.path).toBeDefined()
          expect(typeof file.path).toBe('string')
          expect(file.path).toMatch(/^registry\//)
          expect(file.path).toMatch(/\.tsx?$/)
        }
      }
    })
  })
})

describe('Semver helper functions', () => {
  it('should validate correct semver versions', () => {
    const validVersions = [
      '0.0.0',
      '1.0.0',
      '1.2.3',
      '10.20.30',
      '100.200.300',
    ]

    for (const version of validVersions) {
      expect(SEMVER_REGEX.test(version)).toBe(true)
    }
  })

  it('should reject invalid semver versions', () => {
    const invalidVersions = [
      '1',
      '1.0',
      '1.0.0.0',
      'v1.0.0',
      '1.0.0-beta',
      '1.0.0-alpha.1',
      '01.0.0',
      '1.00.0',
      '1.0.00',
      '-1.0.0',
      '1.-1.0',
      '1.0.-1',
      'a.b.c',
      '',
    ]

    for (const version of invalidVersions) {
      expect(SEMVER_REGEX.test(version)).toBe(false)
    }
  })
})

/**
 * Utility functions for version comparison.
 * These can be used in pre-commit hooks or CI to verify version bumps.
 */
export function parseVersion(version: string): {
  major: number
  minor: number
  patch: number
} | null {
  const match = version.match(SEMVER_REGEX)
  if (!match) return null

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  }
}

export function compareVersions(
  v1: string,
  v2: string
): -1 | 0 | 1 | null {
  const parsed1 = parseVersion(v1)
  const parsed2 = parseVersion(v2)

  if (!parsed1 || !parsed2) return null

  if (parsed1.major !== parsed2.major) {
    return parsed1.major > parsed2.major ? 1 : -1
  }
  if (parsed1.minor !== parsed2.minor) {
    return parsed1.minor > parsed2.minor ? 1 : -1
  }
  if (parsed1.patch !== parsed2.patch) {
    return parsed1.patch > parsed2.patch ? 1 : -1
  }
  return 0
}

export function isVersionBumped(oldVersion: string, newVersion: string): boolean {
  const comparison = compareVersions(newVersion, oldVersion)
  return comparison === 1
}

describe('Version comparison utilities', () => {
  it('parseVersion should correctly parse valid versions', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 })
    expect(parseVersion('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 })
    expect(parseVersion('10.20.30')).toEqual({ major: 10, minor: 20, patch: 30 })
  })

  it('parseVersion should return null for invalid versions', () => {
    expect(parseVersion('invalid')).toBeNull()
    expect(parseVersion('1.0')).toBeNull()
    expect(parseVersion('')).toBeNull()
  })

  it('compareVersions should correctly compare versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1)
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
    expect(compareVersions('1.1.0', '1.0.0')).toBe(1)
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1)
    expect(compareVersions('1.0.0', '1.1.0')).toBe(-1)
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
  })

  it('isVersionBumped should detect version increases', () => {
    expect(isVersionBumped('1.0.0', '1.0.1')).toBe(true)
    expect(isVersionBumped('1.0.0', '1.1.0')).toBe(true)
    expect(isVersionBumped('1.0.0', '2.0.0')).toBe(true)
    expect(isVersionBumped('1.0.0', '1.0.0')).toBe(false)
    expect(isVersionBumped('2.0.0', '1.0.0')).toBe(false)
  })
})
