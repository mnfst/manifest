'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { useState } from 'react'

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
    <div className="w-full bg-white dark:bg-zinc-900 rounded-md sm:rounded-lg p-4">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option)}
            disabled={option.disabled}
            className={cn(
              'inline-flex items-center gap-1.5 sm:gap-2 rounded-full border px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm transition-all',
              isSelected(option.id)
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted',
              option.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {option.icon}
            <span>{option.label}</span>
            {option.description && (
              <span
                className={cn(
                  'text-[10px] sm:text-xs',
                  isSelected(option.id)
                    ? 'text-primary-foreground/70'
                    : 'text-muted-foreground'
                )}
              >
                • {option.description}
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
