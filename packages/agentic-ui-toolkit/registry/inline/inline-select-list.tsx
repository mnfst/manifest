"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Check, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface SelectOption {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  badge?: string
  disabled?: boolean
}

export interface SelectOptionGroup {
  group: string
  items: SelectOption[]
}

export interface InlineSelectListProps {
  options?: SelectOption[] | SelectOptionGroup[]
  value?: string | string[]
  onChange?: (value: string | string[], selectedOptions: SelectOption[]) => void
  mode?: "single" | "multi"
  showConfirm?: boolean
  confirmLabel?: string
  compact?: boolean
  grouped?: boolean
  emptyMessage?: string
}

const defaultOptions: SelectOption[] = [
  {
    id: "standard",
    label: "Standard shipping",
    description: "3-5 business days",
    badge: "Free",
  },
  {
    id: "express",
    label: "Express shipping",
    description: "1-2 business days",
    badge: "$9.99",
  },
  {
    id: "overnight",
    label: "Overnight shipping",
    description: "Next business day",
    badge: "$19.99",
  },
]

const defaultGroupedOptions: SelectOptionGroup[] = [
  {
    group: "Delivery",
    items: [
      { id: "standard", label: "Standard shipping", description: "3-5 business days", badge: "Free" },
      { id: "express", label: "Express shipping", description: "1-2 business days", badge: "$9.99" },
      { id: "overnight", label: "Overnight shipping", description: "Next day", badge: "$19.99" },
    ],
  },
  {
    group: "Pickup",
    items: [
      { id: "store", label: "Store pickup", description: "Available in 2h" },
      { id: "locker", label: "Parcel locker", description: "24/7 access" },
    ],
  },
]

function isGroupedOptions(options: SelectOption[] | SelectOptionGroup[]): options is SelectOptionGroup[] {
  return options.length > 0 && "group" in options[0]
}

function flattenOptions(options: SelectOption[] | SelectOptionGroup[]): SelectOption[] {
  if (isGroupedOptions(options)) {
    return options.flatMap((group) => group.items)
  }
  return options
}

