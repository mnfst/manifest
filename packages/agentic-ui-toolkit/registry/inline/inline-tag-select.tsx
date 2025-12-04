"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Tag {
  id: string
  label: string
  color?: "default" | "blue" | "green" | "red" | "yellow" | "purple"
}

export interface InlineTagSelectProps {
  tags?: Tag[]
  selectedTagIds?: string[]
  onSelectTags?: (tagIds: string[]) => void
  mode?: "single" | "multiple"
  showClear?: boolean
}

const defaultTags: Tag[] = [
  { id: "1", label: "Electronics", color: "blue" },
  { id: "2", label: "Audio", color: "purple" },
  { id: "3", label: "Wireless", color: "green" },
  { id: "4", label: "Apple", color: "default" },
  { id: "5", label: "Premium", color: "yellow" },
  { id: "6", label: "Sale", color: "red" },
]

const colorClasses = {
  default: {
    selected: "bg-primary text-primary-foreground border-primary",
    unselected: "bg-background border-border hover:bg-muted",
  },
  blue: {
    selected: "bg-blue-500 text-white border-blue-500",
    unselected: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  },
  green: {
    selected: "bg-green-500 text-white border-green-500",
    unselected: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  },
  red: {
    selected: "bg-red-500 text-white border-red-500",
    unselected: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
  yellow: {
    selected: "bg-yellow-500 text-white border-yellow-500",
    unselected: "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
  },
  purple: {
    selected: "bg-purple-500 text-white border-purple-500",
    unselected: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  },
}

export function InlineTagSelect({
  tags = defaultTags,
  selectedTagIds = [],
  onSelectTags,
  mode = "multiple",
  showClear = true,
}: InlineTagSelectProps) {
  const [selected, setSelected] = useState<string[]>(selectedTagIds)

  const handleToggle = (tagId: string) => {
    let newSelected: string[]

    if (mode === "single") {
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

  const isSelected = (tagId: string) => selected.includes(tagId)

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const color = tag.color || "default"
          const classes = colorClasses[color]

          return (
            <button
              key={tag.id}
              onClick={() => handleToggle(tag.id)}
              className={cn(
                "inline-flex items-center gap-1 sm:gap-1.5 rounded-full border px-2.5 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm transition-all",
                isSelected(tag.id) ? classes.selected : classes.unselected
              )}
            >
              {isSelected(tag.id) && <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
              {tag.label}
            </button>
          )
        })}
      </div>

      {showClear && selected.length > 0 && (
        <button
          onClick={handleClear}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
          Clear selection ({selected.length})
        </button>
      )}
    </div>
  )
}
