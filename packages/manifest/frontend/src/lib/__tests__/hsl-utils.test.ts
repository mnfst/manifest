import { describe, it, expect } from 'vitest'
import type { ThemeVariables } from '@manifest/shared'
import {
  parseHslString,
  formatHslObject,
  validateHslString,
  validateRadius,
  isValidHslString,
  isColorVariable,
  hslStringToCss,
  parseCssVariables,
  formatCssVariables,
} from '../hsl-utils'

describe('hsl-utils', () => {
  describe('parseHslString', () => {
    it('parses valid HSL string with integers', () => {
      const result = parseHslString('222 47% 11%')
      expect(result).toEqual({ h: 222, s: 47, l: 11 })
    })

    it('parses valid HSL string with decimals', () => {
      const result = parseHslString('222.2 47.4% 11.2%')
      expect(result).toEqual({ h: 222.2, s: 47.4, l: 11.2 })
    })

    it('trims whitespace before parsing', () => {
      const result = parseHslString('  180 50% 50%  ')
      expect(result).toEqual({ h: 180, s: 50, l: 50 })
    })

    it('returns null for invalid format', () => {
      expect(parseHslString('invalid')).toBeNull()
      expect(parseHslString('hsl(222, 47%, 11%)')).toBeNull()
      expect(parseHslString('222 47 11')).toBeNull()
      expect(parseHslString('')).toBeNull()
    })

    it('returns null for missing components', () => {
      expect(parseHslString('222 47%')).toBeNull()
      expect(parseHslString('222')).toBeNull()
    })
  })

  describe('formatHslObject', () => {
    it('formats HSL object to string with integers', () => {
      const result = formatHslObject({ h: 222, s: 47, l: 11 })
      expect(result).toBe('222 47% 11%')
    })

    it('rounds to 1 decimal place', () => {
      const result = formatHslObject({ h: 222.256, s: 47.444, l: 11.156 })
      expect(result).toBe('222.3 47.4% 11.2%')
    })

    it('handles zero values', () => {
      const result = formatHslObject({ h: 0, s: 0, l: 0 })
      expect(result).toBe('0 0% 0%')
    })

    it('handles maximum values', () => {
      const result = formatHslObject({ h: 360, s: 100, l: 100 })
      expect(result).toBe('360 100% 100%')
    })
  })

  describe('validateHslString', () => {
    it('returns null for valid HSL strings', () => {
      expect(validateHslString('222 47% 11%')).toBeNull()
      expect(validateHslString('0 0% 0%')).toBeNull()
      expect(validateHslString('360 100% 100%')).toBeNull()
    })

    it('returns error for empty value', () => {
      expect(validateHslString('')).toBe('Value is required')
      expect(validateHslString('   ')).toBe('Value is required')
    })

    it('returns error for invalid format', () => {
      const error = validateHslString('invalid')
      expect(error).toContain('Invalid HSL format')
    })

    it('returns error for hue out of range', () => {
      expect(validateHslString('400 50% 50%')).toBe(
        'Hue must be between 0 and 360'
      )
      expect(validateHslString('-10 50% 50%')).toContain('Invalid HSL format')
    })

    it('returns error for saturation out of range', () => {
      expect(validateHslString('180 150% 50%')).toBe(
        'Saturation must be between 0% and 100%'
      )
    })

    it('returns error for lightness out of range', () => {
      expect(validateHslString('180 50% 150%')).toBe(
        'Lightness must be between 0% and 100%'
      )
    })
  })

  describe('validateRadius', () => {
    it('returns null for valid rem values', () => {
      expect(validateRadius('0.5rem')).toBeNull()
      expect(validateRadius('1rem')).toBeNull()
      expect(validateRadius('2.5rem')).toBeNull()
    })

    it('returns null for valid px values', () => {
      expect(validateRadius('8px')).toBeNull()
      expect(validateRadius('16px')).toBeNull()
      expect(validateRadius('4.5px')).toBeNull()
    })

    it('returns null for valid em values', () => {
      expect(validateRadius('1em')).toBeNull()
      expect(validateRadius('0.5em')).toBeNull()
    })

    it('returns error for empty value', () => {
      expect(validateRadius('')).toBe('Value is required')
      expect(validateRadius('   ')).toBe('Value is required')
    })

    it('returns error for invalid format', () => {
      expect(validateRadius('8')).toContain('Invalid radius format')
      expect(validateRadius('8pt')).toContain('Invalid radius format')
      expect(validateRadius('abc')).toContain('Invalid radius format')
    })
  })

  describe('isValidHslString', () => {
    it('returns true for valid HSL strings', () => {
      expect(isValidHslString('222 47% 11%')).toBe(true)
      expect(isValidHslString('0 0% 0%')).toBe(true)
    })

    it('returns false for invalid HSL strings', () => {
      expect(isValidHslString('')).toBe(false)
      expect(isValidHslString('invalid')).toBe(false)
      expect(isValidHslString('400 50% 50%')).toBe(false)
    })
  })

  describe('isColorVariable', () => {
    it('returns true for color variables', () => {
      expect(isColorVariable('--background')).toBe(true)
      expect(isColorVariable('--foreground')).toBe(true)
      expect(isColorVariable('--primary')).toBe(true)
      expect(isColorVariable('--muted-foreground')).toBe(true)
    })

    it('returns false for radius variable', () => {
      expect(isColorVariable('--radius')).toBe(false)
    })
  })

  describe('hslStringToCss', () => {
    it('converts HSL string to CSS hsl() format', () => {
      expect(hslStringToCss('222.2 47.4% 11.2%')).toBe(
        'hsl(222.2, 47.4%, 11.2%)'
      )
    })

    it('handles integer values', () => {
      expect(hslStringToCss('180 50% 50%')).toBe('hsl(180, 50%, 50%)')
    })

    it('returns original string if parsing fails', () => {
      expect(hslStringToCss('invalid')).toBe('invalid')
    })
  })

  describe('parseCssVariables', () => {
    it('parses CSS custom properties', () => {
      const css = `
        :root {
          --background: 222 47% 11%;
          --foreground: 210 40% 98%;
        }
      `
      const result = parseCssVariables(css)
      expect(result['--background']).toBe('222 47% 11%')
      expect(result['--foreground']).toBe('210 40% 98%')
    })

    it('handles single variable', () => {
      const css = '--radius: 0.5rem;'
      const result = parseCssVariables(css)
      expect(result['--radius']).toBe('0.5rem')
    })

    it('ignores non-variable properties', () => {
      const css = `
        body { color: red; }
        --valid: 180 50% 50%;
      `
      const result = parseCssVariables(css)
      expect(result['--valid']).toBe('180 50% 50%')
      expect(Object.keys(result)).toHaveLength(1)
    })

    it('returns empty object for invalid input', () => {
      expect(parseCssVariables('')).toEqual({})
      expect(parseCssVariables('no variables here')).toEqual({})
    })
  })

  describe('formatCssVariables', () => {
    it('formats variables as CSS custom properties', () => {
      const variables = {
        '--background': '222 47% 11%',
        '--foreground': '210 40% 98%',
      }
      const result = formatCssVariables(variables as unknown as ThemeVariables)
      expect(result).toContain(':root {')
      expect(result).toContain('--background: 222 47% 11%;')
      expect(result).toContain('--foreground: 210 40% 98%;')
      expect(result).toContain('}')
    })

    it('handles radius variable', () => {
      const variables = { '--radius': '0.5rem' }
      const result = formatCssVariables(variables as unknown as ThemeVariables)
      expect(result).toContain('--radius: 0.5rem;')
    })

    it('skips undefined values', () => {
      const variables = {
        '--background': '222 47% 11%',
        '--undefined-var': undefined,
      }
      const result = formatCssVariables(variables as unknown as ThemeVariables)
      expect(result).toContain('--background')
      expect(result).not.toContain('--undefined-var')
    })

    it('returns empty :root block for empty object', () => {
      const result = formatCssVariables({} as unknown as ThemeVariables)
      expect(result).toBe(':root {\n}')
    })
  })
})
