'use client'

import { cn } from '@/lib/utils'

/**
 * Props for the Skeleton component.
 * @interface SkeletonProps
 * @property {object} [appearance] - Visual customization options
 * @property {string} [appearance.className] - Additional CSS classes for sizing and styling
 */
export interface SkeletonProps {
  appearance?: {
    className?: string
  }
}

/**
 * A basic skeleton loading placeholder with pulse animation.
 * Use this as a building block for custom skeleton layouts.
 *
 * @component
 * @example
 * ```tsx
 * <Skeleton appearance={{ className: "h-4 w-32" }} />
 * ```
 */
export function Skeleton({ appearance }: SkeletonProps) {
  const { className } = appearance ?? {}
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

export function SkeletonWeather() {
  return (
    <div className="w-full flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <Skeleton appearance={{ className:"h-8 w-8 rounded-full" }} />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton appearance={{ className:"h-6 w-16" }} />
            <Skeleton appearance={{ className:"h-4 w-12" }} />
          </div>
          <Skeleton appearance={{ className:"h-3 w-24" }} />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Skeleton appearance={{ className:"h-4 w-4" }} />
          <Skeleton appearance={{ className:"h-4 w-10" }} />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton appearance={{ className:"h-4 w-4" }} />
          <Skeleton appearance={{ className:"h-4 w-8" }} />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton appearance={{ className:"h-4 w-4" }} />
          <Skeleton appearance={{ className:"h-4 w-12" }} />
        </div>
      </div>
    </div>
  )
}

export function SkeletonProductCard() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Skeleton appearance={{ className:"h-32 w-full rounded-none" }} />
      <div className="p-3 space-y-2">
        <Skeleton appearance={{ className:"h-4 w-3/4" }} />
        <Skeleton appearance={{ className:"h-3 w-1/2" }} />
        <div className="flex items-center justify-between">
          <Skeleton appearance={{ className:"h-4 w-16" }} />
          <Skeleton appearance={{ className:"h-3 w-10" }} />
        </div>
      </div>
    </div>
  )
}

export interface SkeletonProductGridProps {
  appearance?: {
    columns?: 3 | 4
  }
}

export function SkeletonProductGrid({ appearance }: SkeletonProductGridProps) {
  const { columns = 4 } = appearance ?? {}
  return (
    <div
      className={cn(
        'w-full grid gap-3',
        columns === 4 ? 'grid-cols-4' : 'grid-cols-3'
      )}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonProductCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonProductCarousel() {
  return (
    <div className="w-full flex gap-3 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-40">
          <SkeletonProductCard />
        </div>
      ))}
    </div>
  )
}

export function SkeletonPricingPlan() {
  return (
    <div className="w-full rounded-xl border p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Skeleton appearance={{ className:"h-4 w-4 rounded-full mt-1" }} />
          <div className="space-y-2">
            <Skeleton appearance={{ className:"h-5 w-24" }} />
            <Skeleton appearance={{ className:"h-4 w-48" }} />
          </div>
        </div>
        <Skeleton appearance={{ className:"h-6 w-16" }} />
      </div>
      <div className="flex gap-4 pl-7">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} appearance={{ className:"h-3 w-16" }} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonPricingPlans() {
  return (
    <div className="w-full rounded-lg border bg-card">
      <div className="flex items-center justify-between p-6 pb-4">
        <Skeleton appearance={{ className:"h-6 w-32" }} />
        <Skeleton appearance={{ className:"h-9 w-40 rounded-lg" }} />
      </div>
      <div className="p-6 pt-0 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonPricingPlan key={i} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonInlineForm() {
  return (
    <div className="w-full flex items-center gap-2 rounded-lg  bg-card px-2 py-2">
      <Skeleton appearance={{ className:"h-4 w-4 shrink-0" }} />
      <Skeleton appearance={{ className:"h-8 flex-1" }} />
      <Skeleton appearance={{ className:"h-4 w-px shrink-0" }} />
      <Skeleton appearance={{ className:"h-8 w-14" }} />
      <Skeleton appearance={{ className:"h-4 w-px shrink-0" }} />
      <Skeleton appearance={{ className:"h-8 w-10" }} />
      <Skeleton appearance={{ className:"h-8 w-24 rounded-md" }} />
    </div>
  )
}

export function SkeletonOptionList() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} appearance={{ className:"h-8 w-20 rounded-full" }} />
      ))}
    </div>
  )
}

export function SkeletonTagSelect() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} appearance={{ className:"h-7 w-16 rounded-md" }} />
      ))}
    </div>
  )
}

