'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'

// Import types from shared types file to avoid circular dependencies
import type { Option } from './types'
// Re-export for backward compatibility
export type { Option } from './types'

import { demoOptions } from './demo/selection'


/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OptionListProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the OptionList component, which displays selectable options with
 * support for single or multiple selection modes.
 */
export interface OptionListProps {
  data?: {
    /** Array of selectable options to display. */
    options?: Option[]
  }
  actions?: {
    /** Called when the user confirms their selection. Returns selected option(s). */
    onSubmit?: (selected: Option[]) => void
  }
  appearance?: {
    /**
     * Enable multiple selection mode.
     * @default false
     */
    multiple?: boolean
  }
  control?: {
    /** Controlled selected index for single selection mode. */
    selectedOptionIndex?: number
    /** Controlled selected indexes for multiple selection mode. */
    selectedOptionIndexes?: number[]
  }
}

/**
 * An option list component with single or multiple selection.
 * Uses compact pill/chip design with check indicators.
 *
 * Features:
 * - Single and multiple selection modes
 * - Optional descriptions and icons
 * - Disabled state support
 * - Controlled and uncontrolled usage
 *
 * @component
 * @example
 * ```tsx
 * <OptionList
 *   data={{
 *     options: [
 *       { label: "Option A" },
 *       { label: "Option B", description: "With description" },
 *       { label: "Option C", disabled: true }
 *     ]
 *   }}
 *   appearance={{ multiple: true }}
 *   actions={{ onSelectOptions: (opts) => console.log(opts) }}
 * />
 * ```
 */
export function OptionList({ data, actions, appearance, control }: OptionListProps) {
  const resolved: NonNullable<OptionListProps['data']> = data ?? { options: demoOptions }
  const options = resolved.options ?? []
  const onSubmit = actions?.onSubmit
  const multiple = appearance?.multiple ?? false
  const selectedOptionIndex = control?.selectedOptionIndex
  const selectedOptionIndexes = control?.selectedOptionIndexes
  const [selected, setSelected] = useState<number | number[]>(
    multiple ? (selectedOptionIndexes ?? []) : selectedOptionIndex ?? -1
  )

  // Sync internal state when controlled props change
  useEffect(() => {
    if (multiple) {
      setSelected(selectedOptionIndexes ?? [])
    } else if (selectedOptionIndex !== undefined) {
      setSelected(selectedOptionIndex)
    }
  }, [multiple, selectedOptionIndex, selectedOptionIndexes])

  const handleSelect = (option: Option, index: number) => {
    if (option.disabled) return

    if (multiple) {
      const currentSelected = selected as number[]
      const newSelected = currentSelected.includes(index)
        ? currentSelected.filter((i) => i !== index)
        : [...currentSelected, index]
      setSelected(newSelected)
    } else {
      setSelected(index)
    }
  }

  const handleSubmit = () => {
    if (multiple) {
      const selectedIndexes = selected as number[]
      onSubmit?.(options.filter((_, i) => selectedIndexes.includes(i)))
    } else {
      const selectedIndex = selected as number
      if (selectedIndex >= 0) {
        onSubmit?.([options[selectedIndex]])
      }
    }
  }

  const isSelected = (index: number) => {
    if (multiple) {
      return (selected as number[]).includes(index)
    }
    return selected === index
  }

  const hasSelection = multiple
    ? (selected as number[]).length > 0
    : (selected as number) >= 0

  return (
    <div className="w-full bg-card rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((option, index) => (
          <button
            key={option.label || index}
            onClick={() => handleSelect(option, index)}
            disabled={option.disabled}
            className={cn(
              'inline-flex items-center gap-1.5 sm:gap-2 rounded-full border px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm transition-colors cursor-pointer',
              isSelected(index)
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-background hover:bg-muted',
              option.disabled && 'opacity-50 !cursor-not-allowed'
            )}
          >
            {option.icon}
            {option.label && <span>{option.label}</span>}
            {option.description && (
              <span
                className={cn(
                  'text-[10px] sm:text-xs',
                  isSelected(index)
                    ? 'text-background/70'
                    : 'text-muted-foreground'
                )}
              >
                · {option.description}
              </span>
            )}
            {isSelected(index) && multiple && (
              <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            )}
          </button>
        ))}
      </div>
      {onSubmit && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!hasSelection}
          >
            Confirm
          </Button>
        </div>
      )}
    </div>
  )
}
