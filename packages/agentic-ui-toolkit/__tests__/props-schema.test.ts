/**
 * Component Props Schema Validation Tests
 *
 * Ensures all registry components follow the semantic prop structure
 * with only 4 allowed root-level parameters:
 * - data: Content to display
 * - actions: User-triggerable callbacks
 * - appearance: Visual configuration
 * - control: State management
 */

import * as ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'

const ALLOWED_PROPS = ['data', 'actions', 'appearance', 'control'] as const

const REGISTRY_DIR = path.join(__dirname, '..', 'registry')

interface PropsInterface {
  name: string
  file: string
  properties: string[]
}

interface ValidationResult {
  interface: PropsInterface
  invalidProps: string[]
  isValid: boolean
}

/**
 * Recursively finds all .tsx files in a directory
 */
function findTsxFiles(dir: string): string[] {
  const files: string[] = []

  if (!fs.existsSync(dir)) {
    return files
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...findTsxFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Extracts Props interfaces from a TypeScript file
 */
function extractPropsInterfaces(filePath: string): PropsInterface[] {
  const sourceCode = fs.readFileSync(filePath, 'utf-8')
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  )

  const propsInterfaces: PropsInterface[] = []

  function visit(node: ts.Node) {
    // Look for interface declarations ending with "Props"
    if (ts.isInterfaceDeclaration(node)) {
      const interfaceName = node.name.text

      if (interfaceName.endsWith('Props')) {
        const properties: string[] = []

        // Extract property names from the interface
        for (const member of node.members) {
          if (ts.isPropertySignature(member) && member.name) {
            if (ts.isIdentifier(member.name)) {
              properties.push(member.name.text)
            }
          }
        }

        propsInterfaces.push({
          name: interfaceName,
          file: path.relative(REGISTRY_DIR, filePath),
          properties
        })
      }
    }

    // Also check for type aliases that end with Props
    if (ts.isTypeAliasDeclaration(node)) {
      const typeName = node.name.text

      if (typeName.endsWith('Props') && ts.isTypeLiteralNode(node.type)) {
        const properties: string[] = []

        for (const member of node.type.members) {
          if (ts.isPropertySignature(member) && member.name) {
            if (ts.isIdentifier(member.name)) {
              properties.push(member.name.text)
            }
          }
        }

        propsInterfaces.push({
          name: typeName,
          file: path.relative(REGISTRY_DIR, filePath),
          properties
        })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return propsInterfaces
}

/**
 * Validates that a Props interface only contains allowed properties
 */
function validatePropsInterface(propsInterface: PropsInterface): ValidationResult {
  const invalidProps = propsInterface.properties.filter(
    (prop) => !ALLOWED_PROPS.includes(prop as (typeof ALLOWED_PROPS)[number])
  )

  return {
    interface: propsInterface,
    invalidProps,
    isValid: invalidProps.length === 0
  }
}

describe('Component Props Schema Validation', () => {
  const tsxFiles = findTsxFiles(REGISTRY_DIR)

  // Skip the types.ts file if it's in the list
  const componentFiles = tsxFiles.filter(
    (file) => !file.endsWith('types.ts')
  )

  it('should find component files in the registry', () => {
    expect(componentFiles.length).toBeGreaterThan(0)
  })

  describe('Each component Props interface should only have allowed root-level parameters', () => {
    const allPropsInterfaces: PropsInterface[] = []

    for (const file of componentFiles) {
      const interfaces = extractPropsInterfaces(file)
      allPropsInterfaces.push(...interfaces)
    }

    // Filter out internal/helper interfaces that aren't the main component props
    // Main component props typically match the exported component name
    const mainPropsInterfaces = allPropsInterfaces.filter((iface) => {
      // Skip interfaces for sub-components or data types
      // e.g., skip "Product" interface but keep "ProductListProps"
      return iface.name.endsWith('Props')
    })

    it('should find Props interfaces in the components', () => {
      expect(mainPropsInterfaces.length).toBeGreaterThan(0)
    })

    // Create a test for each Props interface
    for (const propsInterface of mainPropsInterfaces) {
      it(`${propsInterface.name} (${propsInterface.file}) should only have [data, actions, appearance, control] at root`, () => {
        const result = validatePropsInterface(propsInterface)

        if (!result.isValid) {
          const errorMessage = [
            `Invalid root-level properties found in ${propsInterface.name}:`,
            `  File: ${propsInterface.file}`,
            `  Invalid props: [${result.invalidProps.join(', ')}]`,
            `  Allowed props: [${ALLOWED_PROPS.join(', ')}]`,
            '',
            'Each component should follow the semantic prop structure:',
            '  - data: Content to display (arrays, objects, content)',
            '  - actions: User-triggerable callbacks (on* handlers)',
            '  - appearance: Visual configuration (variants, sizes, labels)',
            '  - control: State management (loading, selection, disabled)'
          ].join('\n')

          expect(result.invalidProps).toEqual([])
          fail(errorMessage)
        }

        expect(result.isValid).toBe(true)
      })
    }
  })

  describe('Summary', () => {
    it('should validate all Props interfaces follow the schema', () => {
      const allPropsInterfaces: PropsInterface[] = []

      for (const file of componentFiles) {
        const interfaces = extractPropsInterfaces(file)
        allPropsInterfaces.push(...interfaces)
      }

      const mainPropsInterfaces = allPropsInterfaces.filter((iface) =>
        iface.name.endsWith('Props')
      )

      const results = mainPropsInterfaces.map(validatePropsInterface)
      const invalidResults = results.filter((r) => !r.isValid)

      if (invalidResults.length > 0) {
        console.log('\n=== Props Schema Validation Summary ===\n')
        console.log(`Total Props interfaces: ${mainPropsInterfaces.length}`)
        console.log(`Valid: ${results.length - invalidResults.length}`)
        console.log(`Invalid: ${invalidResults.length}`)
        console.log('\nInvalid interfaces:')

        for (const result of invalidResults) {
          console.log(`  - ${result.interface.name} (${result.interface.file})`)
          console.log(`    Invalid props: [${result.invalidProps.join(', ')}]`)
        }

        console.log('')
      }

      expect(invalidResults.length).toBe(0)
    })
  })
})
