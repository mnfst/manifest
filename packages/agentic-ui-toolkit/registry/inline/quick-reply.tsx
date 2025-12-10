'use client'

import { cn } from '@/lib/utils'

export interface QuickReply {
  id: string
  label: string
  value?: string
  icon?: React.ReactNode
}

export interface QuickReplyProps {
  replies?: QuickReply[]
  onSelectReply?: (reply: QuickReply) => void
}

const defaultReplies: QuickReply[] = [
  { id: '1', label: 'Yes, confirm' },
  { id: '2', label: 'No thanks' },
  { id: '3', label: 'I have a question' },
  { id: '4', label: 'View details' }
]

export function QuickReply({
  replies = defaultReplies,
  onSelectReply
}: QuickReplyProps) {
  return (
    <div className="w-full bg-white dark:bg-zinc-900 rounded-md sm:rounded-lg p-4">
      <div className="flex flex-wrap gap-2">
        {replies.map((reply) => (
          <button
            key={reply.id}
            onClick={() => onSelectReply?.(reply)}
            className={cn(
              'inline-flex items-center gap-1 sm:gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-primary transition-all',
              'hover:bg-primary hover:text-primary-foreground hover:border-primary'
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