export function InlineSelectList({
  options,
  value,
  onChange,
  mode = "single",
  showConfirm = false,
  confirmLabel = "Confirm selection",
  compact = false,
  grouped = false,
  emptyMessage = "No options available",
}: InlineSelectListProps) {
  const resolvedOptions = options ?? (grouped ? defaultGroupedOptions : defaultOptions)
  const flatOptions = flattenOptions(resolvedOptions)

  const [internalValue, setInternalValue] = useState<string[]>(() => {
    if (value === undefined) return []
    return Array.isArray(value) ? value : [value]
  })
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [pendingSelection, setPendingSelection] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  const selectedIds = value !== undefined
    ? (Array.isArray(value) ? value : [value])
    : (showConfirm && mode === "multi" ? pendingSelection : internalValue)

  const isSelected = useCallback((id: string) => selectedIds.includes(id), [selectedIds])

  const handleSelect = useCallback(
    (option: SelectOption) => {
      if (option.disabled) return

      let newValue: string[]

      if (mode === "single") {
        newValue = [option.id]
      } else {
        if (selectedIds.includes(option.id)) {
          newValue = selectedIds.filter((id) => id !== option.id)
        } else {
          newValue = [...selectedIds, option.id]
        }
      }

      if (showConfirm && mode === "multi") {
        setPendingSelection(newValue)
      } else {
        setInternalValue(newValue)
        const selected = flatOptions.filter((o) => newValue.includes(o.id))
        onChange?.(mode === "single" ? newValue[0] : newValue, selected)
      }
    },
    [mode, selectedIds, showConfirm, flatOptions, onChange]
  )

  const handleConfirm = useCallback(() => {
    setInternalValue(pendingSelection)
    const selected = flatOptions.filter((o) => pendingSelection.includes(o.id))
    onChange?.(pendingSelection, selected)
  }, [pendingSelection, flatOptions, onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const enabledOptions = flatOptions.filter((o) => !o.disabled)
      const enabledIndices = enabledOptions.map((o) => flatOptions.indexOf(o))

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setFocusedIndex((prev) => {
            const currentPos = enabledIndices.indexOf(prev)
            const nextPos = currentPos < enabledIndices.length - 1 ? currentPos + 1 : 0
            return enabledIndices[nextPos] ?? -1
          })
          break
        case "ArrowUp":
          e.preventDefault()
          setFocusedIndex((prev) => {
            const currentPos = enabledIndices.indexOf(prev)
            const nextPos = currentPos > 0 ? currentPos - 1 : enabledIndices.length - 1
            return enabledIndices[nextPos] ?? -1
          })
          break
        case "Enter":
        case " ":
          e.preventDefault()
          if (focusedIndex >= 0 && flatOptions[focusedIndex]) {
            handleSelect(flatOptions[focusedIndex])
          }
          break
        case "Escape":
          e.preventDefault()
          if (mode === "multi") {
            setPendingSelection([])
            setInternalValue([])
            onChange?.([], [])
          }
          break
      }
    },
    [flatOptions, focusedIndex, handleSelect, mode, onChange]
  )

  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]')
      items[focusedIndex]?.scrollIntoView({ block: "nearest" })
    }
  }, [focusedIndex])

  const renderOption = (option: SelectOption, index: number) => {
    const selected = isSelected(option.id)
    const focused = focusedIndex === index

    return (
      <button
        key={option.id}
        type="button"
        role="option"
        aria-selected={selected}
        aria-disabled={option.disabled}
        onClick={() => handleSelect(option)}
        onMouseEnter={() => setFocusedIndex(index)}
        disabled={option.disabled}
        className={cn(
          "w-full flex items-center gap-3 rounded-lg border text-left transition-all",
          compact ? "p-2" : "p-3",
          selected
            ? "border-foreground bg-card ring-1 ring-foreground"
            : "border-border bg-card hover:border-foreground/50",
          focused && !selected && "border-foreground/50",
          option.disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Selection indicator */}
        <div
          className={cn(
            "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors",
            selected
              ? "bg-foreground border-foreground text-background"
              : "border-border"
          )}
        >
          {selected && <Check className="h-3 w-3" />}
        </div>

        {/* Icon */}
        {option.icon && (
          <div className="flex-shrink-0 text-muted-foreground">{option.icon}</div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("font-medium truncate", compact ? "text-sm" : "text-sm")}>
              {option.label}
            </span>
            {option.badge && (
              <span
                className={cn(
                  "flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded",
                  selected
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {option.badge}
              </span>
            )}
          </div>
          {option.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {option.description}
            </p>
          )}
        </div>

        {/* Arrow for single select */}
        {mode === "single" && (
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}
      </button>
    )
  }

  const renderGroupedOptions = () => {
    if (!isGroupedOptions(resolvedOptions)) return null

    let globalIndex = 0

    return resolvedOptions.map((group, groupIndex) => (
      <div key={groupIndex} className={groupIndex > 0 ? "mt-4" : ""}>
        <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
          {group.group}
        </div>
        <div className="space-y-2">
          {group.items.map((option) => {
            const index = globalIndex++
            return renderOption(option, index)
          })}
        </div>
      </div>
    ))
  }

  const renderFlatOptions = () => {
    if (isGroupedOptions(resolvedOptions)) return null

    return (
      <div className="space-y-2">
        {resolvedOptions.map((option, index) => renderOption(option, index))}
      </div>
    )
  }

  if (flatOptions.length === 0) {
    return (
      <div className="w-full rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="w-full space-y-3">
      <div
        ref={listRef}
        role="listbox"
        aria-multiselectable={mode === "multi"}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="outline-none"
      >
        {isGroupedOptions(resolvedOptions) ? renderGroupedOptions() : renderFlatOptions()}
      </div>

      {/* Confirm button for multi-select */}
      {showConfirm && mode === "multi" && (
        <Button
          onClick={handleConfirm}
          disabled={pendingSelection.length === 0}
          size="sm"
          className="w-full"
        >
          {confirmLabel}
          {pendingSelection.length > 0 && ` (${pendingSelection.length})`}
        </Button>
      )}

      {/* Selection summary for multi-select without confirm */}
      {!showConfirm && mode === "multi" && selectedIds.length > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          {selectedIds.length} item{selectedIds.length !== 1 ? "s" : ""} selected
        </div>
      )}
    </div>
  )
}
