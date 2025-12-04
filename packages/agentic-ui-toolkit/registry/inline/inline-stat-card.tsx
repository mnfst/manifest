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
      <div className="flex gap-4 overflow-x-auto pb-1">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="flex-1 min-w-32 rounded-lg border bg-card p-3 space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              {stat.icon}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold">{stat.value}</span>
              {stat.change !== undefined && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-xs font-medium",
                    getTrendColor(stat.trend)
                  )}
                >
                  {getTrendIcon(stat.trend)}
                  {Math.abs(stat.change)}%
                </span>
              )}
            </div>
            {stat.changeLabel && (
              <span className="text-xs text-muted-foreground">
                {stat.changeLabel}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
