/**
 * Usage Code Consistency Test
 *
 * Validates that the usageCode strings in page.tsx accurately reflect
 * the component interfaces. This prevents the regression where:
 * - A prop is renamed in the component but usageCode still uses the old name
 * - A required prop is added but not shown in usageCode
 * - usageCode shows props that don't exist in the component interface
 * - The component name in usageCode doesn't match the actual export
 *
 * The usageCode is what users copy-paste, so it MUST work.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const ROOT_PATH = resolve(__dirname, '..')
const REGISTRY_JSON_PATH = resolve(ROOT_PATH, 'registry.json')
const BLOCK_PAGE_PATH = resolve(
  ROOT_PATH,
  'app',
  'blocks',
  '[category]',
  '[block]',
  'page.tsx'
)

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
 * Known naming variations where components use different casing
 */
const NAMING_VARIATIONS: Record<string, string> = {
  'linkedin-post': 'LinkedInPost',
  'youtube-post': 'YouTubePost',
  'x-post': 'XPost',
}

function kebabToPascal(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

/**
 * Extract the top-level props categories from a component interface
 * Returns the categories like: data, actions, appearance, control
 */
function extractInterfaceCategories(content: string): string[] {
  // Look for the Props interface definition
  const interfaceMatch = content.match(
    /(?:export\s+)?interface\s+\w+Props\s*\{([\s\S]*?)^\}/m
  )
  if (!interfaceMatch) return []

  const interfaceBody = interfaceMatch[1]
  const categories: string[] = []

  // Match top-level prop categories: data?, actions?, appearance?, control?
  const propMatches = interfaceBody.matchAll(/^\s+(\w+)\??:\s*\{/gm)
  for (const match of propMatches) {
    categories.push(match[1])
  }

  return categories
}

/**
 * Extract prop names from a usageCode block's top level
 * e.g., from <Component data={{...}} actions={{...}} /> returns ['data', 'actions']
 * Handles both multi-line and single-line JSX:
 *   <Component data={{...}} />                    -> ['data']
 *   <Component\n  data={{...}}\n  actions={{...}} -> ['data', 'actions']
 */
function extractUsageCodeTopProps(usageCode: string): string[] {
  const props: string[] = []
  // Match top-level JSX props: propName={{ or propName={
  // Works for both multi-line (indented) and inline (single-line) props
  const propMatches = usageCode.matchAll(/\b(\w+)=\{/g)
  for (const match of propMatches) {
    // Skip the component name in <ComponentName
    if (/^[A-Z]/.test(match[1])) continue
    props.push(match[1])
  }
  return [...new Set(props)]
}

/**
 * Extract the component name from a usageCode string
 * e.g., from "<PostCard\n  data={{...}}" returns "PostCard"
 */
function extractUsageCodeComponentName(usageCode: string): string | null {
  const match = usageCode.match(/<([A-Z]\w+)/)
  return match ? match[1] : null
}

const pageContent = existsSync(BLOCK_PAGE_PATH)
  ? readFileSync(BLOCK_PAGE_PATH, 'utf-8')
  : ''

/**
 * Extract all usageCode blocks from page.tsx with their associated registryName
 */
function extractUsageBlocks(): {
  registryName: string
  usageCode: string
  variantId: string
}[] {
  const blocks: {
    registryName: string
    usageCode: string
    variantId: string
  }[] = []

  // Find blocks with registryName and their variants
  // The structure is: { id, name, registryName, variants: [{ id, usageCode }] }
  const registryNameMatches = [
    ...pageContent.matchAll(/registryName:\s*['"]([^'"]+)['"]/g),
  ]

  for (const rnMatch of registryNameMatches) {
    const registryName = rnMatch[1]
    const blockStartIdx = rnMatch.index!

    // Find the end of this block (next registryName or end of categories array)
    const nextRegistryNameMatch = pageContent
      .slice(blockStartIdx + 1)
      .match(/registryName:\s*['"]/)
    const blockEndIdx = nextRegistryNameMatch
      ? blockStartIdx + 1 + nextRegistryNameMatch.index!
      : pageContent.length

    const blockContent = pageContent.slice(blockStartIdx, blockEndIdx)

    // Extract usageCode blocks within this block
    const usageMatches = [...blockContent.matchAll(/usageCode:\s*`([^`]*)`/gs)]
    // Also try to find variant ids near each usageCode
    const variantIdMatches = [
      ...blockContent.matchAll(
        /\{\s*id:\s*['"]([^'"]+)['"]/g
      ),
    ]

    for (let i = 0; i < usageMatches.length; i++) {
      const variantId =
        variantIdMatches[i]?.[1] || `variant-${i}`
      blocks.push({
        registryName,
        usageCode: usageMatches[i][1],
        variantId,
      })
    }
  }

  return blocks
}

describe('Usage Code Consistency', () => {
  const usageBlocks = extractUsageBlocks()

  it('should find usageCode blocks to validate', () => {
    expect(
      usageBlocks.length,
      'No usageCode blocks found in page.tsx'
    ).toBeGreaterThan(0)
  })

  describe('usageCode component names must match registry exports', () => {
    // Build a set of all known exported component names across ALL registry items
    const allExportedComponentNames = new Set<string>()
    for (const item of blockItems) {
      const mainFile = item.files.find((f) => f.type === 'registry:block')
      if (!mainFile) continue
      const filePath = resolve(ROOT_PATH, mainFile.path)
      if (!existsSync(filePath)) continue
      const content = readFileSync(filePath, 'utf-8')

      // Extract all exported function/const names that look like components (PascalCase)
      const exportMatches = content.matchAll(
        /export\s+(?:function|const)\s+([A-Z]\w+)/g
      )
      for (const match of exportMatches) {
        allExportedComponentNames.add(match[1])
      }
    }

    for (const block of usageBlocks) {
      const componentName = extractUsageCodeComponentName(block.usageCode)
      if (!componentName) continue

      it(`${block.registryName}/${block.variantId}: <${componentName}> must be a known component`, () => {
        // The component used in usageCode must be exported from SOME registry file.
        // This is broader than checking only the block's own file, because
        // usageCode may reference sub-components (e.g., MessageBubble inside chat-conversation).
        expect(
          allExportedComponentNames.has(componentName),
          `usageCode uses <${componentName}> but no registry component exports it. ` +
            `Users copying this code will get an undefined component error.`
        ).toBe(true)
      })
    }
  })

  describe('usageCode prop categories must exist in component interface', () => {
    // Build a map from component name -> interface categories for ALL registry items
    const componentInterfaceMap = new Map<string, string[]>()
    for (const item of blockItems) {
      const mainFile = item.files.find((f) => f.type === 'registry:block')
      if (!mainFile) continue
      const filePath = resolve(ROOT_PATH, mainFile.path)
      if (!existsSync(filePath)) continue
      const content = readFileSync(filePath, 'utf-8')

      // Extract all exported PascalCase names
      const exportMatches = content.matchAll(
        /export\s+(?:function|const)\s+([A-Z]\w+)/g
      )
      const categories = extractInterfaceCategories(content)
      for (const match of exportMatches) {
        // Each component in this file uses the same Props interface
        componentInterfaceMap.set(match[1], categories)
      }

      // Also try to find individual Props interfaces for sub-components
      // e.g., MessageBubbleProps, ImageMessageBubbleProps
      const interfaceMatches = content.matchAll(
        /(?:export\s+)?interface\s+(\w+)Props\s*\{([\s\S]*?)^\}/gm
      )
      for (const iMatch of interfaceMatches) {
        const componentName = iMatch[1]
        const body = iMatch[2]
        const cats: string[] = []
        const propMatches = body.matchAll(/^\s+(\w+)\??:\s*\{/gm)
        for (const pm of propMatches) {
          cats.push(pm[1])
        }
        if (cats.length > 0) {
          componentInterfaceMap.set(componentName, cats)
        }
      }
    }

    for (const block of usageBlocks) {
      const usageProps = extractUsageCodeTopProps(block.usageCode)
      if (usageProps.length === 0) continue

      // Use the component name from usageCode to find the right interface
      const componentName = extractUsageCodeComponentName(block.usageCode)
      if (!componentName) continue

      const interfaceCategories = componentInterfaceMap.get(componentName)
      if (!interfaceCategories || interfaceCategories.length === 0) continue

      it(`${block.registryName}/${block.variantId}: <${componentName}> usageCode props must match interface`, () => {
        const invalidProps = usageProps.filter(
          (p) => !interfaceCategories.includes(p)
        )

        if (invalidProps.length > 0) {
          // Only warn about standard prop categories (data, actions, appearance, control)
          // Custom props like className, style are always valid
          const standardProps = ['data', 'actions', 'appearance', 'control']
          const invalidStandardProps = invalidProps.filter((p) =>
            standardProps.includes(p)
          )

          if (invalidStandardProps.length > 0) {
            throw new Error(
              `usageCode for ${block.registryName}/${block.variantId} (<${componentName}>) uses props ` +
                `{ ${invalidStandardProps.join(', ')} } that don't exist in ${componentName}'s interface. ` +
                `Interface has: { ${interfaceCategories.join(', ')} }`
            )
          }
        }
      })
    }
  })

  describe('Components with data prop must show data in usageCode', () => {
    for (const item of blockItems) {
      const mainFile = item.files.find((f) => f.type === 'registry:block')
      if (!mainFile) continue

      const filePath = resolve(ROOT_PATH, mainFile.path)
      if (!existsSync(filePath)) continue

      const content = readFileSync(filePath, 'utf-8')
      const categories = extractInterfaceCategories(content)

      // Only check components that have a data prop
      if (!categories.includes('data')) continue

      const componentUsageBlocks = usageBlocks.filter(
        (b) => b.registryName === item.name
      )
      if (componentUsageBlocks.length === 0) continue

      it(`${item.name}: at least one usageCode variant must show data prop`, () => {
        const hasDataInUsage = componentUsageBlocks.some((b) => {
          const props = extractUsageCodeTopProps(b.usageCode)
          return props.includes('data')
        })

        expect(
          hasDataInUsage,
          `Component "${item.name}" has a data prop but none of its usageCode examples ` +
            `show data being passed. Users won't know how to provide data to this component.`
        ).toBe(true)
      })
    }
  })
})

describe('Usage Code Formatting', () => {
  const usageBlocks = extractUsageBlocks()

  describe('usageCode must not be empty', () => {
    for (const block of usageBlocks) {
      it(`${block.registryName}/${block.variantId}: usageCode must have content`, () => {
        const trimmed = block.usageCode.trim()
        expect(
          trimmed.length,
          `usageCode for ${block.registryName}/${block.variantId} is empty. ` +
            `Users see an empty "copy" panel.`
        ).toBeGreaterThan(0)
      })
    }
  })

  describe('usageCode must start with a JSX element', () => {
    for (const block of usageBlocks) {
      it(`${block.registryName}/${block.variantId}: usageCode must start with <`, () => {
        const trimmed = block.usageCode.trim()
        if (trimmed.length === 0) return // Caught by previous test

        expect(
          trimmed.startsWith('<'),
          `usageCode for ${block.registryName}/${block.variantId} doesn't start with '<'. ` +
            `It starts with: "${trimmed.substring(0, 20)}..."`
        ).toBe(true)
      })
    }
  })
})
