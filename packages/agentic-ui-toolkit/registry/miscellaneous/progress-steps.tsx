'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

/*
 * ProgressSteps Component - ChatGPT UI Guidelines Compliant
 * - Use system colors (bg-card instead of specific colors)
 * - Horizontal/vertical responsive layout
 * - Clear visual hierarchy for step states
 * - Step-by-step inline wizard pattern
 */

export interface Step {
  id: string
  label: string
  status: 'completed' | 'current' | 'pending'
}

export interface ProgressStepsProps {
  data?: {
    steps?: Step[]
  }
}

const defaultSteps: Step[] = [
  { id: '1', label: 'Order received', status: 'completed' },
  { id: '2', label: 'Processing', status: 'completed' },
  { id: '3', label: 'Shipping', status: 'current' },
  { id: '4', label: 'Delivery', status: 'pending' }
]

export function ProgressSteps({ data }: ProgressStepsProps) {
  const { steps = defaultSteps } = data ?? {}
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 bg-card rounded-lg p-4">
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
            <div className="hidden sm:block w-4 h-px bg-border" />
          )}
        </div>
      ))}
    </div>
  )
}
