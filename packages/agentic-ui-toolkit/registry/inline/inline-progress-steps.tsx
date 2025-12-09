'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export interface Step {
  id: string
  label: string
  status: 'completed' | 'current' | 'pending'
}

export interface InlineProgressStepsProps {
  steps?: Step[]
}

const defaultSteps: Step[] = [
  { id: '1', label: 'Order received', status: 'completed' },
  { id: '2', label: 'Processing', status: 'completed' },
  { id: '3', label: 'Shipping', status: 'current' },
  { id: '4', label: 'Delivery', status: 'pending' }
]

export function InlineProgressSteps({
  steps = defaultSteps
}: InlineProgressStepsProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 bg-white dark:bg-zinc-900 rounded-md sm:rounded-lg p-4">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-xs flex-shrink-0',
                step.status === 'completed' && 'bg-foreground text-background',
                step.status === 'current' && 'border-2 border-foreground',
                step.status === 'pending' && 'border border-muted-foreground/40'
              )}
            >
              {step.status === 'completed' && <Check className="h-3 w-3" />}
            </div>
            <span
              className={cn(
                'text-xs sm:text-sm',
                step.status === 'current' && 'font-medium',
                step.status === 'pending' && 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className="hidden sm:block w-4 h-px bg-muted-foreground/30" />
          )}
        </div>
      ))}
    </div>
  )
}
