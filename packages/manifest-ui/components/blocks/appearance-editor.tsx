'use client'

import { useMemo } from 'react'
import { Palette } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface AppearanceProperty {
  name: string
  type: string
  defaultValue?: string | number | boolean
}

interface ParsedProperty extends AppearanceProperty {
  inputType: 'boolean' | 'number' | 'string' | 'enum' | 'unknown'
  enumValues?: string[]
}

interface AppearanceEditorProps {
  sourceCode: string | null
  appearance: Record<string, unknown>
  onAppearanceChange: (key: string, value: unknown) => void
  loading?: boolean
}

/**
 * Extracts the body of a Props interface, handling nested braces properly
 */
function extractPropsInterfaceBody(sourceCode: string): string | null {
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
 * Extracts the appearance block from the interface body
 */
function extractAppearanceBlock(propsBody: string): string | null {
  const categoryRegex = /appearance\??\s*:\s*\{/
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
 * Parses properties from the appearance interface body
 */
function parseAppearanceProperties(interfaceBody: string): AppearanceProperty[] {
  const properties: AppearanceProperty[] = []
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
        type: type.replace(/\s+/g, ' ').replace(/;\s*$/, '').trim()
      })
    }
  }

  return properties
}

/**
 * Determines the input type and extracts enum values from a type string
 */
function analyzePropertyType(prop: AppearanceProperty): ParsedProperty {
  const { type } = prop

  // Check for boolean
  if (type === 'boolean') {
    return { ...prop, inputType: 'boolean' }
  }

  // Check for number
  if (type === 'number') {
    return { ...prop, inputType: 'number' }
  }

  // Check for string
  if (type === 'string') {
    return { ...prop, inputType: 'string' }
  }

  // Check for string literal union (enum): 'value1' | 'value2' | 'value3'
  if (type.includes("'") && type.includes('|')) {
    const enumValues = type
      .split('|')
      .map((v) => v.trim().replace(/'/g, ''))
      .filter(Boolean)
    return { ...prop, inputType: 'enum', enumValues }
  }

  // Check for number literal union: 2 | 3 | 4
  if (/^\d+(\s*\|\s*\d+)+$/.test(type)) {
    const enumValues = type.split('|').map((v) => v.trim())
    return { ...prop, inputType: 'enum', enumValues }
  }

  return { ...prop, inputType: 'unknown' }
}

/**
 * Parses component source code to extract appearance properties
 */
function parseAppearanceSchema(sourceCode: string): ParsedProperty[] {
  const propsBody = extractPropsInterfaceBody(sourceCode)
  if (!propsBody) return []

  const appearanceBlock = extractAppearanceBlock(propsBody)
  if (!appearanceBlock) return []

  const properties = parseAppearanceProperties(appearanceBlock)
  return properties.map(analyzePropertyType)
}

/**
 * Formats a property name for display (camelCase to Title Case)
 */
function formatPropertyName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

export function AppearanceEditor({
  sourceCode,
  appearance,
  onAppearanceChange,
  loading
}: AppearanceEditorProps) {
  const properties = useMemo(() => {
    if (!sourceCode) return []
    return parseAppearanceSchema(sourceCode)
  }, [sourceCode])

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-3 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (!sourceCode || properties.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-muted text-muted-foreground">
          <Palette className="h-3.5 w-3.5" />
        </div>
        <h4 className="text-sm font-medium">Appearance</h4>
      </div>

      <div className="space-y-3">
        {properties.map((prop) => {
          const value = appearance[prop.name]

          if (prop.inputType === 'boolean') {
            return (
              <div
                key={prop.name}
                className="flex items-center justify-between gap-2"
              >
                <Label
                  htmlFor={`appearance-${prop.name}`}
                  className="text-xs font-normal text-muted-foreground cursor-pointer"
                >
                  {formatPropertyName(prop.name)}
                </Label>
                <Switch
                  id={`appearance-${prop.name}`}
                  checked={value as boolean ?? true}
                  onCheckedChange={(checked) =>
                    onAppearanceChange(prop.name, checked)
                  }
                />
              </div>
            )
          }

          if (prop.inputType === 'enum' && prop.enumValues) {
            return (
              <div key={prop.name} className="space-y-1.5">
                <Label
                  htmlFor={`appearance-${prop.name}`}
                  className="text-xs font-normal text-muted-foreground"
                >
                  {formatPropertyName(prop.name)}
                </Label>
                <Select
                  value={String(value ?? prop.enumValues[0])}
                  onValueChange={(newValue) => {
                    // Convert back to number if it was a number enum
                    const isNumeric = /^\d+$/.test(newValue)
                    onAppearanceChange(
                      prop.name,
                      isNumeric ? Number(newValue) : newValue
                    )
                  }}
                >
                  <SelectTrigger id={`appearance-${prop.name}`} size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {prop.enumValues.map((enumValue) => (
                      <SelectItem key={enumValue} value={enumValue}>
                        {enumValue}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          }

          if (prop.inputType === 'number') {
            return (
              <div key={prop.name} className="space-y-1.5">
                <Label
                  htmlFor={`appearance-${prop.name}`}
                  className="text-xs font-normal text-muted-foreground"
                >
                  {formatPropertyName(prop.name)}
                </Label>
                <Input
                  id={`appearance-${prop.name}`}
                  type="number"
                  value={value as number ?? 0}
                  onChange={(e) =>
                    onAppearanceChange(prop.name, Number(e.target.value))
                  }
                  className="h-8 text-sm"
                />
              </div>
            )
          }

          if (prop.inputType === 'string') {
            return (
              <div key={prop.name} className="space-y-1.5">
                <Label
                  htmlFor={`appearance-${prop.name}`}
                  className="text-xs font-normal text-muted-foreground"
                >
                  {formatPropertyName(prop.name)}
                </Label>
                <Input
                  id={`appearance-${prop.name}`}
                  type="text"
                  value={value as string ?? ''}
                  onChange={(e) => onAppearanceChange(prop.name, e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            )
          }

          // Unknown type - show as read-only
          return (
            <div key={prop.name} className="space-y-1.5">
              <Label className="text-xs font-normal text-muted-foreground">
                {formatPropertyName(prop.name)}
              </Label>
              <div className="text-xs text-muted-foreground/70 px-2 py-1.5 rounded bg-muted">
                {prop.type}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
