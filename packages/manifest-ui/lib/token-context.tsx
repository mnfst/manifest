'use client'

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'

export interface DesignTokens {
  // Base
  backgroundColor: string
  foregroundColor: string
  // Colors (background + foreground pairs)
  primaryColor: string
  primaryForeground: string
  secondaryColor: string
  secondaryForeground: string
  accentColor: string
  accentForeground: string
  destructiveColor: string
  destructiveForeground: string
  successColor: string
  successForeground: string
  // Popover
  popoverColor: string
  popoverForeground: string
  // Border & Input
  borderColor: string
  inputBorderColor: string
  ringColor: string
  // Chart
  chart1: string
  chart2: string
  chart3: string
  chart4: string
  chart5: string
  // Typography
  fontFamily: 'system' | 'inter' | 'roboto' | 'poppins'
  // Layout
  borderRadius: number
}

export type ThemeMode = 'light' | 'dark'

export interface ThemedTokens {
  light: DesignTokens
  dark: DesignTokens
}

export const defaultLightTokens: DesignTokens = {
  backgroundColor: '#fbfbfb',
  foregroundColor: '#1a1a1a',
  primaryColor: '#1a1a1a',
  primaryForeground: '#fafafa',
  secondaryColor: '#f5f5f5',
  secondaryForeground: '#1a1a1a',
  accentColor: '#f5f5f5',
  accentForeground: '#1a1a1a',
  destructiveColor: '#dc2626',
  destructiveForeground: '#ffffff',
  successColor: '#16a34a',
  successForeground: '#ffffff',
  popoverColor: '#ffffff',
  popoverForeground: '#1a1a1a',
  borderColor: '#e5e5e5',
  inputBorderColor: '#e5e5e5',
  ringColor: '#737373',
  chart1: '#e76e50',
  chart2: '#2a9d8f',
  chart3: '#264653',
  chart4: '#e9c46a',
  chart5: '#f4a261',
  fontFamily: 'system',
  borderRadius: 8,
}

export const defaultDarkTokens: DesignTokens = {
  backgroundColor: '#121212',
  foregroundColor: '#ededed',
  primaryColor: '#ededed',
  primaryForeground: '#1a1a1a',
  secondaryColor: '#2a2a2a',
  secondaryForeground: '#ededed',
  accentColor: '#2a2a2a',
  accentForeground: '#ededed',
  destructiveColor: '#ef4444',
  destructiveForeground: '#ffffff',
  successColor: '#22c55e',
  successForeground: '#ffffff',
  popoverColor: '#1e1e1e',
  popoverForeground: '#ededed',
  borderColor: '#333333',
  inputBorderColor: '#3a3a3a',
  ringColor: '#555555',
  chart1: '#6366f1',
  chart2: '#22c55e',
  chart3: '#eab308',
  chart4: '#a855f7',
  chart5: '#ef4444',
  fontFamily: 'system',
  borderRadius: 8,
}

export const defaultThemedTokens: ThemedTokens = {
  light: defaultLightTokens,
  dark: defaultDarkTokens,
}

// Keep backward compat export
export const defaultTokens = defaultLightTokens

interface TokenContextValue {
  tokens: DesignTokens
  themedTokens: ThemedTokens
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  setTokens: (tokens: DesignTokens) => void
  updateToken: <K extends keyof DesignTokens>(key: K, value: DesignTokens[K]) => void
  resetToDefaults: () => void
  isModified: boolean
}

const TokenContext = createContext<TokenContextValue | undefined>(undefined)

const STORAGE_KEY = 'manifest-ui-design-tokens-v2'

const fontFamilies: Record<DesignTokens['fontFamily'], string> = {
  system: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
  roboto: '"Roboto", ui-sans-serif, system-ui, sans-serif',
  poppins: '"Poppins", ui-sans-serif, system-ui, sans-serif',
}

