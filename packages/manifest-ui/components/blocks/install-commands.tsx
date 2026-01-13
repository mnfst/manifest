'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { track } from '@vercel/analytics'

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

interface InstallCommandsProps {
  componentName: string
}

export function InstallCommands({ componentName }: InstallCommandsProps) {
  const [selectedPm, setSelectedPm] = useState<PackageManager>('npx')
  const [copied, setCopied] = useState(false)

  const currentCommand =
    packageManagers
      .find((pm) => pm.id === selectedPm)
      ?.command(componentName) || ''

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentCommand)
    setCopied(true)
    track('install_command_copied', { command: currentCommand, inline: false })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {packageManagers.map((pm) => (
          <button
            key={pm.id}
            onClick={() => setSelectedPm(pm.id)}
            className={cn(
              'px-3 py-1 text-xs rounded-md transition-colors',
              selectedPm === pm.id
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {pm.label}
          </button>
        ))}
      </div>
      <div className="relative group">
        <pre className="rounded-lg bg-muted p-3 pr-12 overflow-x-auto text-sm font-mono">
          <code>{currentCommand}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-1/2 -translate-y-1/2 right-2 p-2 rounded-md hover:bg-background/50 transition-colors"
          aria-label="Copy to clipboard"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  )
}
