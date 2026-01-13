'use client'

import { cn } from '@/lib/utils'

/**
 * Represents a quick reply option.
 * @interface QuickReply
 * @property {string} id - Unique identifier for the reply
 * @property {string} label - Display text for the reply button
 * @property {React.ReactNode} [icon] - Optional icon displayed before the label
 */
export interface QuickReply {
  id: string
  label: string
  icon?: React.ReactNode
}

/**
 * Props for the QuickReply component.
 * @interface QuickReplyProps
 * @property {object} [data] - Replies data
 * @property {QuickReply[]} [data.replies] - Array of quick reply options
 * @property {object} [actions] - Callback functions for user actions
 * @property {function} [actions.onSelectReply] - Called when a reply is selected
 */
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

/**
 * A quick reply button set for chat interfaces.
 * Displays predefined response options as pill-shaped buttons.
 *
 * Features:
 * - Pill-shaped action buttons
 * - Optional icons
 * - Hover state visual feedback
 * - Compact responsive design
 *
 * @component
 * @example
 * ```tsx
 * <QuickReply
 *   data={{
 *     replies: [
 *       { id: "1", label: "Yes, confirm" },
 *       { id: "2", label: "No thanks" },
 *       { id: "3", label: "I have a question" }
 *     ]
 *   }}
 *   actions={{
 *     onSelectReply: (reply) => console.log("Selected:", reply.label)
 *   }}
 * />
 * ```
 */
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
