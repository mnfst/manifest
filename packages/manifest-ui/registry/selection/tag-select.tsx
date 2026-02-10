'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { demoTags } from './demo/selection'

/**
 * Represents an individual tag option.
 * @interface Tag
 * @property {string} id - Unique identifier for the tag
 * @property {string} label - Display text for the tag
 * @property {"default" | "blue" | "green" | "red" | "yellow" | "purple"} [color] - Optional color theme
 */
export interface Tag {
  id?: string
  label?: string
  color?: 'default' | 'blue' | 'green' | 'red' | 'yellow' | 'purple'
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TagSelectProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the TagSelect component, which provides tag-based filtering with
 * single or multiple selection modes and validation support.
 */
export interface TagSelectProps {
  data?: {
    /** Array of tags to display for selection. */
    tags?: Tag[]
  }
  actions?: {
    /** Called when the user clicks the validate button with the selected tag IDs. */
    onValidate?: (tagIds: string[]) => void
  }
  appearance?: {
    /**
     * Selection mode: single allows one tag, multiple allows many.
     * @default "multiple"
     */
    mode?: 'single' | 'multiple'
    /**
     * Whether to show the clear selection button.
     * @default true
     */
    showClear?: boolean
    /**
     * Whether to show the validate button.
     * @default true
     */
    showValidate?: boolean
    /**
     * Custom label for the validate button.
     * @default "Validate selection"
     */
    validateLabel?: string
  }
  control?: {
    /** Array of pre-selected tag IDs for controlled mode. */
    selectedTagIds?: string[]
  }
}


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
  const resolved: NonNullable<TagSelectProps['data']> = data ?? { tags: demoTags }
  const tags = resolved.tags ?? []
  const onValidate = actions?.onValidate
  const mode = appearance?.mode ?? 'multiple'
  const showClear = appearance?.showClear ?? true
  const showValidate = appearance?.showValidate ?? true
  const validateLabel = appearance?.validateLabel ?? 'Validate selection'
  const selectedTagIds = control?.selectedTagIds
  const [selected, setSelected] = useState<string[]>(selectedTagIds ?? [])

  // Sync internal state when controlled prop changes
  useEffect(() => {
    setSelected(selectedTagIds ?? [])
  }, [selectedTagIds])

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
  }

  const handleClear = () => {
    setSelected([])
  }

  const handleValidate = () => {
    onValidate?.(selected)
  }

  const isSelected = (tagId: string) => selected.includes(tagId)

  return (
    <div className="w-full space-y-2 bg-card rounded-lg p-4">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => {
          const tagId = tag.id ?? `tag-${index}`
          return (
            <button
              key={tagId}
              onClick={() => handleToggle(tagId)}
              className={cn(
                'inline-flex items-center gap-1 sm:gap-1.5 rounded-full border px-2.5 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm transition-colors cursor-pointer',
                isSelected(tagId) ? tagClasses.selected : tagClasses.unselected
              )}
            >
              {isSelected(tagId) && (
                <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              )}
              {tag.label && <span>{tag.label}</span>}
            </button>
          )
        })}
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
