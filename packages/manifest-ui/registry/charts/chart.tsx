'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig as ShadcnChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import type { ChartDefinition } from './types'
import { demoCharts } from './demo/charts'
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ChartProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the Chart component.
 * A read-only data visualization component that renders one or more chart
 * cards. Each chart definition produces a full-width card with a title,
 * optional description, optional big number, and the chart visualization.
 */
export interface ChartProps {
  data?: {
    /** Array of chart definitions. Each entry renders a separate card. */
    charts?: ChartDefinition[]
  }
  appearance?: {
    /**
     * Display mode for the component.
     * @default "inline"
     */
    displayMode?: 'inline' | 'pip' | 'fullscreen'
  }
  control?: {
    /**
     * Whether the component is in loading state.
     * @default false
     */
    loading?: boolean
  }
}

function toShadcnConfig(config?: ChartDefinition['config']): ShadcnChartConfig {
  if (!config) return {}
  const result: ShadcnChartConfig = {}
  for (const [key, entry] of Object.entries(config)) {
    result[key] = { label: entry.label ?? key, color: entry.color ?? '' }
  }
  return result
}

function ChartCardHeader({ chart }: { chart: ChartDefinition }) {
  return (
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        {chart.title && (
          <h3 className="text-sm font-medium leading-none tracking-tight">
            {chart.title}
          </h3>
        )}
        {chart.bigNumber && (
          <span className="text-2xl font-bold tabular-nums">
            {chart.bigNumber}
          </span>
        )}
      </div>
      {chart.description && (
        <p className="text-xs text-muted-foreground">{chart.description}</p>
      )}
    </CardHeader>
  )
}

interface ChartDimensions {
  width?: number
  height?: number
}

