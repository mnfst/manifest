/** Supported chart visualization types. */
export type ChartType = 'area' | 'bar' | 'line' | 'pie' | 'radar' | 'radial'

/** Display properties for a single data series. */
export interface ChartConfigEntry {
  /** Human-readable label for tooltips and legends. */
  label?: string
  /** CSS color value: CSS variable, hex, HSL, or oklch. */
  color?: string
}

/**
 * Maps data keys to their display configuration.
 * Each key corresponds to a numeric property in the data points.
 */
export type ChartConfig = Record<string, ChartConfigEntry>

/**
 * A single data record. One key represents the category axis (e.g., "month"),
 * other keys represent numeric data series values.
 */
export type DataPoint = Record<string, string | number>

/** Defines a single chart card with all its data and configuration. */
export interface ChartDefinition {
  /** Title displayed at the top-left of the card. */
  title?: string
  /** Optional description displayed below the title row. */
  description?: string
  /** Optional KPI metric displayed at the top-right, same row as title. */
  bigNumber?: string
  /** The chart visualization type. */
  type?: ChartType
  /** Data property for the category axis. Required for area, bar, line. */
  dataKey?: string
  /** Array of data points for the chart. */
  data?: DataPoint[]
  /** Maps data keys to labels and colors. */
  config?: ChartConfig
  /**
   * Show background grid lines.
   * @default true
   */
  showGrid?: boolean
  /**
   * Show X-axis (Cartesian types only).
   * @default true
   */
  showXAxis?: boolean
  /**
   * Show Y-axis (Cartesian types only).
   * @default true
   */
  showYAxis?: boolean
  /**
   * Show chart legend.
   * @default false
   */
  showLegend?: boolean
  /**
   * Show tooltip on hover.
   * @default true
   */
  showTooltip?: boolean
  /**
   * Stack data series (area and bar types only).
   * @default false
   */
  stacked?: boolean
}
