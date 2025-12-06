"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export interface InlineStatCardProps {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  trend?: "up" | "down" | "neutral"
}

export interface InlineStatsProps {
  stats?: InlineStatCardProps[]
}

const defaultStats: InlineStatCardProps[] = [
  { label: "Sales", value: "$12,543", change: 12.5, trend: "up" },
  { label: "Orders", value: "342", change: -3.2, trend: "down" },
  { label: "Customers", value: "1,205", change: 0, trend: "neutral" },
]

export function InlineStats({ stats = defaultStats }: InlineStatsProps) {
  const getTrendIcon = (trend?: "up" | "down" | "neutral") => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-3.5 w-3.5" />
      case "down":
        return <TrendingDown className="h-3.5 w-3.5" />
      default:
        return <Minus className="h-3.5 w-3.5" />
    }
  }

  const getTrendColor = (trend?: "up" | "down" | "neutral") => {
    switch (trend) {
      case "up":
        return "text-green-600"
      case "down":
        return "text-red-600"
      default:
        return "text-muted-foreground"
    }
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="rounded-lg border bg-card p-2 sm:p-3 space-y-0.5 sm:space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</span>
              {stat.icon}
            </div>
            <div className="flex items-baseline gap-1 sm:gap-2">
              <span className="text-base sm:text-xl font-bold">{stat.value}</span>
              {stat.change !== undefined && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-[10px] sm:text-xs font-medium",
                    getTrendColor(stat.trend)
                  )}
                >
                  {getTrendIcon(stat.trend)}
                  {Math.abs(stat.change)}%
                </span>
              )}
            </div>
            {stat.changeLabel && (
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                {stat.changeLabel}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
