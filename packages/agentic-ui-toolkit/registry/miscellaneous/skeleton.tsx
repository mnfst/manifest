'use client'

import { cn } from '@/lib/utils'

/*
 * Skeleton Components - ChatGPT UI Guidelines Compliant
 * - Uses system muted color for loading states
 * - Pulse animation for visual feedback
 * - Accessible: aria-hidden for decorative loading states
 */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      aria-hidden="true"
    />
  )
}

export function SkeletonWeather() {
  return (
    <div className="w-full flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-10" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonProductCard() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonProductGrid({ columns = 4 }: { columns?: 3 | 4 }) {
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
          <Skeleton className="h-4 w-4 rounded-full mt-1" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-6 w-16" />
      </div>
      <div className="flex gap-4 pl-7">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
    </div>
  )
}

export function SkeletonPricingPlans() {
  return (
    <div className="w-full rounded-lg border bg-card">
      <div className="flex items-center justify-between p-6 pb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-40 rounded-lg" />
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
      <Skeleton className="h-4 w-4 shrink-0" />
      <Skeleton className="h-8 flex-1" />
      <Skeleton className="h-4 w-px shrink-0" />
      <Skeleton className="h-8 w-14" />
      <Skeleton className="h-4 w-px shrink-0" />
      <Skeleton className="h-8 w-10" />
      <Skeleton className="h-8 w-24 rounded-md" />
    </div>
  )
}

export function SkeletonOptionList() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-20 rounded-full" />
      ))}
    </div>
  )
}

export function SkeletonTagSelect() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-16 rounded-md" />
      ))}
    </div>
  )
}

export function SkeletonQuickReply() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-lg" />
      ))}
    </div>
  )
}

export function SkeletonProgressSteps() {
  return (
    <div className="w-full flex items-center justify-between">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-16" />
          {i < 3 && <Skeleton className="h-0.5 w-12 mx-2" />}
        </div>
      ))}
    </div>
  )
}

export function SkeletonStatusBadge() {
  return <Skeleton className="h-6 w-20 rounded-full" />
}

export function SkeletonStatCard() {
  return (
    <div className="flex-shrink-0 w-36 rounded-lg border bg-card p-3 space-y-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-3 w-12" />
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
        <Skeleton key={i} className="h-12 w-16 rounded-lg" />
      ))}
    </div>
  )
}

export function SkeletonOrderConfirm() {
  return (
    <div className="w-full rounded-lg border bg-card p-4">
      <div className="flex gap-4">
        <Skeleton className="h-20 w-20 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </div>
  )
}

export function SkeletonAmountInput() {
  return (
    <div className="w-full flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <div className="space-y-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  )
}

export function SkeletonPaymentSuccess() {
  return (
    <div className="w-full rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  )
}

export function SkeletonPaymentSuccessCompact() {
  return (
    <div className="w-full flex items-center gap-3 rounded-lg  bg-card px-3 py-2">
      <Skeleton className="h-10 w-10 rounded-full" />
      <Skeleton className="h-10 w-10 rounded-md" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-8 w-16 rounded-md" />
    </div>
  )
}
