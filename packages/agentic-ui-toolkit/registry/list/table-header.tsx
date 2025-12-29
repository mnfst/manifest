'use client'

import { Maximize2 } from 'lucide-react'

export interface TableHeaderProps {
  data?: {
    title?: string
    titleImage?: string
  }
  actions?: {
    onExpand?: () => void
  }
  appearance?: {
    showExpand?: boolean
  }
}

export function TableHeader({ data, actions, appearance }: TableHeaderProps) {
  const { title = 'Table', titleImage } = data ?? {}
  const { onExpand } = actions ?? {}
  const { showExpand = true } = appearance ?? {}

  const hasContent = title || titleImage

  if (!hasContent && !showExpand) return null

  return (
    <div className="flex items-center justify-between rounded-t-lg border border-b-0 bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        {titleImage && (
          <img
            src={titleImage}
            alt=""
            className="h-5 w-5 rounded object-cover"
          />
        )}
        {title && <span className="font-medium">{title}</span>}
      </div>
      {showExpand && onExpand && (
        <button
          onClick={onExpand}
          className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          aria-label="Expand"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      )}
      {showExpand && !onExpand && <div className="w-8" />}
      {!showExpand && <div className="w-0" />}
    </div>
  )
}