export function SkeletonQuickReply() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} appearance={{ className:"h-9 w-24 rounded-lg" }} />
      ))}
    </div>
  )
}

export function SkeletonProgressSteps() {
  return (
    <div className="w-full flex items-center justify-between">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton appearance={{ className:"h-8 w-8 rounded-full" }} />
          <Skeleton appearance={{ className:"h-4 w-16" }} />
          {i < 3 && <Skeleton appearance={{ className:"h-0.5 w-12 mx-2" }} />}
        </div>
      ))}
    </div>
  )
}

export function SkeletonStatusBadge() {
  return <Skeleton appearance={{ className:"h-6 w-20 rounded-full" }} />
}

export function SkeletonStatCard() {
  return (
    <div className="flex-shrink-0 w-36 rounded-lg border bg-card p-3 space-y-2">
      <Skeleton appearance={{ className:"h-3 w-16" }} />
      <Skeleton appearance={{ className:"h-6 w-20" }} />
      <Skeleton appearance={{ className:"h-3 w-12" }} />
    </div>
  )
}

export function SkeletonStats() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonPaymentMethods() {
  return (
    <div className="flex gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} appearance={{ className:"h-12 w-16 rounded-lg" }} />
      ))}
    </div>
  )
}

export function SkeletonOrderConfirm() {
  return (
    <div className="w-full rounded-lg border bg-card p-4">
      <div className="flex gap-4">
        <Skeleton appearance={{ className:"h-20 w-20 rounded-lg" }} />
        <div className="flex-1 space-y-2">
          <Skeleton appearance={{ className:"h-5 w-3/4" }} />
          <Skeleton appearance={{ className:"h-4 w-1/2" }} />
          <Skeleton appearance={{ className:"h-4 w-24" }} />
        </div>
        <Skeleton appearance={{ className:"h-9 w-24 rounded-md" }} />
      </div>
    </div>
  )
}

export function SkeletonAmountInput() {
  return (
    <div className="w-full flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <div className="space-y-1">
        <Skeleton appearance={{ className:"h-4 w-24" }} />
        <Skeleton appearance={{ className:"h-3 w-32" }} />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton appearance={{ className:"h-8 w-8 rounded-md" }} />
        <Skeleton appearance={{ className:"h-8 w-20" }} />
        <Skeleton appearance={{ className:"h-8 w-8 rounded-md" }} />
      </div>
    </div>
  )
}

export function SkeletonPaymentSuccess() {
  return (
    <div className="w-full rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <Skeleton appearance={{ className:"h-10 w-10 rounded-full" }} />
        <div className="flex-1 space-y-2">
          <Skeleton appearance={{ className:"h-5 w-40" }} />
          <Skeleton appearance={{ className:"h-4 w-32" }} />
        </div>
        <Skeleton appearance={{ className:"h-9 w-28 rounded-md" }} />
      </div>
    </div>
  )
}

export function SkeletonPaymentSuccessCompact() {
  return (
    <div className="w-full flex items-center gap-3 rounded-lg  bg-card px-3 py-2">
      <Skeleton appearance={{ className:"h-10 w-10 rounded-full" }} />
      <Skeleton appearance={{ className:"h-10 w-10 rounded-md" }} />
      <div className="flex-1 space-y-1.5">
        <Skeleton appearance={{ className:"h-4 w-32" }} />
        <Skeleton appearance={{ className:"h-3 w-24" }} />
      </div>
      <Skeleton appearance={{ className:"h-5 w-16" }} />
      <Skeleton appearance={{ className:"h-8 w-16 rounded-md" }} />
    </div>
  )
}

// Form Skeletons
export function SkeletonContactForm() {
  return (
    <div className="w-full bg-card rounded-xl p-6 space-y-4">
      <div className="space-y-1">
        <Skeleton appearance={{ className: "h-6 w-32" }} />
        <Skeleton appearance={{ className: "h-4 w-64" }} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton appearance={{ className: "h-4 w-20" }} />
          <Skeleton appearance={{ className: "h-9 w-full rounded-lg" }} />
        </div>
        <div className="space-y-2">
          <Skeleton appearance={{ className: "h-4 w-20" }} />
          <Skeleton appearance={{ className: "h-9 w-full rounded-lg" }} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton appearance={{ className: "h-4 w-24" }} />
          <div className="flex gap-2">
            <Skeleton appearance={{ className: "h-9 w-24 rounded-lg" }} />
            <Skeleton appearance={{ className: "h-9 flex-1 rounded-lg" }} />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton appearance={{ className: "h-4 w-16" }} />
          <Skeleton appearance={{ className: "h-9 w-full rounded-lg" }} />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton appearance={{ className: "h-4 w-40" }} />
        <Skeleton appearance={{ className: "h-24 w-full rounded-lg" }} />
      </div>
      <div className="flex justify-between">
        <Skeleton appearance={{ className: "h-9 w-28 rounded-lg" }} />
        <Skeleton appearance={{ className: "h-9 w-32 rounded-lg" }} />
      </div>
    </div>
  )
}

