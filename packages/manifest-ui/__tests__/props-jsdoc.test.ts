/**
 * Props Interface JSDoc Documentation Test
 *
 * Ensures all registry component Props interfaces have inline JSDoc comments
 * on their top-level properties (data, actions, appearance, control).
 *
 * This makes the documentation visible in IDE hover tooltips and improves
 * developer experience when using the components.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const REGISTRY_DIR = path.join(__dirname, '..', 'registry')

/**
 * Standard top-level props that should have JSDoc comments
 */
const STANDARD_PROPS = ['data', 'actions', 'appearance', 'control'] as const

/**
 * Components that are internal helpers and don't need JSDoc on props.
 * These are typically pre-configured compositions of base components.
 */
const INTERNAL_HELPER_COMPONENTS = new Set([
  // Skeleton variants - pre-configured compositions of the base Skeleton component
  'SkeletonWeather',
  'SkeletonProductCard',
  'SkeletonProductCarousel',
  'SkeletonPricingPlan',
  'SkeletonPricingPlans',
  'SkeletonInlineForm',
  'SkeletonOptionList',
  'SkeletonTagSelect',
  'SkeletonQuickReply',
  'SkeletonProgressSteps',
  'SkeletonStatusBadge',
  'SkeletonStatCard',
  'SkeletonStats',
  'SkeletonPaymentMethods',
  'SkeletonOrderConfirm',
  'SkeletonAmountInput',
  'SkeletonPaymentSuccess',
  'SkeletonPaymentSuccessCompact',
])

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
 * Extract the full Props interface definition with its properties
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
 * Check if top-level interface properties have inline JSDoc comments.
 * Only checks the standard props: data, actions, appearance, control.
 * Returns array of properties missing JSDoc.
 */
function getPropertiesMissingJSDoc(interfaceContent: string): string[] {
  const lines = interfaceContent.split('\n')
  const missingJSDoc: string[] = []

  let braceDepth = 0
  let inInterface = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('//')) {
      continue
    }

    if (
      trimmedLine.includes('export interface') &&
      trimmedLine.includes('{')
    ) {
      inInterface = true
      braceDepth = 1
      continue
    }

    if (!inInterface) continue

    // Check at depth 1 (directly inside the interface) BEFORE updating brace depth
    if (braceDepth === 1) {
      const propertyMatch = trimmedLine.match(
        /^(data|actions|appearance|control)\??\s*:\s*\{?/
      )
      if (propertyMatch) {
        const propertyName = propertyMatch[1]

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
          break
        }

        if (!hasJSDoc) {
          missingJSDoc.push(propertyName)
        }
      }
    }

    // Update brace depth AFTER checking properties
    for (const char of line) {
      if (char === '{') braceDepth++
      if (char === '}') braceDepth--
    }
  }

  return missingJSDoc
}

describe('Props Interface JSDoc Documentation', () => {
  const tsxFiles = findTsxFiles(REGISTRY_DIR)

  it('should find registry component files', () => {
    expect(tsxFiles.length).toBeGreaterThan(0)
  })

  describe('Inline JSDoc Comments', () => {
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
          it(`${propsName} should have inline JSDoc comments on top-level props`, () => {
            const interfaceContent = extractPropsInterfaceContent(
              content,
              propsName
            )

            expect(interfaceContent).not.toBeNull()

            if (interfaceContent) {
              const missingJSDoc = getPropertiesMissingJSDoc(interfaceContent)

              if (missingJSDoc.length > 0) {
                expect.fail(
                  `Props interface "${propsName}" is missing inline JSDoc comments:\n` +
                    `Missing JSDoc for: ${missingJSDoc.join(', ')}\n\n` +
                    `Each top-level property should have an inline JSDoc comment.\n` +
                    `Example:\n` +
                    `export interface ${propsName} {\n` +
                    `  /** Content and data to display */\n` +
                    `  data?: {\n` +
                    `    // ...\n` +
                    `  }\n` +
                    `  /** User-triggerable callbacks */\n` +
                    `  actions?: {\n` +
                    `    // ...\n` +
                    `  }\n` +
                    `  /** Visual configuration options */\n` +
                    `  appearance?: {\n` +
                    `    // ...\n` +
                    `  }\n` +
                    `  /** State management */\n` +
                    `  control?: {\n` +
                    `    // ...\n` +
                    `  }\n` +
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
