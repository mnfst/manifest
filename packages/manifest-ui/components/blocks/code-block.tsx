'use client'

import { Check, Copy } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { codeToHtml } from 'shiki'
import { track } from '@vercel/analytics'

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
}

export function CodeBlock({
  code,
  language = 'bash',
  className
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [html, setHtml] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(false)
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

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
      const highlighted = await codeToHtml(code, {
        lang: language,
        theme: isDark ? 'github-dark' : 'github-light'
      })
      setHtml(highlighted)
    }
    highlight()
  }, [code, language, isDark])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    track('code_copied', { code })
    // Clear any existing timeout
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
    }
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className={`relative group ${className || ''}`}>
      {html ? (
        <div
          className="rounded-lg overflow-x-auto text-sm bg-muted dark:bg-[#262626] [&_pre]:p-4 [&_pre]:m-0 [&_pre]:!bg-transparent [&_.shiki]:!bg-transparent [&_pre]:min-w-max"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="rounded-lg bg-muted dark:bg-[#262626] p-4 overflow-x-auto text-sm font-mono min-w-max">
          <code>{code}</code>
        </pre>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 rounded-md bg-background/80 hover:bg-background border opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    </div>
  )
}
