'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Database, Palette, Zap, Settings2 } from 'lucide-react'

interface ConfigProperty {
  name: string
  type: string
}

interface ConfigCategory {
  name: 'data' | 'actions' | 'appearance' | 'control'
  properties: ConfigProperty[]
  description: string
  icon: React.ReactNode
}

/**
 * Extracts the body of a Props interface, handling nested braces properly
 */
function extractPropsInterfaceBody(sourceCode: string): string | null {
  // Find the start of the Props interface
  const interfaceMatch = sourceCode.match(
    /export\s+interface\s+\w+Props(?:<[^{]*>)?\s*\{/
  )
  if (!interfaceMatch) return null

  const startIndex = interfaceMatch.index! + interfaceMatch[0].length
  let braceCount = 1
  let endIndex = startIndex

  while (braceCount > 0 && endIndex < sourceCode.length) {
    const char = sourceCode[endIndex]
    if (char === '{') braceCount++
    if (char === '}') braceCount--
    endIndex++
  }

  return sourceCode.slice(startIndex, endIndex - 1)
}

/**
 * Extracts a category block (data, actions, appearance, control) from the interface body
 */
function extractCategoryBlock(
  propsBody: string,
  categoryName: string
): string | null {
  // Find where the category starts
  const categoryRegex = new RegExp(`${categoryName}\\??\\s*:\\s*\\{`)
  const match = propsBody.match(categoryRegex)
  if (!match) return null

  const startIndex = match.index! + match[0].length
  let braceCount = 1
  let endIndex = startIndex

  while (braceCount > 0 && endIndex < propsBody.length) {
    const char = propsBody[endIndex]
    if (char === '{') braceCount++
    if (char === '}') braceCount--
    endIndex++
  }

  return propsBody.slice(startIndex, endIndex - 1)
}

/**
 * Parses TypeScript source code to extract the component's configuration schema.
 * Looks for interfaces with data, actions, appearance, and control properties.
 */
function parseComponentConfiguration(sourceCode: string): ConfigCategory[] {
  const categories: ConfigCategory[] = []

  const propsBody = extractPropsInterfaceBody(sourceCode)
  if (!propsBody) return categories

  const categoryConfig: Record<
    string,
    { description: string; icon: React.ReactNode }
  > = {
    data: {
      description: 'Dynamic content to inject in the block',
      icon: <Database className="h-4 w-4" />
    },
    actions: {
      description: 'User-triggerable actions and callbacks',
      icon: <Zap className="h-4 w-4" />
    },
    appearance: {
      description: 'Edit the look and feel of the component',
      icon: <Palette className="h-4 w-4" />
    },
    control: {
      description:
        'State management configuration (loading, selections, disabled elements...)',
      icon: <Settings2 className="h-4 w-4" />
    }
  }

  for (const categoryName of ['data', 'actions', 'appearance', 'control']) {
    const categoryBlock = extractCategoryBlock(propsBody, categoryName)

    if (categoryBlock) {
      const properties = parseProperties(categoryBlock)

      if (properties.length > 0) {
        categories.push({
          name: categoryName as ConfigCategory['name'],
          properties,
          ...categoryConfig[categoryName]
        })
      }
    }
  }

  return categories
}

/**
 * Parses property definitions from an interface body
 */
function parseProperties(interfaceBody: string): ConfigProperty[] {
  const properties: ConfigProperty[] = []
  const lines = interfaceBody.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines, comments, and JSDoc
    if (
      !trimmed ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*')
    ) {
      continue
    }

    // Match property: name?: type
    const propMatch = trimmed.match(/^(\w+)\??:\s*(.+?);?\s*$/)
    if (propMatch) {
      const [, name, type] = propMatch
      properties.push({
        name,
        type: cleanType(type)
      })
    }
  }

  return properties
}

/**
 * Cleans up a type string for display
 */
function cleanType(type: string): string {
  return type
    .replace(/\s+/g, ' ')
    .replace(/;\s*$/, '')
    .replace(/,\s*$/, '')
    .trim()
}

/**
 * Formats a type string for better readability
 */
function formatType(type: string): React.ReactNode {
  // Handle union types with string literals
  if (type.includes("'") && type.includes('|')) {
    const parts = type.split('|').map((t) => t.trim())
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {parts.map((part, i) => (
          <span key={i} className="inline-flex items-center">
            {i > 0 && <span className="text-muted-foreground mx-0.5">|</span>}
            <code className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
              {part}
            </code>
          </span>
        ))}
      </span>
    )
  }

  // Handle function types
  if (type.includes('=>')) {
    return (
      <code className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
        {type}
      </code>
    )
  }

  // Default
  return (
    <code className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
      {type}
    </code>
  )
}

interface ConfigurationViewerProps {
  sourceCode: string | null
  loading?: boolean
}

export function ConfigurationViewer({
  sourceCode,
  loading
}: ConfigurationViewerProps) {
  const categories = useMemo(() => {
    if (!sourceCode) return []
    return parseComponentConfiguration(sourceCode)
  }, [sourceCode])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border bg-muted/50 p-4 animate-pulse"
          >
            <div className="h-5 w-24 bg-muted-foreground/20 rounded mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted-foreground/20 rounded" />
              <div className="h-4 w-3/4 bg-muted-foreground/20 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!sourceCode) {
    return (
      <div className="rounded-lg border bg-muted/50 p-6 text-center text-muted-foreground text-sm">
        No source code available
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/50 p-6 text-center text-muted-foreground text-sm">
        No configuration schema detected for this component
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Available parameters to personalize your block
      </p>

      <div className="grid gap-4">
        {categories.map((category) => (
          <div
            key={category.name}
            className="rounded-lg border bg-card p-4"
          >
            {/* Category header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                {category.icon}
              </div>
              <div>
                <h4 className="font-semibold capitalize">{category.name}</h4>
                <p className="text-xs text-muted-foreground">
                  {category.description}
                </p>
              </div>
            </div>

            {/* Properties table */}
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Property
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {category.properties.map((prop, i) => (
                    <tr
                      key={prop.name}
                      className={cn(
                        'border-b last:border-0',
                        i % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'
                      )}
                    >
                      <td className="px-3 py-2">
                        <code className="font-mono text-sm font-medium">
                          {prop.name}
                        </code>
                      </td>
                      <td className="px-3 py-2">{formatType(prop.type)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
