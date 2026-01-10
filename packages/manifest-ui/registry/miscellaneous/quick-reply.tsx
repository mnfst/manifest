'use client'

import { cn } from '@/lib/utils'

/*
 * QuickReply Component - ChatGPT UI Guidelines Compliant
 * - Clear action buttons for quick responses
 * - Use system colors (neutral grayscale)
 * - Immediate visual feedback on hover
 */

export interface QuickReply {
  id: string
  label: string
  value?: string
  icon?: React.ReactNode
}

export interface QuickReplyProps {
  data?: {
    replies?: QuickReply[]
  }
  actions?: {
    onSelectReply?: (reply: QuickReply) => void
  }
}

const defaultReplies: QuickReply[] = [
  { id: '1', label: 'Yes, confirm' },
  { id: '2', label: 'No thanks' },
  { id: '3', label: 'I have a question' },
  { id: '4', label: 'View details' }
]

export function QuickReply({ data, actions }: QuickReplyProps) {
  const { replies = defaultReplies } = data ?? {}
  const { onSelectReply } = actions ?? {}
  return (
    <div className="w-full bg-card rounded-lg p-4">
      <div className="flex flex-wrap gap-2">
        {replies.map((reply) => (
          <button
            key={reply.id}
            onClick={() => onSelectReply?.(reply)}
            className={cn(
              'inline-flex items-center gap-1 sm:gap-1.5 rounded-full border border-border bg-background px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-foreground transition-colors cursor-pointer',
              'hover:bg-foreground hover:text-background hover:border-foreground'
            )}
          >
            {reply.icon}
            {reply.label}
          </button>
        ))}
      </div>
    </div>
  )
}
