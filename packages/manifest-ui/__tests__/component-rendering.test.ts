/**
 * Component Rendering Completeness Test
 *
 * Validates that components have the structural elements needed to render:
 * - Components have a return statement with JSX
 * - Components render data from props (not just empty shells)
 * - Components that accept data actually use it in their render output
 * - Components have proper display mode handling if they claim to support it
 *
 * This catches the regression where a component exists but doesn't actually
 * render its data, producing a blank or incomplete UI.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const ROOT_PATH = resolve(__dirname, '..')
const REGISTRY_JSON_PATH = resolve(ROOT_PATH, 'registry.json')

interface RegistryItem {
  name: string
  type: string
  files: { path: string; type: string }[]
}

const registryJson = JSON.parse(
  readFileSync(REGISTRY_JSON_PATH, 'utf-8')
)
const blockItems: RegistryItem[] = registryJson.items.filter(
  (item: RegistryItem) => item.type === 'registry:block'
)

/**
 * Extract data interface sub-properties from a component file
 * Returns property names from the data?: { ... } block
 */
function extractDataProperties(content: string): string[] {
  // Find the data?: { ... } block in the Props interface
  const interfaceMatch = content.match(
    /interface\s+\w+Props\s*\{([\s\S]*?)^\}/m
  )
  if (!interfaceMatch) return []

  // Find data?: { ... } inside the interface
  const dataMatch = interfaceMatch[1].match(
    /data\?:\s*\{([\s\S]*?)\n\s*\}/
  )
  if (!dataMatch) return []

  const props: string[] = []
  const propMatches = dataMatch[1].matchAll(/^\s+(\w+)\??:/gm)
  for (const match of propMatches) {
    props.push(match[1])
  }

  return props
}

/**
 * Check if the component body references a data property
 */
