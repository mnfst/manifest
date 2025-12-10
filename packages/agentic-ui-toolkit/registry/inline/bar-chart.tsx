"use client"

import { cn } from "@/lib/utils"

export interface BarChartData {
  label: string
  value: number
  color?: string
}

export interface InlineBarChartProps {
  data?: BarChartData[]
  title?: string
  showValues?: boolean
  showLabels?: boolean
  maxValue?: number
  height?: number
  variant?: "horizontal" | "vertical"
}

const defaultData: BarChartData[] = [
  { label: "Jan", value: 65 },
  { label: "Feb", value: 85 },
  { label: "Mar", value: 45 },
  { label: "Apr", value: 90 },
  { label: "May", value: 70 },
  { label: "Jun", value: 55 },
]

const defaultColors = [
  "bg-primary",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-pink-500",
]

export function InlineBarChart({
  data = defaultData,
  title,
  showValues = true,
  showLabels = true,
  maxValue,
  height = 120,
  variant = "vertical",
}: InlineBarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value))

  if (variant === "horizontal") {
    return (
      <div className="w-full space-y-2">
        {title && (
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
        )}
        <div className="space-y-2">
          {data.map((item, index) => {
            const percentage = (item.value / max) * 100
            const color = item.color || defaultColors[index % defaultColors.length]

            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  {showLabels && <span>{item.label}</span>}
                  {showValues && (
                    <span className="font-medium">{item.value}</span>
                  )}
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", color)}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-2">
      {title && (
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
      )}
      <div
        className="flex items-end gap-2"
        style={{ height: `${height}px` }}
      >
        {data.map((item, index) => {
          const percentage = (item.value / max) * 100
          const color = item.color || defaultColors[index % defaultColors.length]

          return (
            <div
              key={item.label}
              className="flex-1 flex flex-col items-center gap-1"
            >
              {showValues && (
                <span className="text-xs font-medium">{item.value}</span>
              )}
              <div
                className={cn("w-full rounded-t transition-all", color)}
                style={{ height: `${percentage}%` }}
              />
              {showLabels && (
                <span className="text-xs text-muted-foreground">
                  {item.label}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
