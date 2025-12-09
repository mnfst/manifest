'use client'

import { CodeBlock } from '@/components/blocks/code-block'
import { InstallCommandInline } from '@/components/blocks/install-command-inline'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEffect, useState } from 'react'

interface VariantSectionProps {
  name: string
  component: React.ReactNode
  registryName: string
}

function CodeViewer({ registryName }: { registryName: string }) {
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCode() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/r/${registryName}.json`)
        if (!response.ok) {
          throw new Error('Failed to fetch component')
        }
        const data = await response.json()
        const content = data.files?.[0]?.content
        if (content) {
          setCode(content)
        } else {
          setError('No source code available')
        }
      } catch {
        setError('Failed to load source code')
      } finally {
        setLoading(false)
      }
    }
    fetchCode()
  }, [registryName])

  if (loading) {
    return (
      <div className="rounded-lg bg-muted p-4 animate-pulse min-h-[300px]">
        <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2" />
        <div className="h-4 bg-muted-foreground/20 rounded w-1/2 mb-2" />
        <div className="h-4 bg-muted-foreground/20 rounded w-2/3" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-muted p-4 text-muted-foreground text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="max-h-[500px] overflow-y-auto rounded-lg">
      <CodeBlock code={code || ''} language="tsx" />
    </div>
  )
}

export function VariantSection({
  name,
  component,
  registryName
}: VariantSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{name}</h3>
      <Tabs defaultValue="preview" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>
          <InstallCommandInline componentName={registryName} />
        </div>
        <TabsContent value="preview" className="mt-0">
          {component}
        </TabsContent>
        <TabsContent value="code" className="mt-0">
          <CodeViewer registryName={registryName} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
