/**
 * Demo Data Placement Enforcement Test
 *
 * Validates that demo data is centralized in registry/<category>/demo/<category>.ts files,
 * not inlined in preview-components.tsx or page.tsx.
 *
 * Rules enforced:
 * A) Every category directory with .tsx components must have a demo/<category>.ts file
 * B) preview-components.tsx must NOT define local demo data constants
 * C) preview-components.tsx must NOT have inline data objects with >2 properties
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { describe, it, expect } from 'vitest'

const ROOT_PATH = resolve(__dirname, '..')
const REGISTRY_PATH = resolve(ROOT_PATH, 'registry')
const PREVIEW_PATH = resolve(ROOT_PATH, 'lib', 'preview-components.tsx')

/**
 * Get all category directories that contain .tsx component files
 */
function getCategoryDirs(): string[] {
  const entries = readdirSync(REGISTRY_PATH)
  const categories: string[] = []

  for (const entry of entries) {
    const fullPath = join(REGISTRY_PATH, entry)
    const stat = statSync(fullPath)
    if (!stat.isDirectory()) continue

    // Check if directory contains .tsx files (not just subdirectories)
    const files = readdirSync(fullPath)
    const hasTsx = files.some((f) => f.endsWith('.tsx'))
    if (hasTsx) {
      categories.push(entry)
    }
  }

  return categories
}

describe('Demo Data Placement', () => {
  const categories = getCategoryDirs()

  it('should find category directories to check', () => {
    expect(categories.length).toBeGreaterThan(0)
  })

  describe('Rule A: Every category with .tsx files must have demo/<category>.ts', () => {
    for (const category of categories) {
      it(`registry/${category}/ must have demo/${category}.ts`, () => {
        const demoDataPath = join(REGISTRY_PATH, category, 'demo', `${category}.ts`)
        expect(
          existsSync(demoDataPath),
          `Missing demo/${category}.ts for category "${category}". ` +
            `Create registry/${category}/demo/${category}.ts with demo data for this category.`
        ).toBe(true)
      })
    }
  })

  describe('Rule B: preview-components.tsx must NOT define local demo data constants', () => {
    it('should not have local const demo* variables', () => {
      const content = readFileSync(PREVIEW_PATH, 'utf-8')
      const lines = content.split('\n')
      const issues: string[] = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Match "const demo" at the start of a line (after optional whitespace)
        // but not inside import blocks
        if (/^\s*const\s+demo\w+/.test(line)) {
          issues.push(
            `Line ${i + 1}: "${line.trim()}" — ` +
              'Demo data must be imported from registry/*/demo/<category>.ts, not defined locally.'
          )
        }
      }

      if (issues.length > 0) {
        throw new Error(
          'preview-components.tsx contains local demo data constants:\n' +
            issues.join('\n')
        )
      }
    })
  })

  describe('Rule C: preview-components.tsx must NOT have large inline data objects', () => {
    it('should not have inline data={{ with >4 top-level properties', () => {
      const content = readFileSync(PREVIEW_PATH, 'utf-8')

      // Find all data={{ blocks and count top-level properties.
      // This is a heuristic: we count word: patterns that are NOT inside nested objects.
      // Small inline data (2-4 simple props like message bubbles) is acceptable;
      // large data objects (5+ props) should be extracted to demo/<category>.ts.
      const dataBlockPattern = /data=\{\{((?:(?!\}\}).|\n)*?)\}\}/g
      const issues: string[] = []
      let match

      while ((match = dataBlockPattern.exec(content)) !== null) {
        const block = match[1]
        // Strip nested objects to avoid counting their keys as top-level
        const stripped = block.replace(/\{[^}]*\}/g, '{}')
        const propCount = (stripped.match(/\w+\s*:/g) || []).length
        if (propCount > 4) {
          const lineNum =
            content.substring(0, match.index).split('\n').length
          issues.push(
            `Line ~${lineNum}: Inline data={{ with ${propCount} top-level properties. ` +
              'Extract to demo/<category>.ts instead.'
          )
        }
      }

      if (issues.length > 0) {
        throw new Error(
          'preview-components.tsx contains large inline data objects:\n' +
            issues.join('\n')
        )
      }
    })
  })
})