function CartesianChartContent({ chart, width, height }: { chart: ChartDefinition } & ChartDimensions) {
  const configKeys = Object.keys(chart.config ?? {})
  const showGrid = chart.showGrid !== false
  const showXAxis = chart.showXAxis !== false
  const showYAxis = chart.showYAxis !== false
  const type = chart.type ?? 'line'

  const sharedProps = {
    data: chart.data,
    accessibilityLayer: true,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  }

  const renderSeries = () =>
    configKeys.map((key) => {
      const stackId = chart.stacked ? 'stack' : undefined
      const color = `var(--color-${key})`

      if (type === 'area') {
        return (
          <Area
            key={key}
            dataKey={key}
            type="natural"
            fill={color}
            fillOpacity={0.4}
            stroke={color}
            stackId={stackId}
          />
        )
      }
      if (type === 'bar') {
        return (
          <Bar
            key={key}
            dataKey={key}
            fill={color}
            radius={[4, 4, 0, 0]}
            stackId={stackId}
          />
        )
      }
      return (
        <Line
          key={key}
          dataKey={key}
          type="natural"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      )
    })

  const ChartComponent =
    type === 'area' ? AreaChart : type === 'bar' ? BarChart : LineChart

  return (
    <ChartComponent {...sharedProps}>
      {showGrid && <CartesianGrid vertical={false} />}
      {showXAxis && (
        <XAxis
          dataKey={chart.dataKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
      )}
      {showYAxis && (
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
      )}
      {chart.showTooltip !== false && (
        <ChartTooltip content={<ChartTooltipContent />} />
      )}
      {chart.showLegend && (
        <ChartLegend content={<ChartLegendContent />} />
      )}
      {renderSeries()}
    </ChartComponent>
  )
}

function PieChartContent({ chart, width, height }: { chart: ChartDefinition } & ChartDimensions) {
  const nameKey = chart.dataKey ?? 'name'

  // Find the numeric value field (not the category/name field)
  const firstPoint = chart.data?.[0]
  const valueKey = firstPoint
    ? Object.keys(firstPoint).find(
        (k) => k !== nameKey && typeof firstPoint[k] === 'number'
      ) ?? 'value'
    : 'value'

  // Add fill colors so each slice gets its config color
  const dataWithFills = (chart.data ?? []).map((point) => {
    if (point.fill) return point
    const name = String(point[nameKey] ?? '').toLowerCase()
    return { ...point, fill: `var(--color-${name})` }
  })

  const innerRadius = height && height < 200 ? Math.max(10, height * 0.15) : 60

  return (
    <PieChart accessibilityLayer width={width} height={height}>
      <Pie
        data={dataWithFills}
        dataKey={valueKey}
        nameKey={nameKey}
        innerRadius={innerRadius}
        strokeWidth={5}
      />
      {chart.showTooltip !== false && (
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
      )}
      {chart.showLegend && (
        <ChartLegend content={<ChartLegendContent nameKey={nameKey} />} />
      )}
    </PieChart>
  )
}

function RadarChartContent({ chart, width, height }: { chart: ChartDefinition } & ChartDimensions) {
  const configKeys = Object.keys(chart.config ?? {})

  return (
    <RadarChart data={chart.data} accessibilityLayer width={width} height={height}>
      <PolarGrid />
      <PolarAngleAxis dataKey={chart.dataKey} />
      {configKeys.map((key) => (
        <Radar
          key={key}
          dataKey={key}
          fill={`var(--color-${key})`}
          fillOpacity={0.6}
          dot={{ r: 4, fillOpacity: 1 }}
        />
      ))}
      {chart.showTooltip !== false && (
        <ChartTooltip content={<ChartTooltipContent />} />
      )}
      {chart.showLegend && (
        <ChartLegend content={<ChartLegendContent />} />
      )}
    </RadarChart>
  )
}

function RadialChartContent({ chart, width, height }: { chart: ChartDefinition } & ChartDimensions) {
  return (
    <RadialBarChart
      data={chart.data}
      innerRadius={30}
      outerRadius={110}
      accessibilityLayer
      width={width}
      height={height}
    >
      <RadialBar dataKey="value" background />
      {chart.showTooltip !== false && (
        <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
      )}
      {chart.showLegend && (
        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
      )}
    </RadialBarChart>
  )
}

function ChartVisualization({ chart, width, height }: { chart: ChartDefinition } & ChartDimensions) {
  const type = chart.type ?? 'line'

  if (type === 'pie') return <PieChartContent chart={chart} width={width} height={height} />
  if (type === 'radar') return <RadarChartContent chart={chart} width={width} height={height} />
  if (type === 'radial') return <RadialChartContent chart={chart} width={width} height={height} />
  return <CartesianChartContent chart={chart} width={width} height={height} />
}

/** Chart renders one or more chart cards from an array of chart definitions. */
export function Chart({ data, appearance, control }: ChartProps) {
  const resolved = data ?? { charts: demoCharts }
  const charts = resolved.charts
  const displayMode = appearance?.displayMode ?? 'inline'

  if (control?.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!charts?.length) return null

  const isMulti = charts.length > 1
  const chartHeight =
    displayMode === 'fullscreen'
      ? 'h-[350px]'
      : isMulti
        ? 'h-[120px]'
        : 'h-[250px]'

  return (
    <div className="flex w-full flex-col gap-4">
      {charts.map((chart, index) => {
        const config = toShadcnConfig(chart.config)
        const hasData = chart.data && chart.data.length > 0

        return (
          <Card key={`${chart.title ?? ''}-${index}`}>
            <ChartCardHeader chart={chart} />
            <CardContent className="px-2 pb-4 pt-0 sm:px-6">
              {hasData ? (
                <ChartContainer config={config} className={`w-full ${chartHeight} aspect-auto`}>
                  <ChartVisualization chart={chart} />
                </ChartContainer>
              ) : (
                <div className={`flex items-center justify-center ${chartHeight} aspect-auto text-muted-foreground text-sm`}>
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export type { ChartDefinition, ChartConfig } from './types'
