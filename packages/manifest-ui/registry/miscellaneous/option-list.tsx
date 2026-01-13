'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { useState } from 'react'

/**
 * Represents an individual option in the list.
 * @interface Option
 * @property {string} id - Unique identifier for the option
 * @property {string} label - Display text for the option
 * @property {string} [description] - Optional description shown after the label
 * @property {React.ReactNode} [icon] - Optional icon displayed before the label
 * @property {boolean} [disabled] - Whether the option is disabled
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
 * @property {object} [data] - Options data
 * @property {Option[]} [data.options] - Array of options to display
 * @property {object} [actions] - Callback functions for user actions
 * @property {function} [actions.onSelectOption] - Called when a single option is selected
 * @property {function} [actions.onSelectOptions] - Called when multiple options are selected
 * @property {object} [appearance] - Visual customization options
 * @property {boolean} [appearance.multiple] - Enable multiple selection mode
 * @property {object} [control] - State control options
 * @property {string} [control.selectedOptionId] - ID of the selected option (single mode)
 * @property {string[]} [control.selectedOptionIds] - IDs of selected options (multiple mode)
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

const defaultOptions: Option[] = [
  { label: 'Standard shipping', description: '3-5 business days' },
  { label: 'Express shipping', description: '1-2 business days' },
  { label: 'Store pickup', description: 'Available in 2h' }
]

/**
 * A selectable option list with single or multiple selection modes.
 * Displays options as pill-shaped buttons with optional icons and descriptions.
 *
 * Features:
 * - Single or multiple selection modes
 * - Optional icons and descriptions
 * - Disabled state support
 * - Compact pill/chip design
 * - Responsive sizing
 *
 * @component
 * @example
 * ```tsx
 * <OptionList
 *   data={{
 *     options: [
 *       { id: "1", label: "Standard shipping", description: "3-5 days" },
 *       { id: "2", label: "Express shipping", description: "1-2 days" }
 *     ]
 *   }}
 *   actions={{
 *     onSelectOption: (option) => console.log("Selected:", option)
 *   }}
 *   appearance={{ multiple: false }}
 * />
 * ```
 */
export function OptionList({ data, actions, appearance, control }: OptionListProps) {
  const { options = defaultOptions } = data ?? {}
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
