'use client'

import { track } from '@vercel/analytics'
import { Check, ChevronDown, Copy } from 'lucide-react'
import { useState } from 'react'

type PackageManager = 'npx' | 'pnpm' | 'yarn' | 'bunx'

const packageManagers: {
  id: PackageManager
  label: string
  command: (name: string) => string
}[] = [
  {
    id: 'npx',
    label: 'npx',
    command: (name: string) => `npx shadcn@latest add @manifest/${name}`
  },
  {
    id: 'pnpm',
    label: 'pnpm',
    command: (name: string) => `pnpm dlx shadcn@latest add @manifest/${name}`
  },
  {
    id: 'yarn',
    label: 'yarn',
    command: (name: string) => `npx shadcn@latest add @manifest/${name}`
  },
  {
    id: 'bunx',
    label: 'bunx',
    command: (name: string) => `bunx --bun shadcn@latest add @manifest/${name}`
  }
]

interface InstallCommandInlineProps {
  componentName: string
}

export function InstallCommandInline({
  componentName
}: InstallCommandInlineProps) {
  const [selectedPm, setSelectedPm] = useState<PackageManager>('npx')
  const [copied, setCopied] = useState(false)

  const currentCommand =
    packageManagers
      .find((pm) => pm.id === selectedPm)
      ?.command(componentName) || ''

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentCommand)
    setCopied(true)
    track('install_command_copied', { command: currentCommand, inline: true })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Package manager select */}
      <div className="relative">
        <select
          value={selectedPm}
          onChange={(e) => setSelectedPm(e.target.value as PackageManager)}
          className="appearance-none bg-background border rounded-md pl-2 pr-6 py-1.5 text-xs font-mono cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {packageManagers.map((pm) => (
            <option key={pm.id} value={pm.id}>
              {pm.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
      </div>

      {/* Command display with copy button */}
      <div className="flex items-center gap-2 bg-background border rounded-md px-3 py-1.5 font-mono text-xs min-w-0 flex-1">
        <code className="text-foreground/80 truncate sm:overflow-visible sm:whitespace-normal min-w-0">
          {currentCommand}
        </code>
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-muted transition-colors shrink-0"
          aria-label="Copy to clipboard"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  )
}
