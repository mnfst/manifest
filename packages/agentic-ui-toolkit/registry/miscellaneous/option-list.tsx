'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { useState } from 'react'

/*
 * OptionList Component - ChatGPT UI Guidelines Compliant
 * - Use system colors (bg-card instead of specific colors)
 * - Selection uses ring-1 pattern for no layout jumps
 * - Single/multiple selection modes
 * - Compact pill/chip design
 */

export interface Option {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  disabled?: boolean
}

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
    selectedOptionId?: string
    selectedOptionIds?: string[]
  }
}

const defaultOptions: Option[] = [
  { id: '1', label: 'Standard shipping', description: '3-5 business days' },
  { id: '2', label: 'Express shipping', description: '1-2 business days' },
  { id: '3', label: 'Store pickup', description: 'Available in 2h' }
]

export function OptionList({ data, actions, appearance, control }: OptionListProps) {
  const { options = defaultOptions } = data ?? {}
  const { onSelectOption, onSelectOptions } = actions ?? {}
  const { multiple = false } = appearance ?? {}
  const { selectedOptionId, selectedOptionIds = [] } = control ?? {}
  const [selected, setSelected] = useState<string | string[]>(
    multiple ? selectedOptionIds : selectedOptionId || ''
  )

  const handleSelect = (option: Option) => {
    if (option.disabled) return

    if (multiple) {
      const currentSelected = selected as string[]
      const newSelected = currentSelected.includes(option.id)
        ? currentSelected.filter((id) => id !== option.id)
        : [...currentSelected, option.id]
      setSelected(newSelected)
      onSelectOptions?.(options.filter((o) => newSelected.includes(o.id)))
    } else {
      setSelected(option.id)
      onSelectOption?.(option)
    }
  }

  const isSelected = (id: string) => {
    if (multiple) {
      return (selected as string[]).includes(id)
    }
    return selected === id
  }

  return (
    <div className="w-full bg-card rounded-lg p-4">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option)}
            disabled={option.disabled}
            className={cn(
              'inline-flex items-center gap-1.5 sm:gap-2 rounded-full border px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm transition-colors cursor-pointer',
              isSelected(option.id)
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
                  isSelected(option.id)
                    ? 'text-background/70'
                    : 'text-muted-foreground'
                )}
              >
                · {option.description}
              </span>
            )}
            {isSelected(option.id) && multiple && (
              <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
