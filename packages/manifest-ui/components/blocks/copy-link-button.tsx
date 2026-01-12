'use client'

import { LinkIcon } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function CopyLinkButton({
  anchor,
  className
}: {
  anchor?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const pathname = usePathname()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleCopy = useCallback(() => {
    const url = `${window.location.origin}${pathname}${anchor ? `#${anchor}` : ''}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }, [pathname, anchor])

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted',
        className
      )}
      title={copied ? 'Copied!' : 'Copy link'}
    >
      <LinkIcon
        className={cn(
          'h-4 w-4',
          copied ? 'text-green-500' : 'text-muted-foreground'
        )}
      />
    </button>
  )
}
