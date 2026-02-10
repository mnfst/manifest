import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCodeValidation } from '../useCodeValidation'

interface ValidationResult {
  isValid: boolean
  error: { message: string; line: number; column: number } | null
}

describe('useCodeValidation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns valid state for empty code', async () => {
    const { result } = renderHook(() => useCodeValidation(''))

    // Fast-forward past debounce
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isValid).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('returns valid state for whitespace-only code', async () => {
    const { result } = renderHook(() => useCodeValidation('   \n\t  '))

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isValid).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('validates valid JavaScript code successfully', async () => {
    const validCode = `
      const x = 5;
      const result = x * 2;
      return result;
    `
    const { result } = renderHook(() => useCodeValidation(validCode))

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isValid).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('validates full function definitions', async () => {
    const functionCode = `function process(input) {
      return input.toUpperCase();
    }`
    const { result } = renderHook(() => useCodeValidation(functionCode))

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isValid).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('validates arrow function definitions', async () => {
    const arrowCode = `const handler = (x) => x * 2`
    const { result } = renderHook(() => useCodeValidation(arrowCode))

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isValid).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('detects syntax errors', async () => {
    const invalidCode = `const x = ;`
    const { result } = renderHook(() => useCodeValidation(invalidCode))

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isValid).toBe(false)
    expect(result.current.error).not.toBeNull()
    expect(result.current.error?.message).toBeDefined()
  })

  it('provides line and column info for errors', async () => {
    const invalidCode = `const x = 5
const y = `
    const { result } = renderHook(() => useCodeValidation(invalidCode))

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isValid).toBe(false)
    expect(result.current.error?.line).toBeGreaterThanOrEqual(1)
    expect(result.current.error?.column).toBeGreaterThanOrEqual(0)
  })

  it('strips TypeScript type annotations before validation', async () => {
    const tsCode = `
      function greet(name: string): string {
        return "Hello " + name;
      }
    `
    const { result } = renderHook(() => useCodeValidation(tsCode))

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isValid).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('strips TypeScript interface declarations', async () => {
    const tsCode = `
      interface User { name: string }
      const x = 5;
    `
    const { result } = renderHook(() => useCodeValidation(tsCode))

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isValid).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('strips TypeScript type declarations', async () => {
    const tsCode = `
      type ID = string;
      const x = 5;
    `
    const { result } = renderHook(() => useCodeValidation(tsCode))

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isValid).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('debounces validation with default delay', async () => {
    const { result, rerender } = renderHook(
      ({ code }) => useCodeValidation(code),
      { initialProps: { code: 'const a = 1' } }
    )

    // Initially should be validating
    expect(result.current.isValidating).toBe(true)

    // Change code before debounce completes
    rerender({ code: 'const b = 2' })

    // Still validating
    expect(result.current.isValidating).toBe(true)

    // Advance time past debounce
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isValidating).toBe(false)
    expect(result.current.isValid).toBe(true)
  })

  it('respects custom debounce delay', async () => {
    const { result } = renderHook(() => useCodeValidation('const x = 5', 500))

    // Should still be validating after 300ms
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.isValidating).toBe(true)

    // Should be done after 500ms total
    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.isValidating).toBe(false)
  })

  it('provides validateNow for immediate validation', async () => {
    const { result } = renderHook(() => useCodeValidation('const x = 5'))

    // Call validateNow without waiting for debounce
    let validationResult: ValidationResult | undefined
    act(() => {
      validationResult = result.current.validateNow()
    })

    expect(validationResult).toEqual({ isValid: true, error: null })
    expect(result.current.isValid).toBe(true)
    expect(result.current.isValidating).toBe(false)
  })

  it('validateNow returns error for invalid code', async () => {
    const { result } = renderHook(() => useCodeValidation('const x = ;'))

    let validationResult: ValidationResult | undefined
    act(() => {
      validationResult = result.current.validateNow()
    })

    expect(validationResult!.isValid).toBe(false)
    expect(validationResult!.error).not.toBeNull()
  })
})
