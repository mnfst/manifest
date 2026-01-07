'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Database, Palette, Zap, Settings2 } from 'lucide-react'

interface ConfigProperty {
  name: string
  type: string
  optional: boolean
  description?: string
}

interface ConfigCategory {
  name: 'data' | 'actions' | 'appearance' | 'control'
  properties: ConfigProperty[]
  description: string
  icon: React.ReactNode
}

/**
 * Parses TypeScript source code to extract the component's configuration schema.
 * Looks for interfaces with data, actions, appearance, and control properties.
 */
function parseComponentConfiguration(sourceCode: string): ConfigCategory[] {
  const categories: ConfigCategory[] = []

  // Find the main Props interface (e.g., AmountInputProps, TableProps, etc.)
  const propsInterfaceMatch = sourceCode.match(
    /export\s+interface\s+(\w+Props)(?:<[^>]*>)?\s*\{([\s\S]*?)\n\}/
  )

  if (!propsInterfaceMatch) {
    return categories
  }

  const propsBody = propsInterfaceMatch[2]

  // Extract each category (data, actions, appearance, control)
  const categoryConfig: Record<
    string,
    { description: string; icon: React.ReactNode }
  > = {
    data: {
      description: 'Content to display (arrays, objects, values)',
      icon: <Database className="h-4 w-4" />
    },
    actions: {
      description: 'User-triggerable callbacks and event handlers',
      icon: <Zap className="h-4 w-4" />
    },
    appearance: {
      description: 'Visual configuration (variants, sizes, labels)',
      icon: <Palette className="h-4 w-4" />
    },
    control: {
      description: 'State management (loading, selection, disabled)',
      icon: <Settings2 className="h-4 w-4" />
    }
  }

  for (const categoryName of ['data', 'actions', 'appearance', 'control']) {
    // Match the category property and its type definition
    // Handles both inline types and referenced types
    const categoryRegex = new RegExp(
      `${categoryName}\\??\\s*:\\s*(?:\\{([\\s\\S]*?)\\n\\s*\\}|([\\w<>\\[\\]|\\s,]+))`
    )
    const match = propsBody.match(categoryRegex)

    if (match) {
      const inlineType = match[1]
      const referencedType = match[2]

      let properties: ConfigProperty[] = []

      if (inlineType) {
        // Parse inline type properties
        properties = parseProperties(inlineType)
      } else if (referencedType) {
        // Try to find the referenced interface in the source code
        const refInterface = findInterfaceDefinition(
          sourceCode,
          referencedType.trim()
        )
        if (refInterface) {
          properties = parseProperties(refInterface)
        }
      }

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

  // Split by lines and parse each property
  const lines = interfaceBody.split('\n')
  let currentProperty = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      continue
    }

    currentProperty += ' ' + trimmed

    // Check if the property definition is complete (ends with type)
    if (
      currentProperty.includes(':') &&
      (currentProperty.match(/:\s*[^:]+$/) || currentProperty.endsWith('}'))
    ) {
      const propMatch = currentProperty.match(
        /(\w+)(\?)?:\s*(.+?)(?:$|(?=\s*\/\/))/
      )

      if (propMatch) {
        const [, name, optional, type] = propMatch
        properties.push({
          name,
          type: cleanType(type),
          optional: !!optional
        })
      }
      currentProperty = ''
    }
  }

  return properties
}

/**
 * Finds an interface definition in the source code by name
 */
function findInterfaceDefinition(
  sourceCode: string,
  typeName: string
): string | null {
  const regex = new RegExp(
    `interface\\s+${typeName}(?:<[^>]*>)?\\s*\\{([\\s\\S]*?)\\n\\}`
  )
  const match = sourceCode.match(regex)
  return match ? match[1] : null
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
 * Returns the appropriate color class for a category
 */
function getCategoryColor(name: string): {
  bg: string
  text: string
  border: string
  iconBg: string
} {
  switch (name) {
    case 'data':
      return {
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-200 dark:border-blue-800',
        iconBg: 'bg-blue-100 dark:bg-blue-900/50'
      }
    case 'actions':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800',
        iconBg: 'bg-amber-100 dark:bg-amber-900/50'
      }
    case 'appearance':
      return {
        bg: 'bg-purple-50 dark:bg-purple-950/30',
        text: 'text-purple-700 dark:text-purple-300',
        border: 'border-purple-200 dark:border-purple-800',
        iconBg: 'bg-purple-100 dark:bg-purple-900/50'
      }
    case 'control':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/50'
      }
    default:
      return {
        bg: 'bg-muted',
        text: 'text-foreground',
        border: 'border-border',
        iconBg: 'bg-muted'
      }
  }
}

/**
 * Formats a type string for better readability
 */
function formatType(type: string): React.ReactNode {
  // Handle union types
  if (type.includes('|')) {
    const parts = type.split('|').map((t) => t.trim())
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {parts.map((part, i) => (
          <span key={i} className="inline-flex items-center">
            {i > 0 && <span className="text-muted-foreground mx-1">|</span>}
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
      <code className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono text-amber-600 dark:text-amber-400">
        {type}
      </code>
    )
  }

  // Handle array types
  if (type.endsWith('[]')) {
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
        This component follows the semantic prop structure with{' '}
        {categories.length} configuration{' '}
        {categories.length === 1 ? 'category' : 'categories'}:
      </p>

      <div className="grid gap-4">
        {categories.map((category) => {
          const colors = getCategoryColor(category.name)
          return (
            <div
              key={category.name}
              className={cn(
                'rounded-lg border p-4',
                colors.bg,
                colors.border
              )}
            >
              {/* Category header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md',
                    colors.iconBg,
                    colors.text
                  )}
                >
                  {category.icon}
                </div>
                <div>
                  <h4 className={cn('font-semibold capitalize', colors.text)}>
                    {category.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {category.description}
                  </p>
                </div>
              </div>

              {/* Properties table */}
              <div className="rounded-md border bg-background/80 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Property
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground w-20">
                        Required
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
                        <td className="px-3 py-2 text-center">
                          {prop.optional ? (
                            <span className="text-muted-foreground text-xs">
                              optional
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                              required
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
