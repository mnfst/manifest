/**
 * Props Interface JSDoc Documentation Test
 *
 * Ensures all registry component Props interfaces follow the documentation convention:
 * 1. A decorative header comment above the interface
 * 2. JSDoc comments on sub-parameters inside data/actions/appearance/control
 *
 * This makes the documentation visible in IDE hover tooltips and improves
 * developer experience when using the components.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const REGISTRY_DIR = path.join(__dirname, '..', 'registry')

/**
 * Components that are internal helpers and don't need the decorative header.
 * These are typically pre-configured compositions of base components.
 */
const INTERNAL_HELPER_COMPONENTS = new Set<string>([])

/**
 * Recursively find all .tsx files in a directory
 */
function findTsxFiles(dir: string): string[] {
  const files: string[] = []

  if (!fs.existsSync(dir)) {
    return files
  }

  const items = fs.readdirSync(dir, { withFileTypes: true })
  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    if (item.isDirectory() && item.name !== '__tests__') {
      files.push(...findTsxFiles(fullPath))
    } else if (item.isFile() && item.name.endsWith('.tsx')) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Extract exported function component names from file content
 */
function extractExportedComponents(content: string): string[] {
  const componentRegex =
    /export\s+function\s+([A-Z][a-zA-Z0-9]*)\s*(?:<[^>]*>)?\s*\(/g
  const components: string[] = []
  let match

  while ((match = componentRegex.exec(content)) !== null) {
    components.push(match[1])
  }

  return components
}

/**
 * Extract exported Props interface names from file content
 */
function extractExportedPropsInterfaces(content: string): string[] {
  const propsRegex =
    /export\s+interface\s+([A-Z][a-zA-Z0-9]*Props)(?:<[^>]*>)?\s*\{/g
  const interfaces: string[] = []
  let match

  while ((match = propsRegex.exec(content)) !== null) {
    interfaces.push(match[1])
  }

  return interfaces
}

/**
 * Check if a Props interface has a decorative header comment above it.
 * The header should contain the interface name and ═ characters.
 */
function hasDecorativeHeader(
  content: string,
  interfaceName: string
): boolean {
  // Find the interface declaration
  const interfacePattern = new RegExp(
    `export\\s+interface\\s+${interfaceName}(?:<[^>]*>)?\\s*\\{`
  )
  const interfaceMatch = interfacePattern.exec(content)

  if (!interfaceMatch) return false

  // Get the content before the interface (up to 500 chars should be enough)
  const beforeInterface = content.substring(
    Math.max(0, interfaceMatch.index - 500),
    interfaceMatch.index
  )

  // Check for decorative header pattern with ═ characters and interface name
  const hasDecorativeLine = beforeInterface.includes('═══')
  const hasInterfaceNameInComment = beforeInterface.includes(interfaceName)
  const hasCommentBlock = /\/\*\*[\s\S]*?\*\/\s*$/.test(beforeInterface)

  return hasDecorativeLine && hasInterfaceNameInComment && hasCommentBlock
}

/**
 * Extract the content inside a Props interface
 */
function extractPropsInterfaceContent(
  content: string,
  interfaceName: string
): string | null {
  const startPattern = new RegExp(
    `export\\s+interface\\s+${interfaceName}(?:<[^>]*>)?\\s*\\{`
  )
  const startMatch = startPattern.exec(content)

  if (!startMatch) return null

  const startIndex = startMatch.index + startMatch[0].length
  let braceCount = 1
  let endIndex = startIndex

  while (braceCount > 0 && endIndex < content.length) {
    if (content[endIndex] === '{') braceCount++
    if (content[endIndex] === '}') braceCount--
    endIndex++
  }

  return content.substring(startMatch.index, endIndex)
}

/**
 * Extract sub-parameters from a category block (data, actions, appearance, control).
 * Returns an array of parameter names that are missing JSDoc comments.
 */
function getSubParametersMissingJSDoc(interfaceContent: string): {
  category: string
  params: string[]
}[] {
  const results: { category: string; params: string[] }[] = []
  const lines = interfaceContent.split('\n')

  let currentCategory: string | null = null
  let braceDepth = 0
  let inInterface = false
  let categoryStartDepth = 0
  let justEnteredCategory = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // Skip empty lines and single-line comments
    if (!trimmedLine || trimmedLine.startsWith('//')) {
      continue
    }

    // Detect interface start
    if (
      trimmedLine.includes('export interface') &&
      trimmedLine.includes('{')
    ) {
      inInterface = true
      braceDepth = 1
      continue
    }

    if (!inInterface) continue

    // Check for category start at depth 1 (data, actions, appearance, control)
    let isCategoryLine = false
    if (braceDepth === 1) {
      const categoryMatch = trimmedLine.match(
        /^(data|actions|appearance|control)\??\s*:\s*\{/
      )
      if (categoryMatch) {
        currentCategory = categoryMatch[1]
        categoryStartDepth = braceDepth
        isCategoryLine = true
        justEnteredCategory = true
      }
    }

    // Update brace depth
    for (const char of line) {
      if (char === '{') braceDepth++
      if (char === '}') braceDepth--
    }

    // Check for sub-parameters at depth 2 (inside data/actions/appearance/control)
    // Skip the category line itself (data?: {, actions?: {, etc.)
    if (currentCategory && braceDepth === 2 && !isCategoryLine) {
      // Match property definitions like: propertyName?: Type or propertyName: Type
      const paramMatch = trimmedLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\??:\s*/)
      if (paramMatch) {
        const paramName = paramMatch[1]

        // Check if the previous non-empty line(s) contain a JSDoc comment
        let hasJSDoc = false
        for (let j = i - 1; j >= 0; j--) {
          const prevLine = lines[j].trim()
          if (!prevLine) continue
          if (prevLine.endsWith('*/')) {
            hasJSDoc = true
            break
          }
          if (prevLine.startsWith('/*') || prevLine.startsWith('*')) {
            continue
          }
          // Hit another line that's not a comment, stop looking
          break
        }

        if (!hasJSDoc) {
          // Find or create the result entry for this category
          let categoryResult = results.find(
            (r) => r.category === currentCategory
          )
          if (!categoryResult) {
            categoryResult = { category: currentCategory, params: [] }
            results.push(categoryResult)
          }
          categoryResult.params.push(paramName)
        }
      }
    }

    // Reset category when we exit it
    if (currentCategory && braceDepth <= categoryStartDepth) {
      currentCategory = null
    }
  }

  return results
}

describe('Props Interface JSDoc Documentation', () => {
  const tsxFiles = findTsxFiles(REGISTRY_DIR)

  it('should find registry component files', () => {
    expect(tsxFiles.length).toBeGreaterThan(0)
  })

  describe('Decorative Header Comments', () => {
    for (const filePath of tsxFiles) {
      const relativePath = path.relative(REGISTRY_DIR, filePath)
      const content = fs.readFileSync(filePath, 'utf-8')
      const propsInterfaces = extractExportedPropsInterfaces(content)
      const components = extractExportedComponents(content)

      if (propsInterfaces.length === 0) continue

      // Only check Props interfaces that have a corresponding component
      const componentPropsInterfaces = propsInterfaces.filter((propsName) => {
        const componentName = propsName.replace(/Props$/, '')
        return (
          components.includes(componentName) &&
          !INTERNAL_HELPER_COMPONENTS.has(componentName)
        )
      })

      if (componentPropsInterfaces.length === 0) continue

      describe(`${relativePath}`, () => {
        for (const propsName of componentPropsInterfaces) {
          it(`${propsName} should have a decorative header comment`, () => {
            const hasHeader = hasDecorativeHeader(content, propsName)

            if (!hasHeader) {
              expect.fail(
                `Props interface "${propsName}" is missing a decorative header comment.\n\n` +
                  `Required format:\n` +
                  `/**\n` +
                  ` * ═══════════════════════════════════════════════════════════════════════════\n` +
                  ` * ${propsName}\n` +
                  ` * ═══════════════════════════════════════════════════════════════════════════\n` +
                  ` *\n` +
                  ` * Description of the Props interface.\n` +
                  ` */\n` +
                  `export interface ${propsName} { ... }`
              )
            }

            expect(hasHeader).toBe(true)
          })
        }
      })
    }
  })

  describe('Sub-parameter JSDoc Comments', () => {
    for (const filePath of tsxFiles) {
      const relativePath = path.relative(REGISTRY_DIR, filePath)
      const content = fs.readFileSync(filePath, 'utf-8')
      const propsInterfaces = extractExportedPropsInterfaces(content)
      const components = extractExportedComponents(content)

      if (propsInterfaces.length === 0) continue

      // Only check Props interfaces that have a corresponding component
      const componentPropsInterfaces = propsInterfaces.filter((propsName) => {
        const componentName = propsName.replace(/Props$/, '')
        return (
          components.includes(componentName) &&
          !INTERNAL_HELPER_COMPONENTS.has(componentName)
        )
      })

      if (componentPropsInterfaces.length === 0) continue

      describe(`${relativePath}`, () => {
        for (const propsName of componentPropsInterfaces) {
          it(`${propsName} sub-parameters should have JSDoc comments`, () => {
            const interfaceContent = extractPropsInterfaceContent(
              content,
              propsName
            )

            expect(interfaceContent).not.toBeNull()

            if (interfaceContent) {
              const missingJSDoc =
                getSubParametersMissingJSDoc(interfaceContent)

              if (missingJSDoc.length > 0) {
                const missingDetails = missingJSDoc
                  .map(
                    ({ category, params }) =>
                      `  ${category}: ${params.join(', ')}`
                  )
                  .join('\n')

                expect.fail(
                  `Props interface "${propsName}" has sub-parameters missing JSDoc comments:\n` +
                    `${missingDetails}\n\n` +
                    `Each sub-parameter should have a JSDoc comment:\n` +
                    `data?: {\n` +
                    `  /** Description of the items array. */\n` +
                    `  items?: Item[]\n` +
                    `\n` +
                    `  /** Optional title displayed above the list. */\n` +
                    `  title?: string\n` +
                    `}`
                )
              }

              expect(missingJSDoc).toHaveLength(0)
            }
          })
        }
      })
    }
  })
})