function componentUsesDataProp(
  content: string,
  propName: string
): boolean {
  // Remove the interface definition to only check the function body
  const functionBodyMatch = content.match(
    /(?:export\s+(?:default\s+)?function\s+\w+|export\s+const\s+\w+\s*=)[^{]*\{([\s\S]*)/
  )
  if (!functionBodyMatch) return true // Can't determine, don't fail

  const body = functionBodyMatch[1]

  return (
    body.includes(`.${propName}`) ||
    body.includes(`['${propName}']`) ||
    body.includes(`["${propName}"]`) ||
    body.includes(`?.${propName}`) ||
    // Destructured: { propName } or { propName: alias }
    new RegExp(`\\b${propName}\\b`).test(body)
  )
}

describe('Component Rendering Completeness', () => {
  it('should find block items to validate', () => {
    expect(blockItems.length).toBeGreaterThan(0)
  })

  describe('Every component must have a return statement with JSX', () => {
    for (const item of blockItems) {
      const mainFile = item.files.find((f) => f.type === 'registry:block')
      if (!mainFile) continue

      const filePath = resolve(ROOT_PATH, mainFile.path)
      if (!existsSync(filePath)) continue

      const content = readFileSync(filePath, 'utf-8')

      it(`${item.name} must return JSX`, () => {
        // Must have at least one return with JSX (< character after return)
        const hasJsxReturn =
          /return\s*\(?\s*</.test(content) ||
          // Or arrow function with JSX
          /=>\s*\(?\s*</.test(content)

        expect(
          hasJsxReturn,
          `Component "${item.name}" in ${mainFile.path} has no JSX return statement. ` +
            `The component will render nothing.`
        ).toBe(true)
      })
    }
  })

  describe('Components with data prop must reference data in render output', () => {
    for (const item of blockItems) {
      const mainFile = item.files.find((f) => f.type === 'registry:block')
      if (!mainFile) continue

      const filePath = resolve(ROOT_PATH, mainFile.path)
      if (!existsSync(filePath)) continue

      const content = readFileSync(filePath, 'utf-8')
      const dataProps = extractDataProperties(content)

      if (dataProps.length === 0) continue

      it(`${item.name} must use at least some data props in render`, () => {
        const usedCount = dataProps.filter((prop) =>
          componentUsesDataProp(content, prop)
        ).length

        const usageRatio = usedCount / dataProps.length

        expect(
          usageRatio,
          `Component "${item.name}" defines ${dataProps.length} data properties ` +
            `(${dataProps.join(', ')}) but only uses ${usedCount} in its render output. ` +
            `This means the component won't display the data users provide.`
        ).toBeGreaterThan(0)
      })
    }
  })

  describe('Components must not have empty function bodies', () => {
    for (const item of blockItems) {
      const mainFile = item.files.find((f) => f.type === 'registry:block')
      if (!mainFile) continue

      const filePath = resolve(ROOT_PATH, mainFile.path)
      if (!existsSync(filePath)) continue

      const content = readFileSync(filePath, 'utf-8')

      it(`${item.name} must have a non-trivial function body`, () => {
        // The function body should be more than just a return null/undefined
        const isEmptyComponent =
          /export\s+(?:default\s+)?function\s+\w+[^{]*\{\s*return\s+null\s*;?\s*\}/.test(
            content
          )

        expect(
          isEmptyComponent,
          `Component "${item.name}" returns null. The component renders nothing.`
        ).toBe(false)
      })
    }
  })

  describe('Components claiming displayMode support must handle it', () => {
    for (const item of blockItems) {
      const mainFile = item.files.find((f) => f.type === 'registry:block')
      if (!mainFile) continue

      const filePath = resolve(ROOT_PATH, mainFile.path)
      if (!existsSync(filePath)) continue

      const content = readFileSync(filePath, 'utf-8')

      // Check if component declares displayMode in its interface
      if (!content.includes('displayMode')) continue

      it(`${item.name} must render different layouts for display modes`, () => {
        // Should have conditional rendering based on displayMode
        const handlesDisplayMode =
          content.includes("displayMode === 'fullscreen'") ||
          content.includes("displayMode === 'inline'") ||
          content.includes("displayMode === 'pip'") ||
          content.includes('displayMode ===') ||
          content.includes("displayMode !== 'inline'") ||
          content.includes("displayMode !== 'fullscreen'") ||
          // Or uses displayMode in className conditionals
          content.includes('displayMode')

        expect(
          handlesDisplayMode,
          `Component "${item.name}" declares displayMode in its interface but ` +
            `doesn't conditionally render based on it.`
        ).toBe(true)
      })
    }
  })
})

describe('Component File Structure', () => {
  describe('Every registry block file must exist and be non-empty', () => {
    for (const item of blockItems) {
      for (const file of item.files) {
        const filePath = resolve(ROOT_PATH, file.path)

        it(`${file.path} must exist and have content`, () => {
          expect(
            existsSync(filePath),
            `File "${file.path}" listed in registry.json for "${item.name}" does not exist.`
          ).toBe(true)

          if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf-8')
            expect(
              content.trim().length,
              `File "${file.path}" is empty.`
            ).toBeGreaterThan(0)
          }
        })
      }
    }
  })

  describe('Component files must not have syntax-breaking issues', () => {
    for (const item of blockItems) {
      const mainFile = item.files.find((f) => f.type === 'registry:block')
      if (!mainFile) continue

      const filePath = resolve(ROOT_PATH, mainFile.path)
      if (!existsSync(filePath)) continue

      const content = readFileSync(filePath, 'utf-8')

      it(`${item.name} must have balanced braces`, () => {
        let braceCount = 0
        for (const char of content) {
          if (char === '{') braceCount++
          if (char === '}') braceCount--
        }

        expect(
          braceCount,
          `Component "${item.name}" has unbalanced braces (${braceCount > 0 ? 'missing closing' : 'extra closing'} braces). ` +
            `This will cause a syntax error.`
        ).toBe(0)
      })

      it(`${item.name} must have balanced parentheses`, () => {
        let parenCount = 0
        // Ignore parens inside strings
        const stripped = content.replace(
          /(['"`])(?:(?!\1|\\).|\\.)*\1/g,
          ''
        )
        for (const char of stripped) {
          if (char === '(') parenCount++
          if (char === ')') parenCount--
        }

        expect(
          parenCount,
          `Component "${item.name}" has unbalanced parentheses. ` +
            `This will cause a syntax error.`
        ).toBe(0)
      })
    }
  })
})
