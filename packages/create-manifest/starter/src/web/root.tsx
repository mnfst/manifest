import { useEffect, useState, type ReactNode } from 'react'
import '@/globals.css'

export default function RootLayout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    if (window.openai?.theme) {
      setTheme(window.openai.theme)
    }
  }, [])

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      {children}
    </div>
  )
}

// Type declarations for OpenAI host
declare global {
  interface Window {
    openai?: {
      theme?: 'light' | 'dark'
      content?: {
        structuredContent?: unknown
      }
      sendFollowUpMessage?: (message: string) => void
      callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>
      openExternal?: (url: string) => void
      requestDisplayMode?: (mode: 'inline' | 'fullscreen' | 'pip') => void
      requestClose?: () => void
      setWidgetState?: (state: Record<string, unknown>) => void
    }
  }
}
