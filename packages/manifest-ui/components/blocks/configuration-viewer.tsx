'use client'

import { useMemo, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Database, Palette, Zap, Settings2 } from 'lucide-react'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from '@/components/ui/hover-card'
import { codeToHtml } from 'shiki'

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

interface TypeDefinition {
  name: string
  definition: string
}

// Primitive types that don't need tooltips
const PRIMITIVE_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'null',
  'undefined',
  'void',
  'any',
  'unknown',
  'never',
  'object',
  'symbol',
  'bigint'
])

/**
 * Checks if a type name is a custom type (not a primitive)
 */
function isCustomType(typeName: string): boolean {
  // Remove array notation and get the base type
  const baseType = typeName.replace(/\[\]$/, '').trim()

  // Check if it's a primitive
  if (PRIMITIVE_TYPES.has(baseType.toLowerCase())) {
    return false
  }

  // Check if it's a common built-in type
  const builtInTypes = [
    'Array',
    'Object',
    'Function',
    'Date',
    'RegExp',
    'Promise',
    'Map',
    'Set',
    'React',
    'ReactNode',
    'JSX'
  ]
  if (builtInTypes.some((t) => baseType.startsWith(t))) {
    return false
  }

  // Must start with uppercase letter to be a custom type
  return /^[A-Z]/.test(baseType)
}

/**
 * Extracts a type name from a type expression (handles arrays, generics, etc.)
 */
function extractTypeName(type: string): string | null {
  // Handle array types like "ChatMessage[]"
  const arrayMatch = type.match(/^(\w+)\[\]$/)
  if (arrayMatch) {
    return arrayMatch[1]
  }

  // Handle simple types like "ChatMessage"
  const simpleMatch = type.match(/^(\w+)$/)
  if (simpleMatch && isCustomType(simpleMatch[1])) {
    return simpleMatch[1]
  }

  // Handle generic types like "Partial<ContactFormData>" or "Array<Item>"
  const genericMatch = type.match(/^\w+<(\w+)>$/)
  if (genericMatch && isCustomType(genericMatch[1])) {
    return genericMatch[1]
  }

  // Handle nested object types like "{ emoji: string; count: number }[]"
  // These are inline types, not custom types
  if (type.includes('{')) {
    return null
  }

  return null
}

/**
 * Extracts all interface and type definitions from source code
 */
