'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { demoProgressSteps } from './demo/status'

/**
 * Represents an individual step in the progress tracker.
 * @interface Step
 * @property {string} [label] - Display text for the step
 * @property {"completed" | "current" | "pending"} [status] - Current status of the step
 */
export interface Step {
  label?: string
  status?: 'completed' | 'current' | 'pending'
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ProgressStepsProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the ProgressSteps component, which displays a visual progress
 * tracker showing sequential steps with completion states.
 */
export interface ProgressStepsProps {
  data?: {
    /** Array of steps to display with their labels and status. */
    steps?: Step[]
  }
}


/**
 * A progress stepper component showing sequential step status.
 * Displays steps with completed, current, and pending states.
 *
 * Features:
 * - Three step states: completed, current, pending
 * - Check icon for completed steps
 * - Responsive horizontal/vertical layout
 * - Connected step indicators
 *
 * @component
 * @example
 * ```tsx
 * <ProgressSteps
 *   data={{
 *     steps: [
 *       { label: "Order received", status: "completed" },
 *       { label: "Processing", status: "completed" },
 *       { label: "Shipping", status: "current" },
 *       { label: "Delivery", status: "pending" }
 *     ]
 *   }}
 * />
 * ```
 */
export function ProgressSteps({ data }: ProgressStepsProps) {
  const resolved: NonNullable<ProgressStepsProps['data']> = data ?? { steps: demoProgressSteps }
  const steps = resolved.steps ?? []
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 bg-card rounded-lg p-4">
      {steps.map((step, index) => {
        const stepStatus = step.status ?? 'pending'
        return (
          <div key={index} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-xs flex-shrink-0',
                  stepStatus === 'completed' && 'bg-foreground text-background',
                  stepStatus === 'current' && 'border-2 border-foreground',
                  stepStatus === 'pending' && 'border border-muted-foreground/40'
                )}
              >
                {stepStatus === 'completed' && <Check className="h-3 w-3" />}
              </div>
              {step.label && (
                <span
                  className={cn(
                    'text-xs sm:text-sm',
                    stepStatus === 'current' && 'font-medium',
                    stepStatus === 'pending' && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              )}
            </div>
            {index < steps.length - 1 && (
              <div className="hidden sm:block w-4 h-px bg-border" />
            )}
          </div>
        )
      })}
    </div>
  )
}