export function SkeletonDateTimePicker() {
  return (
    <div className="w-full bg-card rounded-xl p-6 space-y-6">
      <Skeleton appearance={{ className: "h-6 w-48" }} />
      <div className="flex justify-center gap-8">
        <div className="w-[304px] space-y-4">
          <div className="flex items-center justify-center gap-4">
            <Skeleton appearance={{ className: "h-5 w-5 rounded" }} />
            <Skeleton appearance={{ className: "h-5 w-32" }} />
            <Skeleton appearance={{ className: "h-5 w-5 rounded" }} />
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={`day-${i}`} appearance={{ className: "h-4 w-8 mx-auto" }} />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={`cell-${i}`} appearance={{ className: "h-10 w-10 rounded-full mx-auto" }} />
            ))}
          </div>
          <div className="space-y-2 mt-4">
            <Skeleton appearance={{ className: "h-4 w-20" }} />
            <Skeleton appearance={{ className: "h-4 w-48" }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function SkeletonIssueReportForm() {
  return (
    <div className="w-full bg-card rounded-xl p-4 space-y-3">
      <Skeleton appearance={{ className: "h-6 w-32" }} />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Skeleton appearance={{ className: "h-3 w-12" }} />
          <Skeleton appearance={{ className: "h-9 w-full rounded-lg" }} />
        </div>
        <div className="space-y-1">
          <Skeleton appearance={{ className: "h-3 w-12" }} />
          <Skeleton appearance={{ className: "h-9 w-full rounded-lg" }} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton appearance={{ className: "h-3 w-16" }} />
            <Skeleton appearance={{ className: "h-9 w-full rounded-lg" }} />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Skeleton appearance={{ className: "h-3 w-20" }} />
        <Skeleton appearance={{ className: "h-9 w-full rounded-lg" }} />
      </div>
      <div className="space-y-1">
        <Skeleton appearance={{ className: "h-3 w-24" }} />
        <Skeleton appearance={{ className: "h-20 w-full rounded-lg" }} />
      </div>
      <Skeleton appearance={{ className: "h-10 w-full rounded-lg" }} />
      <div className="flex justify-between pt-2">
        <Skeleton appearance={{ className: "h-9 w-28 rounded-lg" }} />
        <Skeleton appearance={{ className: "h-9 w-24 rounded-lg" }} />
      </div>
    </div>
  )
}

// Blogging Skeletons
export function SkeletonPostCard() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-card">
      <Skeleton appearance={{ className: "aspect-video w-full rounded-none" }} />
      <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
        <div className="space-y-2">
          <Skeleton appearance={{ className: "h-3 w-16" }} />
          <Skeleton appearance={{ className: "h-5 w-full" }} />
          <Skeleton appearance={{ className: "h-4 w-3/4" }} />
          <div className="flex gap-1">
            <Skeleton appearance={{ className: "h-5 w-16 rounded-full" }} />
            <Skeleton appearance={{ className: "h-5 w-20 rounded-full" }} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton appearance={{ className: "h-6 w-6 rounded-full" }} />
            <div className="space-y-1">
              <Skeleton appearance={{ className: "h-3 w-20" }} />
              <Skeleton appearance={{ className: "h-3 w-16" }} />
            </div>
          </div>
          <Skeleton appearance={{ className: "h-8 w-16 rounded-lg" }} />
        </div>
      </div>
    </div>
  )
}

export function SkeletonPostCardHorizontal() {
  return (
    <div className="flex flex-col sm:flex-row gap-4 rounded-lg border bg-card p-3">
      <Skeleton appearance={{ className: "aspect-video sm:aspect-square sm:h-24 sm:w-24 rounded-md" }} />
      <div className="flex flex-1 flex-col justify-between space-y-2">
        <div className="space-y-1">
          <Skeleton appearance={{ className: "h-3 w-16" }} />
          <Skeleton appearance={{ className: "h-4 w-full" }} />
          <Skeleton appearance={{ className: "h-3 w-3/4" }} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton appearance={{ className: "h-4 w-4 rounded-full" }} />
            <Skeleton appearance={{ className: "h-3 w-24" }} />
          </div>
          <Skeleton appearance={{ className: "h-8 w-14 rounded-lg" }} />
        </div>
      </div>
    </div>
  )
}