function extractTypeDefinitions(sourceCode: string): Map<string, TypeDefinition> {
  const definitions = new Map<string, TypeDefinition>()

  // Match interface definitions (including those with extends clause)
  const interfaceRegex = /export\s+interface\s+(\w+)(?:<[^{]*>)?(?:\s+extends\s+[^{]+)?\s*\{/g
  let match

  while ((match = interfaceRegex.exec(sourceCode)) !== null) {
    const name = match[1]
    // Skip Props interfaces
    if (name.endsWith('Props')) continue

    const startIndex = match.index
    const bodyStartIndex = match.index + match[0].length
    let braceCount = 1
    let endIndex = bodyStartIndex

    while (braceCount > 0 && endIndex < sourceCode.length) {
      const char = sourceCode[endIndex]
      if (char === '{') braceCount++
      if (char === '}') braceCount--
      endIndex++
    }

    const fullDefinition = sourceCode.slice(startIndex, endIndex)
    definitions.set(name, {
      name,
      definition: fullDefinition
    })
  }

  // Match type definitions
  const typeRegex = /export\s+type\s+(\w+)(?:<[^=]*>)?\s*=\s*/g
  while ((match = typeRegex.exec(sourceCode)) !== null) {
    const name = match[1]
    const startIndex = match.index
    let endIndex = match.index + match[0].length

    // Find the end of the type definition (handles multiline)
    let depth = 0
    let inString = false
    let stringChar = ''

    while (endIndex < sourceCode.length) {
      const char = sourceCode[endIndex]
      const prevChar = sourceCode[endIndex - 1]

      // Handle string literals
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true
          stringChar = char
        } else if (char === stringChar) {
          inString = false
        }
      }

      if (!inString) {
        if (char === '{' || char === '(' || char === '<') depth++
        if (char === '}' || char === ')' || char === '>') depth--

        // End of type definition
        if (depth === 0 && (char === '\n' || char === ';')) {
          if (char === ';') endIndex++
          break
        }
      }

      endIndex++
    }

    const fullDefinition = sourceCode.slice(startIndex, endIndex).trim()
    definitions.set(name, {
      name,
      definition: fullDefinition
    })
  }

  return definitions
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
 * Component for rendering a custom type with hover tooltip
 */
function CustomTypeWithTooltip({
  type,
  typeName,
  definition
}: {
  type: string
  typeName: string
  definition: string
}) {
  const [html, setHtml] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(false)

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkDarkMode()

    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    async function highlight() {
      const highlighted = await codeToHtml(definition, {
        lang: 'typescript',
        theme: isDark ? 'github-dark' : 'github-light'
      })
      setHtml(highlighted)
    }
    highlight()
  }, [definition, isDark])

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <code className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono cursor-help border-b border-dashed border-purple-500/50 hover:border-purple-500 hover:bg-muted/80 transition-colors text-purple-600 dark:text-purple-400">
          {type}
        </code>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-auto max-w-[500px] p-0"
        side="top"
        align="start"
      >
        <div className="px-3 py-2 border-b bg-muted/50">
          <p className="text-xs font-medium text-muted-foreground">
            Type definition for <span className="font-mono text-foreground">{typeName}</span>
          </p>
        </div>
        <div className="overflow-auto max-h-[300px]">
          {html ? (
            <div
              className="text-xs [&_pre]:p-3 [&_pre]:m-0 [&_pre]:!bg-transparent [&_.shiki]:!bg-transparent [&_pre]:overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <pre className="p-3 text-xs font-mono overflow-x-auto">
              <code>{definition}</code>
            </pre>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * Renders a type with tooltip if it's a custom type that has a definition
 */
function renderTypeWithTooltip(
  typeName: string,
  displayText: string,
  typeDefinitions: Map<string, TypeDefinition>
): React.ReactNode {
  // Check for array types and extract base type
  const baseType = typeName.replace(/\[\]$/, '').trim()

  if (typeDefinitions.has(baseType)) {
    const definition = typeDefinitions.get(baseType)!
    return (
      <CustomTypeWithTooltip
        type={displayText}
        typeName={baseType}
        definition={definition.definition}
      />
    )
  }

  return (
    <code className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
      {displayText}
    </code>
  )
}

/**
 * Formats a type string for better readability with hoverable custom types
 */
function formatType(
  type: string,
  typeDefinitions: Map<string, TypeDefinition>
): React.ReactNode {
  // Check if this type references a custom type (simple or array)
  const typeName = extractTypeName(type)
  if (typeName && typeDefinitions.has(typeName)) {
    const definition = typeDefinitions.get(typeName)!
    return (
      <CustomTypeWithTooltip
        type={type}
        typeName={typeName}
        definition={definition.definition}
      />
    )
  }

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

  // Handle function types with custom parameter types like "(post: Post) => void"
  if (type.includes('=>')) {
    // Match function signature: (params) => returnType
    const funcMatch = type.match(/^\(([^)]*)\)\s*=>\s*(.+)$/)
    if (funcMatch) {
      const paramsStr = funcMatch[1]
      const returnType = funcMatch[2].trim()

      // Parse parameters and find custom types
      const parts: React.ReactNode[] = []
      parts.push(<span key="open" className="text-xs font-mono">(</span>)

      if (paramsStr.trim()) {
        // Split parameters by comma (but not inside nested structures)
        const params = paramsStr.split(',').map(p => p.trim())

        params.forEach((param, idx) => {
          // Match "name: Type" or "name?: Type"
          const paramMatch = param.match(/^(\w+\??)\s*:\s*(.+)$/)
          if (paramMatch) {
            const paramName = paramMatch[1]
            const paramType = paramMatch[2].trim()
            const baseParamType = paramType.replace(/\[\]$/, '').trim()

            if (idx > 0) {
              parts.push(<span key={`comma-${idx}`} className="text-xs font-mono">, </span>)
            }

            parts.push(
              <span key={`param-${idx}`} className="text-xs font-mono">
                {paramName}:{' '}
              </span>
            )

            // Check if parameter type has a definition
            if (isCustomType(baseParamType) && typeDefinitions.has(baseParamType)) {
              parts.push(
                <span key={`type-${idx}`}>
                  {renderTypeWithTooltip(paramType, paramType, typeDefinitions)}
                </span>
              )
            } else {
              parts.push(
                <span key={`type-${idx}`} className="text-xs font-mono">
                  {paramType}
                </span>
              )
            }
          } else {
            if (idx > 0) {
              parts.push(<span key={`comma-${idx}`} className="text-xs font-mono">, </span>)
            }
            parts.push(<span key={`param-${idx}`} className="text-xs font-mono">{param}</span>)
          }
        })
      }

      parts.push(<span key="arrow" className="text-xs font-mono">) =&gt; </span>)

      // Handle return type
      const baseReturnType = returnType.replace(/\[\]$/, '').trim()
      if (isCustomType(baseReturnType) && typeDefinitions.has(baseReturnType)) {
        parts.push(
          <span key="return">
            {renderTypeWithTooltip(returnType, returnType, typeDefinitions)}
          </span>
        )
      } else {
        parts.push(<span key="return" className="text-xs font-mono">{returnType}</span>)
      }

      return (
        <span className="inline-flex flex-wrap items-center px-1.5 py-0.5 rounded bg-muted">
          {parts}
        </span>
      )
    }

    // Fallback for complex function types
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
  relatedSourceFiles?: string[]
  loading?: boolean
  highlightCategory?: ConfigCategory['name'] | null
}

export function ConfigurationViewer({
  sourceCode,
  relatedSourceFiles = [],
  loading,
  highlightCategory
}: ConfigurationViewerProps) {
  const { categories, typeDefinitions } = useMemo(() => {
    if (!sourceCode) return { categories: [], typeDefinitions: new Map() }

    // Extract type definitions from main source file
    const mainDefinitions = extractTypeDefinitions(sourceCode)

    // Extract type definitions from all related files (for imported types)
    for (const relatedSource of relatedSourceFiles) {
      const relatedDefinitions = extractTypeDefinitions(relatedSource)
      for (const [name, definition] of relatedDefinitions) {
        if (!mainDefinitions.has(name)) {
          mainDefinitions.set(name, definition)
        }
      }
    }

    return {
      categories: parseComponentConfiguration(sourceCode),
      typeDefinitions: mainDefinitions
    }
  }, [sourceCode, relatedSourceFiles])

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
            id={`config-${category.name}`}
            className={cn(
              'rounded-lg border bg-card p-4',
              highlightCategory === category.name && 'animate-highlight'
            )}
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
                      <td className="px-3 py-2">
                        {formatType(prop.type, typeDefinitions)}
                      </td>
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
