'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'
import { useState } from 'react'

/*
 * TagSelect Component - ChatGPT UI Guidelines Compliant
 * - Use system colors (neutral grayscale) instead of colorful tags
 * - Selection uses foreground/background contrast
 * - Consistent with system design
 */

export interface Tag {
  id: string
  label: string
  color?: 'default' | 'blue' | 'green' | 'red' | 'yellow' | 'purple'
}

export interface TagSelectProps {
  tags?: Tag[]
  selectedTagIds?: string[]
  onSelectTags?: (tagIds: string[]) => void
  mode?: 'single' | 'multiple'
  showClear?: boolean
  showValidate?: boolean
  validateLabel?: string
  onValidate?: (tagIds: string[]) => void
}

const defaultTags: Tag[] = [
  { id: '1', label: 'Electronics' },
  { id: '2', label: 'Audio' },
  { id: '3', label: 'Wireless' },
  { id: '4', label: 'Apple' },
  { id: '5', label: 'Premium' },
  { id: '6', label: 'Sale' }
]

// ChatGPT-compliant: all tags use neutral system colors
const tagClasses = {
  selected: 'bg-foreground text-background border-foreground',
  unselected: 'bg-background text-foreground border-border hover:bg-muted'
}

export function TagSelect({
  tags = defaultTags,
  selectedTagIds = [],
  onSelectTags,
  mode = 'multiple',
  showClear = true,
  showValidate = true,
  validateLabel = 'Validate selection',
  onValidate
}: TagSelectProps) {
  const [selected, setSelected] = useState<string[]>(selectedTagIds)

  const handleToggle = (tagId: string) => {
    let newSelected: string[]

    if (mode === 'single') {
      newSelected = selected.includes(tagId) ? [] : [tagId]
    } else {
      newSelected = selected.includes(tagId)
        ? selected.filter((id) => id !== tagId)
        : [...selected, tagId]
    }

    setSelected(newSelected)
    onSelectTags?.(newSelected)
  }

  const handleClear = () => {
    setSelected([])
    onSelectTags?.([])
  }

  const handleValidate = () => {
    onValidate?.(selected)
  }

  const isSelected = (tagId: string) => selected.includes(tagId)

  return (
    <div className="w-full space-y-2 bg-card rounded-lg p-4">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => handleToggle(tag.id)}
            className={cn(
              'inline-flex items-center gap-1 sm:gap-1.5 rounded-full border px-2.5 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm transition-colors',
              isSelected(tag.id) ? tagClasses.selected : tagClasses.unselected
            )}
          >
            {isSelected(tag.id) && (
              <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            )}
            {tag.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        {showClear && selected.length > 0 ? (
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Clear selection ({selected.length})
          </button>
        ) : (
          <div />
        )}

        {showValidate && (
          <Button
            onClick={handleValidate}
            disabled={selected.length === 0}
            size="sm"
          >
            {validateLabel}
            {selected.length > 0 && ` (${selected.length})`}
          </Button>
        )}
      </div>
    </div>
  )
}