export function TokenProvider({ children }: { children: React.ReactNode }) {
  const [themedTokens, setThemedTokensState] = useState<ThemedTokens>(defaultThemedTokens)
  const [mode, setModeState] = useState<ThemeMode>('light')
  const [isHydrated, setIsHydrated] = useState(false)

  const tokens = themedTokens[mode]

  // Load tokens from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.light && parsed.dark) {
          setThemedTokensState({
            light: { ...defaultLightTokens, ...parsed.light },
            dark: { ...defaultDarkTokens, ...parsed.dark },
          })
        }
        if (parsed.mode) {
          setModeState(parsed.mode)
        }
      }
    } catch (e) {
      console.error('Failed to load design tokens:', e)
    }
    setIsHydrated(true)
  }, [])

  // Persist to localStorage
  const persist = useCallback((themed: ThemedTokens, m: ThemeMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...themed, mode: m }))
    } catch (e) {
      console.error('Failed to save design tokens:', e)
    }
  }, [])

  // Font family applied globally
  useEffect(() => {
    if (!isHydrated) return
    const root = document.documentElement
    root.style.setProperty('--font-sans', fontFamilies[tokens.fontFamily])
    document.body.style.fontFamily = fontFamilies[tokens.fontFamily]
  }, [tokens.fontFamily, isHydrated])

  // Load Google Fonts if needed
  useEffect(() => {
    if (!isHydrated) return

    const loadFont = (fontName: string) => {
      const linkId = `google-font-${fontName.toLowerCase()}`
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link')
        link.id = linkId
        link.rel = 'stylesheet'
        link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;600;700&display=swap`
        document.head.appendChild(link)
      }
    }

    if (tokens.fontFamily === 'inter') loadFont('Inter')
    if (tokens.fontFamily === 'roboto') loadFont('Roboto')
    if (tokens.fontFamily === 'poppins') loadFont('Poppins')
  }, [tokens.fontFamily, isHydrated])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    persist(themedTokens, m)
  }, [themedTokens, persist])

  const setTokens = useCallback((newTokens: DesignTokens) => {
    setThemedTokensState(prev => {
      const updated = { ...prev, [mode]: newTokens }
      persist(updated, mode)
      return updated
    })
  }, [mode, persist])

  const updateToken = useCallback(<K extends keyof DesignTokens>(key: K, value: DesignTokens[K]) => {
    setThemedTokensState(prev => {
      const updated = { ...prev, [mode]: { ...prev[mode], [key]: value } }
      persist(updated, mode)
      return updated
    })
  }, [mode, persist])

  const resetToDefaults = useCallback(() => {
    setThemedTokensState(defaultThemedTokens)
    setModeState('light')
    try {
      localStorage.removeItem(STORAGE_KEY)
      const root = document.documentElement
      root.style.removeProperty('--font-sans')
      document.body.style.removeProperty('font-family')
    } catch (e) {
      console.error('Failed to reset design tokens:', e)
    }
  }, [])

  const isModified =
    JSON.stringify(themedTokens) !== JSON.stringify(defaultThemedTokens)

  return (
    <TokenContext.Provider value={{ tokens, themedTokens, mode, setMode, setTokens, updateToken, resetToDefaults, isModified }}>
      {children}
    </TokenContext.Provider>
  )
}

export function useTokens() {
  const context = useContext(TokenContext)
  if (!context) {
    throw new Error('useTokens must be used within a TokenProvider')
  }
  return context
}

// ---------------------------------------------------------------------------
// Scoped token application (for previews / blocks)
// ---------------------------------------------------------------------------

export function hexToOklch(hex: string): string {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)
  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb
  const z = 0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb
  const l_ = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z)
  const m_ = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z)
  const s_ = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.633851707 * z)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const bVal = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  const C = Math.sqrt(a * a + bVal * bVal)
  let H = (Math.atan2(bVal, a) * 180) / Math.PI
  if (H < 0) H += 360
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(3)})`
}

export function getTokenCssVars(tokens: DesignTokens, mode: ThemeMode): Record<string, string> {
  const bg = hexToOklch(tokens.backgroundColor)
  const fg = hexToOklch(tokens.foregroundColor)
  const isDark = mode === 'dark'

  return {
    '--background': bg,
    '--foreground': fg,
    '--card': isDark ? 'oklch(0.18 0 0)' : 'oklch(1 0 0)',
    '--card-foreground': fg,
    '--muted': isDark ? 'oklch(0.25 0 0)' : 'oklch(0.96 0 0)',
    '--muted-foreground': isDark ? 'oklch(0.65 0 0)' : 'oklch(0.55 0 0)',
    '--primary': hexToOklch(tokens.primaryColor),
    '--primary-foreground': hexToOklch(tokens.primaryForeground),
    '--secondary': hexToOklch(tokens.secondaryColor),
    '--secondary-foreground': hexToOklch(tokens.secondaryForeground),
    '--accent': hexToOklch(tokens.accentColor),
    '--accent-foreground': hexToOklch(tokens.accentForeground),
    '--destructive': hexToOklch(tokens.destructiveColor),
    '--destructive-foreground': hexToOklch(tokens.destructiveForeground),
    '--success': hexToOklch(tokens.successColor),
    '--success-foreground': hexToOklch(tokens.successForeground),
    '--popover': hexToOklch(tokens.popoverColor),
    '--popover-foreground': hexToOklch(tokens.popoverForeground),
    '--border': hexToOklch(tokens.borderColor),
    '--input': hexToOklch(tokens.inputBorderColor),
    '--ring': hexToOklch(tokens.ringColor),
    '--chart-1': hexToOklch(tokens.chart1),
    '--chart-2': hexToOklch(tokens.chart2),
    '--chart-3': hexToOklch(tokens.chart3),
    '--chart-4': hexToOklch(tokens.chart4),
    '--chart-5': hexToOklch(tokens.chart5),
    '--radius': `${tokens.borderRadius / 16}rem`,
    '--radius-sm': `${Math.max(tokens.borderRadius - 2, 2) / 16}rem`,
    '--radius-md': `${tokens.borderRadius / 16}rem`,
    '--radius-lg': `${(tokens.borderRadius + 2) / 16}rem`,
    '--radius-xl': `${(tokens.borderRadius + 4) / 16}rem`,
  }
}

/**
 * Wraps children in a div that applies scoped design token CSS variables.
 * Only applies overrides when tokens have been modified from defaults.
 */
export function TokenScope({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  const { tokens, mode, isModified } = useTokens()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    if (!isModified) {
      ref.current.removeAttribute('style')
      return
    }
    const vars = getTokenCssVars(tokens, mode)
    for (const [prop, val] of Object.entries(vars)) {
      ref.current.style.setProperty(prop, val)
    }
  }, [tokens, mode, isModified])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
