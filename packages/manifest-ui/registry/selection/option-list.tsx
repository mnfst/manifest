'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { demoOptions } from './demo/data'

/**
 * Represents a selectable option.
 * @interface Option
 * @property {string} label - Display label
 * @property {string} [description] - Optional description text
 * @property {React.ReactNode} [icon] - Optional icon element
 * @property {boolean} [disabled] - Whether option is disabled
 */
export interface Option {
  label: string
  description?: string
  icon?: React.ReactNode
  disabled?: boolean
}

/**
 * Props for the OptionList component.
 * @interface OptionListProps
 * @property {object} [data] - Option data
 * @property {Option[]} [data.options] - Array of options
 * @property {object} [actions] - Callback functions
 * @property {function} [actions.onSelectOption] - Called on single selection
 * @property {function} [actions.onSelectOptions] - Called on multiple selection
 * @property {object} [appearance] - Visual customization
 * @property {boolean} [appearance.multiple] - Enable multiple selection
 * @property {object} [control] - State control
 * @property {number} [control.selectedOptionIndex] - Controlled selected index
 * @property {number[]} [control.selectedOptionIndexes] - Controlled selected indexes
 */
export interface OptionListProps {
  data?: {
    options?: Option[]
  }
  actions?: {
    onSelectOption?: (option: Option) => void
    onSelectOptions?: (options: Option[]) => void
  }
  appearance?: {
    multiple?: boolean
  }
  control?: {
    selectedOptionIndex?: number
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
  const { options = demoOptions } = data ?? {}
  const { onSelectOption, onSelectOptions } = actions ?? {}
  const { multiple = false } = appearance ?? {}
  const { selectedOptionIndex, selectedOptionIndexes = [] } = control ?? {}
  const [selected, setSelected] = useState<number | number[]>(
    multiple ? selectedOptionIndexes : selectedOptionIndex ?? -1
  )

  const handleSelect = (option: Option, index: number) => {
    if (option.disabled) return

    if (multiple) {
      const currentSelected = selected as number[]
      const newSelected = currentSelected.includes(index)
        ? currentSelected.filter((i) => i !== index)
        : [...currentSelected, index]
      setSelected(newSelected)
      onSelectOptions?.(options.filter((_, i) => newSelected.includes(i)))
    } else {
      setSelected(index)
      onSelectOption?.(option)
    }
  }

  const isSelected = (index: number) => {
    if (multiple) {
      return (selected as number[]).includes(index)
    }
    return selected === index
  }

  return (
    <div className="w-full bg-card rounded-lg p-4">
      <div className="flex flex-wrap gap-2">
        {options.map((option, index) => (
          <button
            key={index}
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
            <span>{option.label}</span>
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
    </div>
  )
}
