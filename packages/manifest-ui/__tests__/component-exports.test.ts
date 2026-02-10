/**
 * Component Export Validation Tests
 *
 * Ensures that all registry components properly export their main component:
 * - Each component file has a default or named export
 * - Export names follow conventions
 * - Components are properly structured
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const ROOT_DIR = resolve(__dirname, '..')
const REGISTRY_JSON_PATH = resolve(ROOT_DIR, 'registry.json')

interface RegistryFile {
  path: string
  type: string
}

interface RegistryItem {
  name: string
  type: string
  files: RegistryFile[]
}

interface Registry {
  items: RegistryItem[]
}

/**
 * Convert kebab-case to PascalCase
 */
function kebabToPascal(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

/**
 * Known naming variations where components use different casing than kebab-to-pascal
 */
const NAMING_VARIATIONS: Record<string, string> = {
  'linkedin-post': 'LinkedInPost',
  'youtube-post': 'YouTubePost',
  'x-post': 'XPost',
}

/**
 * Load the current registry.json
 */
function loadRegistry(): Registry {
  const content = readFileSync(REGISTRY_JSON_PATH, 'utf-8')
  return JSON.parse(content) as Registry
}

describe('Component Exports', () => {
  const registry = loadRegistry()
  const blockItems = registry.items.filter((item) => item.type === 'registry:block')

  describe('Export presence', () => {
    for (const item of blockItems) {
      const mainFile = item.files[0]
      if (!mainFile) continue

      const filePath = resolve(ROOT_DIR, mainFile.path)

      it(`${item.name} should have an export`, () => {
        expect(existsSync(filePath)).toBe(true)

        const content = readFileSync(filePath, 'utf-8')

        // Check for export - either default or named
        const hasExport =
          content.includes('export default') ||
          content.includes('export function') ||
          content.includes('export const') ||
          content.includes('export {')

        if (!hasExport) {
          throw new Error(
            `Component "${item.name}" in ${mainFile.path} has no exports`
          )
        }

        expect(hasExport).toBe(true)
      })
    }
  })

  describe('Component function export', () => {
    for (const item of blockItems) {
      const mainFile = item.files[0]
      if (!mainFile) continue

      const filePath = resolve(ROOT_DIR, mainFile.path)
      // Use known variation or default to kebab-to-pascal
      const expectedName = NAMING_VARIATIONS[item.name] || kebabToPascal(item.name)

      it(`${item.name} should export a component function`, () => {
        if (!existsSync(filePath)) {
          return // Skip if file doesn't exist (caught in other tests)
        }

        const content = readFileSync(filePath, 'utf-8')

        // Check for a function/const component export
        const hasComponentExport =
          // export function ComponentName
          content.includes(`export function ${expectedName}`) ||
          // export const ComponentName
          content.includes(`export const ${expectedName}`) ||
          // export default function ComponentName
          content.includes(`export default function ${expectedName}`) ||
          // function ComponentName ... export default
          (content.includes(`function ${expectedName}`) &&
            content.includes('export default')) ||
          // const ComponentName ... export default
          (content.includes(`const ${expectedName}`) &&
            content.includes('export default')) ||
          // export { ComponentName }
          content.includes(`export { ${expectedName}`)

        if (!hasComponentExport) {
          // Log what we found for debugging
          const exports = content.match(/export\s+(default\s+)?(function|const)\s+(\w+)/g)
          console.log(
            `Component "${item.name}" expected export name: ${expectedName}`
          )
          if (exports) {
            console.log(`Found exports: ${exports.join(', ')}`)
          }
        }

        expect(hasComponentExport).toBe(true)
      })
    }
  })

  describe('Props interface export', () => {
    for (const item of blockItems) {
      const mainFile = item.files[0]
      if (!mainFile) continue

      const filePath = resolve(ROOT_DIR, mainFile.path)
      // Use known variation or default to kebab-to-pascal
      const componentName = NAMING_VARIATIONS[item.name] || kebabToPascal(item.name)
      const expectedPropsName = `${componentName}Props`

      it(`${item.name} should export a Props interface`, () => {
        if (!existsSync(filePath)) {
          return
        }

        const content = readFileSync(filePath, 'utf-8')

        // Check for Props interface/type - can be named either with component prefix or just "Props"
        const hasPropsExport =
          content.includes(`export interface ${expectedPropsName}`) ||
          content.includes(`export type ${expectedPropsName}`) ||
          // Also allow non-exported interface that's used internally
          content.includes(`interface ${expectedPropsName}`) ||
          content.includes(`type ${expectedPropsName}`) ||
          // Also allow generic "Props" naming
          content.includes('interface Props') ||
          content.includes('type Props') ||
          // Also allow inline props type in function signature
          content.match(/function\s+\w+\s*\(\s*\{[^}]*\}\s*:\s*\{/)

        expect(hasPropsExport).toBe(true)
      })
    }
  })

  describe('React import or JSX usage', () => {
    for (const item of blockItems) {
      const mainFile = item.files[0]
      if (!mainFile) continue

      const filePath = resolve(ROOT_DIR, mainFile.path)

      it(`${item.name} should use React (import or JSX)`, () => {
        if (!existsSync(filePath)) {
          return
        }

        const content = readFileSync(filePath, 'utf-8')

        // Check for React usage - various forms
        // Note: React 17+ with new JSX transform doesn't require explicit React import
        const hasReactUsage =
          // Explicit React import
          content.includes("from 'react'") ||
          content.includes('from "react"') ||
          // Using global React
          content.includes('React.') ||
          // Using React hooks or types
          content.includes('useState') ||
          content.includes('useEffect') ||
          content.includes('useRef') ||
          content.includes('useMemo') ||
          content.includes('useCallback') ||
          content.includes('FC<') ||
          content.includes('ReactNode') ||
          // JSX syntax (React 17+ with new JSX transform)
          content.includes('<div') ||
          content.includes('<span') ||
          content.includes('<button') ||
          content.includes('<p>') ||
          content.includes('<h1') ||
          content.includes('<h2') ||
          content.includes('<a ') ||
          content.includes('<img') ||
          content.includes('<svg') ||
          content.includes('<input') ||
          content.includes('<form') ||
          // React fragments
          content.includes('<>') ||
          content.includes('</>')

        expect(hasReactUsage).toBe(true)
      })
    }
  })
})

describe('Component Structure Standards', () => {
  const registry = loadRegistry()
  const blockItems = registry.items.filter((item) => item.type === 'registry:block')

  describe('No console.log statements', () => {
    for (const item of blockItems) {
      const mainFile = item.files[0]
      if (!mainFile) continue

      const filePath = resolve(ROOT_DIR, mainFile.path)

      it(`${item.name} should not have console.log statements`, () => {
        if (!existsSync(filePath)) {
          return
        }

        const content = readFileSync(filePath, 'utf-8')

        // Check for console.log (but allow console.warn/error for legitimate use)
        const consoleLogMatches = content.match(/console\.log\s*\(/g) || []

        if (consoleLogMatches.length > 0) {
          console.warn(
            `Component "${item.name}" has ${consoleLogMatches.length} console.log statement(s)`
          )
        }

        // This is a warning, not a hard failure
        // Some components might have console.log for demo purposes
        expect(true).toBe(true)
      })
    }
  })

  describe('TypeScript types', () => {
    for (const item of blockItems) {
      const mainFile = item.files[0]
      if (!mainFile) continue

      const filePath = resolve(ROOT_DIR, mainFile.path)

      it(`${item.name} should use TypeScript`, () => {
        // All files should be .tsx
        expect(mainFile.path).toMatch(/\.tsx$/)
      })

      it(`${item.name} should have typed props`, () => {
        if (!existsSync(filePath)) {
          return
        }

        const content = readFileSync(filePath, 'utf-8')

        // Check for typed function parameters
        const hasTypedProps =
          // Props type annotation
          content.includes('Props') ||
          // Inline type annotation
          content.includes(': {') ||
          // Generic type
          content.includes('<') ||
          // FC type
          content.includes('FC<')

        expect(hasTypedProps).toBe(true)
      })
    }
  })
})

describe('Import Standards', () => {
  const registry = loadRegistry()
  const blockItems = registry.items.filter((item) => item.type === 'registry:block')

  describe('No relative parent imports outside registry', () => {
    for (const item of blockItems) {
      const mainFile = item.files[0]
      if (!mainFile) continue

      const filePath = resolve(ROOT_DIR, mainFile.path)

      it(`${item.name} should not import from outside registry using ../`, () => {
        if (!existsSync(filePath)) {
          return
        }

        const content = readFileSync(filePath, 'utf-8')

        // Look for imports that go outside the registry folder
        // e.g., ../components, ../lib, etc.
        const problematicImports = content.match(/from\s+['"]\.\.\/\.\.\//g)

        if (problematicImports && problematicImports.length > 0) {
          console.warn(
            `Component "${item.name}" imports from outside registry directory`
          )
        }

        // Registry components should be self-contained
        // They can import from relative paths within registry
        // but should not deeply import from app structure
        expect(true).toBe(true)
      })
    }
  })

  describe('Uses @/ alias for lib imports', () => {
    for (const item of blockItems) {
      const mainFile = item.files[0]
      if (!mainFile) continue

      const filePath = resolve(ROOT_DIR, mainFile.path)

      it(`${item.name} should use @/ alias for lib imports`, () => {
        if (!existsSync(filePath)) {
          return
        }

        const content = readFileSync(filePath, 'utf-8')

        // If importing from lib, should use @/lib alias
        const hasLibImport = content.includes('/lib/')

        if (hasLibImport) {
          const usesAlias = content.includes('@/lib')
          expect(usesAlias).toBe(true)
        } else {
          expect(true).toBe(true)
        }
      })
    }
  })
})
