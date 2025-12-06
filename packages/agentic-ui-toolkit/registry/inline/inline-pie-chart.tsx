"use client"

import { cn } from "@/lib/utils"

export interface PieChartData {
  label: string
  value: number
  color?: string
}

export interface InlinePieChartProps {
  data?: PieChartData[]
  title?: string
  showLegend?: boolean
  showPercentages?: boolean
  size?: number
}

const defaultData: PieChartData[] = [
  { label: "Electronics", value: 45, color: "#3b82f6" },
  { label: "Fashion", value: 25, color: "#8b5cf6" },
  { label: "Home", value: 20, color: "#10b981" },
  { label: "Other", value: 10, color: "#f59e0b" },
]

export function InlinePieChart({
  data = defaultData,
  title,
  showLegend = true,
  showPercentages = true,
  size = 100,
}: InlinePieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  // Calculate segments
  let cumulativePercent = 0
  const segments = data.map((item) => {
    const percent = (item.value / total) * 100
    const startPercent = cumulativePercent
    cumulativePercent += percent
    return {
      ...item,
      percent,
      startPercent,
      endPercent: cumulativePercent,
    }
  })

  // Create conic gradient
  const gradientStops = segments
    .map((seg) => `${seg.color} ${seg.startPercent}% ${seg.endPercent}%`)
    .join(", ")

  return (
    <div className="w-full">
      {title && (
        <p className="text-sm font-medium text-muted-foreground mb-3">{title}</p>
      )}
      <div className="flex items-center gap-6">
        <div
          className="rounded-full flex-shrink-0"
          style={{
            width: size,
            height: size,
            background: `conic-gradient(${gradientStops})`,
          }}
        />
        {showLegend && (
          <div className="flex flex-col gap-2">
            {segments.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm">{item.label}</span>
                {showPercentages && (
                  <span className="text-sm text-muted-foreground">
                    {item.percent.toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