export function SkeletonPostList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonPostCardHorizontal key={i} />
      ))}
    </div>
  )
}

// Table Skeleton
export function SkeletonTable() {
  return (
    <div className="w-full rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b">
        <Skeleton appearance={{ className: "h-5 w-32" }} />
        <Skeleton appearance={{ className: "h-8 w-8 rounded" }} />
      </div>
      <div className="divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3">
            <Skeleton appearance={{ className: "h-4 w-4" }} />
            <Skeleton appearance={{ className: "h-4 flex-1" }} />
            <Skeleton appearance={{ className: "h-4 w-24" }} />
            <Skeleton appearance={{ className: "h-4 w-20" }} />
            <Skeleton appearance={{ className: "h-4 w-16" }} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between p-3 border-t">
        <Skeleton appearance={{ className: "h-4 w-24" }} />
        <div className="flex gap-1">
          <Skeleton appearance={{ className: "h-8 w-8 rounded" }} />
          <Skeleton appearance={{ className: "h-8 w-8 rounded" }} />
        </div>
      </div>
    </div>
  )
}

// Messaging Skeletons
export function SkeletonMessageBubble() {
  return (
    <div className="flex items-end gap-2">
      <Skeleton appearance={{ className: "h-8 w-8 rounded-full shrink-0" }} />
      <div className="space-y-1">
        <Skeleton appearance={{ className: "h-16 w-48 rounded-2xl rounded-bl-md" }} />
        <Skeleton appearance={{ className: "h-3 w-16" }} />
      </div>
    </div>
  )
}

export function SkeletonMessageBubbleOwn() {
  return (
    <div className="flex items-end gap-2 justify-end">
      <div className="space-y-1 items-end flex flex-col">
        <Skeleton appearance={{ className: "h-12 w-40 rounded-2xl rounded-br-md" }} />
        <Skeleton appearance={{ className: "h-3 w-12" }} />
      </div>
    </div>
  )
}

export function SkeletonChatConversation() {
  return (
    <div className="w-full bg-card rounded-lg border p-4 space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b">
        <Skeleton appearance={{ className: "h-10 w-10 rounded-full" }} />
        <div className="space-y-1">
          <Skeleton appearance={{ className: "h-4 w-24" }} />
          <Skeleton appearance={{ className: "h-3 w-16" }} />
        </div>
      </div>
      <div className="space-y-4">
        <SkeletonMessageBubble />
        <SkeletonMessageBubbleOwn />
        <SkeletonMessageBubble />
      </div>
      <div className="flex items-center gap-2 pt-3 border-t">
        <Skeleton appearance={{ className: "h-10 flex-1 rounded-full" }} />
        <Skeleton appearance={{ className: "h-10 w-10 rounded-full" }} />
      </div>
    </div>
  )
}

