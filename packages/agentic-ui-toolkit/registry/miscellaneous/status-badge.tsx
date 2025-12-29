"use client"

import {
  Check,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  Package,
  Truck,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type StatusType =
  | "success"
  | "pending"
  | "processing"
  | "warning"
  | "error"
  | "shipped"
  | "delivered"
  | "cancelled"

export interface StatusBadgeProps {
  data?: {
    status?: StatusType
  }
  appearance?: {
    label?: string
    showIcon?: boolean
    size?: "sm" | "md" | "lg"
  }
}

const statusConfig: Record<
  StatusType,
  { icon: React.ElementType; className: string; defaultLabel: string }
> = {
  success: {
    icon: Check,
    className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
    defaultLabel: "Success",
  },
  pending: {
    icon: Clock,
    className: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
    defaultLabel: "Pending",
  },
  processing: {
    icon: Loader2,
    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    defaultLabel: "Processing",
  },
  warning: {
    icon: AlertCircle,
    className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
    defaultLabel: "Warning",
  },
  error: {
    icon: XCircle,
    className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    defaultLabel: "Error",
  },
  shipped: {
    icon: Truck,
    className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
    defaultLabel: "Shipped",
  },
  delivered: {
    icon: CheckCircle2,
    className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
    defaultLabel: "Delivered",
  },
  cancelled: {
    icon: XCircle,
    className: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700",
    defaultLabel: "Cancelled",
  },
}

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs gap-1",
  md: "px-2.5 py-1 text-sm gap-1.5",
  lg: "px-3 py-1.5 text-sm gap-2",
}

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
}

export function StatusBadge({ data, appearance }: StatusBadgeProps) {
  const { status = "pending" } = data ?? {}
  const { label, showIcon = true, size = "md" } = appearance ?? {}
  const config = statusConfig[status]
  const Icon = config.icon
  const displayLabel = label || config.defaultLabel

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.className,
        sizeClasses[size]
      )}
    >
      {showIcon && (
        <Icon
          className={cn(
            iconSizes[size],
            status === "processing" && "animate-spin"
          )}
        />
      )}
      {displayLabel}
    </span>
  )
}
