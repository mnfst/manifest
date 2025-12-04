"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

export interface InlineAmountInputProps {
  value?: number
  min?: number
  max?: number
  step?: number
  currency?: string
  label?: string
  presets?: number[]
  onChange?: (value: number) => void
  onConfirm?: (value: number) => void
}

export function InlineAmountInput({
  value = 50,
  min = 0,
  max = 10000,
  step = 10,
  currency = "EUR",
  label = "Amount",
  presets = [20, 50, 100, 200],
  onChange,
  onConfirm,
}: InlineAmountInputProps) {
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
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleChange(amount - step)}
            disabled={amount <= min}
            className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="min-w-28 text-center">
            {isEditing ? (
              <div className="flex items-center justify-center gap-1">
                <span className="text-2xl font-bold text-muted-foreground">
                  {getCurrencySymbol()}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={amount}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  onKeyDown={handleInputKeyDown}
                  className="w-20 text-2xl font-bold bg-transparent border-b-2 border-primary text-center outline-none"
                />
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="text-2xl font-bold hover:text-primary transition-colors"
              >
                {getCurrencySymbol()}{amount}
              </button>
            )}
          </div>
          <button
            onClick={() => handleChange(amount + step)}
            disabled={amount >= max}
            className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => handlePreset(preset)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
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
          <Button size="sm" onClick={() => onConfirm(amount)}>
            Confirm
          </Button>
        )}
      </div>
    </div>
  )
}