// Map Skeleton
export function SkeletonMapCarousel() {
  return (
    <div className="w-full rounded-lg border bg-card overflow-hidden">
      <Skeleton appearance={{ className: "h-64 w-full rounded-none" }} />
      <div className="p-3">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-64 rounded-lg border p-3 space-y-2">
              <Skeleton appearance={{ className: "h-24 w-full rounded-lg" }} />
              <Skeleton appearance={{ className: "h-4 w-3/4" }} />
              <Skeleton appearance={{ className: "h-3 w-1/2" }} />
              <div className="flex justify-between">
                <Skeleton appearance={{ className: "h-4 w-16" }} />
                <Skeleton appearance={{ className: "h-4 w-12" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Social Post Skeletons
export function SkeletonXPost() {
  return (
    <div className="w-full max-w-lg rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton appearance={{ className: "h-10 w-10 rounded-full" }} />
        <div className="flex-1 space-y-1">
          <Skeleton appearance={{ className: "h-4 w-24" }} />
          <Skeleton appearance={{ className: "h-3 w-20" }} />
        </div>
        <Skeleton appearance={{ className: "h-5 w-5" }} />
      </div>
      <div className="space-y-2">
        <Skeleton appearance={{ className: "h-4 w-full" }} />
        <Skeleton appearance={{ className: "h-4 w-3/4" }} />
      </div>
      <Skeleton appearance={{ className: "h-48 w-full rounded-xl" }} />
      <div className="flex items-center justify-between pt-2">
        <Skeleton appearance={{ className: "h-4 w-12" }} />
        <Skeleton appearance={{ className: "h-4 w-12" }} />
        <Skeleton appearance={{ className: "h-4 w-12" }} />
        <Skeleton appearance={{ className: "h-4 w-12" }} />
      </div>
    </div>
  )
}

export function SkeletonInstagramPost() {
  return (
    <div className="w-full max-w-lg rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <Skeleton appearance={{ className: "h-8 w-8 rounded-full" }} />
        <Skeleton appearance={{ className: "h-4 w-24" }} />
      </div>
      <Skeleton appearance={{ className: "aspect-square w-full rounded-none" }} />
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-4">
          <Skeleton appearance={{ className: "h-6 w-6" }} />
          <Skeleton appearance={{ className: "h-6 w-6" }} />
          <Skeleton appearance={{ className: "h-6 w-6" }} />
        </div>
        <Skeleton appearance={{ className: "h-4 w-20" }} />
        <Skeleton appearance={{ className: "h-4 w-full" }} />
        <Skeleton appearance={{ className: "h-3 w-24" }} />
      </div>
    </div>
  )
}

export function SkeletonLinkedInPost() {
  return (
    <div className="w-full max-w-lg rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton appearance={{ className: "h-12 w-12 rounded-full" }} />
        <div className="flex-1 space-y-1">
          <Skeleton appearance={{ className: "h-4 w-32" }} />
          <Skeleton appearance={{ className: "h-3 w-48" }} />
          <Skeleton appearance={{ className: "h-3 w-24" }} />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton appearance={{ className: "h-4 w-full" }} />
        <Skeleton appearance={{ className: "h-4 w-full" }} />
        <Skeleton appearance={{ className: "h-4 w-2/3" }} />
      </div>
      <Skeleton appearance={{ className: "h-48 w-full rounded-lg" }} />
      <div className="flex items-center justify-between pt-2 border-t">
        <Skeleton appearance={{ className: "h-8 w-16" }} />
        <Skeleton appearance={{ className: "h-8 w-20" }} />
        <Skeleton appearance={{ className: "h-8 w-16" }} />
        <Skeleton appearance={{ className: "h-8 w-14" }} />
      </div>
    </div>
  )
}

export function SkeletonYouTubePost() {
  return (
    <div className="w-full max-w-lg rounded-xl border bg-card overflow-hidden">
      <Skeleton appearance={{ className: "aspect-video w-full rounded-none" }} />
      <div className="p-3 space-y-2">
        <div className="flex gap-3">
          <Skeleton appearance={{ className: "h-9 w-9 rounded-full shrink-0" }} />
          <div className="flex-1 space-y-1">
            <Skeleton appearance={{ className: "h-4 w-full" }} />
            <Skeleton appearance={{ className: "h-3 w-32" }} />
            <Skeleton appearance={{ className: "h-3 w-24" }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Additional Payment Skeletons
export function SkeletonBankCardForm() {
  return (
    <div className="w-full bg-card rounded-xl p-4 space-y-4">
      <Skeleton appearance={{ className: "h-5 w-40" }} />
      <div className="space-y-2">
        <Skeleton appearance={{ className: "h-4 w-24" }} />
        <Skeleton appearance={{ className: "h-10 w-full rounded-lg" }} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton appearance={{ className: "h-4 w-20" }} />
          <Skeleton appearance={{ className: "h-10 w-full rounded-lg" }} />
        </div>
        <div className="space-y-2">
          <Skeleton appearance={{ className: "h-4 w-12" }} />
          <Skeleton appearance={{ className: "h-10 w-full rounded-lg" }} />
        </div>
      </div>
      <Skeleton appearance={{ className: "h-10 w-full rounded-lg" }} />
    </div>
  )
}

export function SkeletonPaymentConfirmed() {
  return (
    <div className="w-full bg-card rounded-xl p-6 space-y-4">
      <div className="flex flex-col items-center text-center space-y-2">
        <Skeleton appearance={{ className: "h-16 w-16 rounded-full" }} />
        <Skeleton appearance={{ className: "h-6 w-40" }} />
        <Skeleton appearance={{ className: "h-4 w-56" }} />
      </div>
      <div className="space-y-3 pt-4 border-t">
        <div className="flex justify-between">
          <Skeleton appearance={{ className: "h-4 w-20" }} />
          <Skeleton appearance={{ className: "h-4 w-24" }} />
        </div>
        <div className="flex justify-between">
          <Skeleton appearance={{ className: "h-4 w-16" }} />
          <Skeleton appearance={{ className: "h-4 w-20" }} />
        </div>
        <div className="flex justify-between">
          <Skeleton appearance={{ className: "h-4 w-24" }} />
          <Skeleton appearance={{ className: "h-4 w-32" }} />
        </div>
      </div>
      <Skeleton appearance={{ className: "h-10 w-full rounded-lg" }} />
    </div>
  )
}
