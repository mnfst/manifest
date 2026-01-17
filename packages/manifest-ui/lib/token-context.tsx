'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

export interface DesignTokens {
  // Colors
  primaryColor: string
  secondaryColor: string
  accentColor: string
  destructiveColor: string
  successColor: string
  // Typography
  fontFamily: 'system' | 'inter' | 'roboto' | 'poppins'
  // Layout
  borderRadius: number
}

export const defaultTokens: DesignTokens = {
  primaryColor: '#1a1a1a',
  secondaryColor: '#f5f5f5',
  accentColor: '#f5f5f5',
  destructiveColor: '#dc2626',
  successColor: '#16a34a',
  fontFamily: 'system',
  borderRadius: 8,
}

interface TokenContextValue {
  tokens: DesignTokens
  setTokens: (tokens: DesignTokens) => void
  updateToken: <K extends keyof DesignTokens>(key: K, value: DesignTokens[K]) => void
  resetToDefaults: () => void
  isModified: boolean
}

const TokenContext = createContext<TokenContextValue | undefined>(undefined)

const STORAGE_KEY = 'manifest-ui-design-tokens'

// Convert hex color to oklch for CSS
function hexToOklch(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '')

  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  // Convert RGB to linear RGB
  const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)

  // Convert to XYZ
  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb
  const z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb

  // Convert XYZ to Oklab
  const l_ = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z)
  const m_ = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z)
  const s_ = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z)

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
  const bVal = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_

  // Convert Oklab to Oklch
  const C = Math.sqrt(a * a + bVal * bVal)
  let H = Math.atan2(bVal, a) * 180 / Math.PI
  if (H < 0) H += 360

  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(3)})`
}

// Generate foreground color based on background luminance
function getForegroundColor(hex: string): string {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  // Calculate relative luminance
  const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)

  // Return white for dark backgrounds, black for light
  return luminance > 0.5 ? 'oklch(0.145 0 0)' : 'oklch(0.985 0 0)'
}

const fontFamilies: Record<DesignTokens['fontFamily'], string> = {
  system: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
  roboto: '"Roboto", ui-sans-serif, system-ui, sans-serif',
  poppins: '"Poppins", ui-sans-serif, system-ui, sans-serif',
}

export function TokenProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokensState] = useState<DesignTokens>(defaultTokens)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load tokens from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setTokensState({ ...defaultTokens, ...parsed })
      }
    } catch (e) {
      console.error('Failed to load design tokens:', e)
    }
    setIsHydrated(true)
  }, [])

  // Apply tokens to CSS variables
  useEffect(() => {
    if (!isHydrated) return

    const root = document.documentElement

    // Primary color
    root.style.setProperty('--primary', hexToOklch(tokens.primaryColor))
    root.style.setProperty('--primary-foreground', getForegroundColor(tokens.primaryColor))

    // Secondary color
    root.style.setProperty('--secondary', hexToOklch(tokens.secondaryColor))
    root.style.setProperty('--secondary-foreground', getForegroundColor(tokens.secondaryColor))

    // Accent color
    root.style.setProperty('--accent', hexToOklch(tokens.accentColor))
    root.style.setProperty('--accent-foreground', getForegroundColor(tokens.accentColor))

    // Destructive color
    root.style.setProperty('--destructive', hexToOklch(tokens.destructiveColor))

    // Success color
    root.style.setProperty('--success', hexToOklch(tokens.successColor))

    // Border radius
    root.style.setProperty('--radius', `${tokens.borderRadius / 16}rem`)
    root.style.setProperty('--radius-sm', `${Math.max(tokens.borderRadius - 2, 2) / 16}rem`)
    root.style.setProperty('--radius-md', `${tokens.borderRadius / 16}rem`)
    root.style.setProperty('--radius-lg', `${(tokens.borderRadius + 2) / 16}rem`)
    root.style.setProperty('--radius-xl', `${(tokens.borderRadius + 4) / 16}rem`)

    // Font family
    root.style.setProperty('--font-sans', fontFamilies[tokens.fontFamily])
    document.body.style.fontFamily = fontFamilies[tokens.fontFamily]
  }, [tokens, isHydrated])

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

  const setTokens = useCallback((newTokens: DesignTokens) => {
    setTokensState(newTokens)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTokens))
    } catch (e) {
      console.error('Failed to save design tokens:', e)
    }
  }, [])

  const updateToken = useCallback(<K extends keyof DesignTokens>(key: K, value: DesignTokens[K]) => {
    setTokensState(prev => {
      const newTokens = { ...prev, [key]: value }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newTokens))
      } catch (e) {
        console.error('Failed to save design tokens:', e)
      }
      return newTokens
    })
  }, [])

  const resetToDefaults = useCallback(() => {
    setTokensState(defaultTokens)
    try {
      localStorage.removeItem(STORAGE_KEY)
      // Clear custom CSS properties
      const root = document.documentElement
      root.style.removeProperty('--primary')
      root.style.removeProperty('--primary-foreground')
      root.style.removeProperty('--secondary')
      root.style.removeProperty('--secondary-foreground')
      root.style.removeProperty('--accent')
      root.style.removeProperty('--accent-foreground')
      root.style.removeProperty('--destructive')
      root.style.removeProperty('--success')
      root.style.removeProperty('--radius')
      root.style.removeProperty('--radius-sm')
      root.style.removeProperty('--radius-md')
      root.style.removeProperty('--radius-lg')
      root.style.removeProperty('--radius-xl')
      root.style.removeProperty('--font-sans')
      document.body.style.removeProperty('font-family')
    } catch (e) {
      console.error('Failed to reset design tokens:', e)
    }
  }, [])

  const isModified = JSON.stringify(tokens) !== JSON.stringify(defaultTokens)

  return (
    <TokenContext.Provider value={{ tokens, setTokens, updateToken, resetToDefaults, isModified }}>
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
