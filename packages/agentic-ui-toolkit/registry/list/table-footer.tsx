'use client'

import { RefreshCw } from 'lucide-react'

export interface TableFooterProps {
  data?: {
    moreCount?: number
    lastUpdated?: Date | string
  }
  actions?: {
    onRefresh?: () => void
    onShowMore?: () => void
  }
  appearance?: {
    showMoreCount?: boolean
    showTimestamp?: boolean
    showRefresh?: boolean
  }
}

export function TableFooter({ data, actions, appearance }: TableFooterProps) {
  const { moreCount = 4, lastUpdated = new Date() } = data ?? {}
  const { onRefresh, onShowMore } = actions ?? {}
  const {
    showMoreCount = true,
    showTimestamp = true,
    showRefresh = true
  } = appearance ?? {}

  const formatTimestamp = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const hasLeftContent = (showMoreCount && moreCount > 0) || showTimestamp

  return (
    <div className="flex items-center justify-between rounded-b-lg border border-t-0 bg-muted/50 px-4 py-2">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {showMoreCount && moreCount > 0 && (
          <button
            onClick={onShowMore}
            className="hover:text-foreground transition-colors cursor-pointer"
          >
            +{moreCount} more
          </button>
        )}
        {showMoreCount && moreCount > 0 && showTimestamp && (
          <span className="text-muted-foreground/50">·</span>
        )}
        {showTimestamp && (
          <span>Data as of {formatTimestamp(lastUpdated)}</span>
        )}
        {!hasLeftContent && <span>&nbsp;</span>}
      </div>
      {showRefresh && (
        <button
          onClick={onRefresh}
          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
