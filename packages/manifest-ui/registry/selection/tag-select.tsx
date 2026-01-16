'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'
import { useState } from 'react'

/**
 * Represents an individual tag option.
 * @interface Tag
 * @property {string} id - Unique identifier for the tag
 * @property {string} label - Display text for the tag
 * @property {"default" | "blue" | "green" | "red" | "yellow" | "purple"} [color] - Optional color theme
 */
export interface Tag {
  id: string
  label: string
  color?: 'default' | 'blue' | 'green' | 'red' | 'yellow' | 'purple'
}

/**
 * Props for the TagSelect component.
 * @interface TagSelectProps
 * @property {object} [data] - Tags data
 * @property {Tag[]} [data.tags] - Array of tags to display
 * @property {object} [actions] - Callback functions for user actions
 * @property {function} [actions.onSelectTags] - Called when tag selection changes
 * @property {function} [actions.onValidate] - Called when user clicks validate button
 * @property {object} [appearance] - Visual customization options
 * @property {"single" | "multiple"} [appearance.mode] - Selection mode
 * @property {boolean} [appearance.showClear] - Show clear selection button
 * @property {boolean} [appearance.showValidate] - Show validate button
 * @property {string} [appearance.validateLabel] - Custom label for validate button
 * @property {object} [control] - State control options
 * @property {string[]} [control.selectedTagIds] - Array of selected tag IDs
 */
export interface TagSelectProps {
  /** Content and data to display */
  data?: {
    tags?: Tag[]
  }
  /** User-triggerable callbacks */
  actions?: {
    onSelectTags?: (tagIds: string[]) => void
    onValidate?: (tagIds: string[]) => void
  }
  /** Visual configuration options */
  appearance?: {
    mode?: 'single' | 'multiple'
    showClear?: boolean
    showValidate?: boolean
    validateLabel?: string
  }
  /** State management */
  control?: {
    selectedTagIds?: string[]
  }
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

/**
 * A tag selection component with single or multiple selection modes.
 * Features clear selection and validate buttons for user actions.
 *
 * Features:
 * - Single or multiple selection modes
 * - Check icon on selected tags
 * - Clear selection button with count
 * - Validate button with selection count
 * - Neutral system color scheme
 *
 * @component
 * @example
 * ```tsx
 * <TagSelect
 *   data={{
 *     tags: [
 *       { id: "1", label: "Electronics" },
 *       { id: "2", label: "Audio" },
 *       { id: "3", label: "Wireless" }
 *     ]
 *   }}
 *   actions={{
 *     onSelectTags: (ids) => console.log("Selected:", ids),
 *     onValidate: (ids) => console.log("Validated:", ids)
 *   }}
 *   appearance={{
 *     mode: "multiple",
 *     showClear: true,
 *     showValidate: true,
 *     validateLabel: "Apply filters"
 *   }}
 * />
 * ```
 */
export function TagSelect({ data, actions, appearance, control }: TagSelectProps) {
  const { tags = defaultTags } = data ?? {}
  const { onSelectTags, onValidate } = actions ?? {}
  const { mode = 'multiple', showClear = true, showValidate = true, validateLabel = 'Validate selection' } = appearance ?? {}
  const { selectedTagIds = [] } = control ?? {}
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
              'inline-flex items-center gap-1 sm:gap-1.5 rounded-full border px-2.5 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm transition-colors cursor-pointer',
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
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
