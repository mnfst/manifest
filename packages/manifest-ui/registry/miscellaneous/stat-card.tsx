"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { demoStats } from './demo/miscellaneous'

/**
 * Represents a single statistic card with trend data.
 * @interface StatCard
 * @property {string} [label] - Label for the stat (e.g., "Sales", "Orders")
 * @property {string | number} [value] - The stat value to display
 * @property {number} [change] - Percentage change value
 * @property {string} [changeLabel] - Additional context for the change
 * @property {React.ReactNode} [icon] - Optional icon for the stat
 * @property {"up" | "down" | "neutral"} [trend] - Trend direction
 */
export interface StatCard {
  label?: string
  value?: string | number
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  trend?: "up" | "down" | "neutral"
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * StatCardProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the StatCard component, which displays a grid of statistic cards
 * with values, trend indicators, and optional icons.
 */
export interface StatCardProps {
  data?: {
    /** Array of stat cards to display in the grid. */
    stats?: StatCard[]
  }
}


/**
 * A statistics card grid displaying key metrics with trend indicators.
 * Shows stats in a responsive 2-3 column grid layout.
 *
 * Features:
 * - Trend indicators (up, down, neutral) with colors
 * - Percentage change display
 * - Optional icons per stat
 * - Responsive grid layout
 * - Optional change labels
 *
 * @component
 * @example
 * ```tsx
 * <StatCard
 *   data={{
 *     stats: [
 *       { label: "Revenue", value: "$12,543", change: 12.5, trend: "up" },
 *       { label: "Orders", value: "342", change: -3.2, trend: "down" },
 *       { label: "Customers", value: "1,205", change: 0, trend: "neutral" }
 *     ]
 *   }}
 * />
 * ```
 */
export function StatCard({ data }: StatCardProps) {
  const resolved: NonNullable<StatCardProps['data']> = data ?? { stats: demoStats }
  const stats = resolved.stats ?? []
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
        {stats.map((stat, index) => {
          return (
            <div
              key={index}
              className="rounded-md sm:rounded-lg border bg-card p-2 sm:p-3 space-y-0.5 sm:space-y-1"
            >
              {(stat.label || stat.icon) && (
                <div className="flex items-center justify-between">
                  {stat.label && (
                    <span className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</span>
                  )}
                  {stat.icon}
                </div>
              )}
              {(stat.value !== undefined || stat.change !== undefined) && (
                <div className="flex flex-wrap items-baseline gap-1 sm:gap-2">
                  {stat.value !== undefined && (
                    <span className="text-base sm:text-xl font-bold">{stat.value}</span>
                  )}
                  {stat.change !== undefined && (
                    <span
                      className={cn(
                        "flex items-center gap-0.5 text-[10px] sm:text-xs font-medium shrink-0",
                        getTrendColor(stat.trend)
                      )}
                    >
                      {getTrendIcon(stat.trend)}
                      {Math.abs(stat.change)}%
                    </span>
                  )}
                </div>
              )}
              {stat.changeLabel && (
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {stat.changeLabel}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
