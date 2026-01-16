"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AmountInputProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for an amount input with increment/decrement buttons and preset values.
 * Supports direct text editing by clicking on the amount.
 */
export interface AmountInputProps {
  data?: {
    /** Quick-select preset amounts displayed as buttons. */
    presets?: number[]
  }
  actions?: {
    /** Called when the amount changes via buttons, presets, or direct input. */
    onChange?: (value: number) => void
    /** Called when user confirms the selected amount. */
    onConfirm?: (value: number) => void
  }
  appearance?: {
    /**
     * Minimum allowed value.
     * @default 0
     */
    min?: number
    /**
     * Maximum allowed value.
     * @default 10000
     */
    max?: number
    /**
     * Increment/decrement step size for the +/- buttons.
     * @default 10
     */
    step?: number
    /**
     * Currency code for formatting the amount display.
     * @default "EUR"
     */
    currency?: string
    /**
     * Label text displayed above the input.
     * @default "Amount"
     */
    label?: string
  }
  control?: {
    /**
     * Controlled value for the amount input.
     * @default 50
     */
    value?: number
  }
}

/**
 * An amount input with increment/decrement buttons and preset values.
 * Supports direct text editing by clicking on the amount.
 *
 * Features:
 * - Large centered amount display
 * - Plus/minus increment buttons
 * - Preset amount quick-select buttons
 * - Click-to-edit direct input
 * - Min/max value clamping
 * - Configurable step size
 * - Optional confirm button
 *
 * @component
 * @example
 * ```tsx
 * <AmountInput
 *   data={{ presets: [25, 50, 100, 250] }}
 *   actions={{
 *     onChange: (value) => console.log("Amount changed:", value),
 *     onConfirm: (value) => console.log("Confirmed:", value)
 *   }}
 *   appearance={{
 *     min: 10,
 *     max: 500,
 *     step: 5,
 *     currency: "USD",
 *     label: "Donation Amount"
 *   }}
 *   control={{ value: 50 }}
 * />
 * ```
 */
export function AmountInput({ data, actions, appearance, control }: AmountInputProps) {
  const { presets = [20, 50, 100, 200] } = data ?? {}
  const { onChange, onConfirm } = actions ?? {}
  const { min = 0, max = 10000, step = 10, currency = "EUR", label = "Amount" } = appearance ?? {}
  const { value = 50 } = control ?? {}
  const [amount, setAmount] = useState(value)
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const getCurrencySymbol = () => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value || currency
  }

  const handleChange = (newValue: number) => {
    const clamped = Math.max(min, Math.min(max, newValue))
    setAmount(clamped)
    onChange?.(clamped)
  }

  const handlePreset = (preset: number) => {
    setAmount(preset)
    onChange?.(preset)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10)
    if (!isNaN(val)) {
      handleChange(val)
    }
  }

  const handleInputBlur = () => {
    setIsEditing(false)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setIsEditing(false)
    }
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  return (
    <div className="w-full rounded-md sm:rounded-lg bg-card p-3 sm:p-2 space-y-3">
      {/* Amount display with +/- controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <span className="text-xs sm:text-sm text-muted-foreground">{label}</span>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handleChange(amount - step)}
            disabled={amount <= min}
            className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="min-w-24 sm:min-w-28 text-center">
            {isEditing ? (
              <div className="flex items-center justify-center gap-1">
                <span className="text-xl sm:text-2xl font-bold text-muted-foreground">
                  {getCurrencySymbol()}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={amount}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  onKeyDown={handleInputKeyDown}
                  className="w-16 sm:w-20 text-xl sm:text-2xl font-bold bg-transparent border-b-2 border-primary text-center outline-none"
                />
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="text-xl sm:text-2xl font-bold hover:text-primary transition-colors cursor-pointer"
              >
                {getCurrencySymbol()}{amount}
              </button>
            )}
          </div>
          <button
            onClick={() => handleChange(amount + step)}
            disabled={amount >= max}
            className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Presets and confirm */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2">
        <div className="flex flex-wrap justify-center sm:justify-start gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => handlePreset(preset)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs sm:text-sm transition-colors cursor-pointer",
                amount === preset
                  ? "border-foreground ring-1 ring-foreground"
                  : "border-border hover:bg-muted"
              )}
            >
              {getCurrencySymbol()}{preset}
            </button>
          ))}
        </div>
        {onConfirm && (
          <Button size="sm" className="w-full sm:w-auto" onClick={() => onConfirm(amount)}>
            Confirm
          </Button>
        )}
      </div>
    </div>
  )
}
