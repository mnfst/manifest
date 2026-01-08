import type { LayoutTemplate } from './app.js';

/**
 * Template definition with default code and sample data for preview.
 */
export interface TemplateDefinition {
  /** Default TSX component code */
  defaultCode: string;
  /** Sample data for preview rendering */
  sampleData: unknown;
}

/**
 * Sample data for the stat-card template.
 * Matches the Stats component expected format.
 */
export const STAT_CARD_SAMPLE_DATA = {
  stats: [
    {
      label: 'Total Revenue',
      value: '$45,231.89',
      change: 20.1,
      changeLabel: 'from last month',
      trend: 'up' as const,
    },
    {
      label: 'Active Users',
      value: '2,350',
      change: 12.5,
      changeLabel: 'from last week',
      trend: 'up' as const,
    },
    {
      label: 'Bounce Rate',
      value: '32.8%',
      change: -5.2,
      changeLabel: 'from yesterday',
      trend: 'down' as const,
    },
  ],
};

/**
 * Default code for the stat-card layout template.
 * Full customizable component that users can modify.
 */
export const STAT_CARD_DEFAULT_CODE = `import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// Customize this component to change how your stats are displayed
export default function CustomStatCard({ data }) {
  const stats = data?.stats ?? []

  if (stats.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No statistics available
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
      {stats.map((stat, index) => {
        const trend = stat.trend ?? (stat.change > 0 ? 'up' : stat.change < 0 ? 'down' : 'neutral')
        const changeValue = stat.change != null
          ? \`\${stat.change > 0 ? '+' : ''}\${stat.change.toFixed(1)}%\`
          : ''

        return (
          <div
            key={index}
            className="p-4 rounded-lg border border-gray-200 bg-white"
          >
            {/* Label */}
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              {stat.label}
            </div>

            {/* Value */}
            <div className="text-2xl md:text-3xl font-semibold text-gray-900 mb-1">
              {String(stat.value)}
            </div>

            {/* Change indicator */}
            {changeValue && (
              <div className={\`flex items-center gap-1 text-xs font-medium \${
                trend === 'up' ? 'text-green-600' :
                trend === 'down' ? 'text-red-600' :
                'text-gray-500'
              }\`}>
                {trend === 'up' && <TrendingUp className="h-4 w-4" />}
                {trend === 'down' && <TrendingDown className="h-4 w-4" />}
                {trend === 'neutral' && <Minus className="h-4 w-4" />}
                <span>{changeValue}</span>
                {stat.changeLabel && (
                  <span className="text-gray-500 ml-1">{stat.changeLabel}</span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}`;

/**
 * Registry of template definitions with default code and sample data.
 */
export const TEMPLATE_DEFINITIONS: Record<LayoutTemplate, TemplateDefinition> = {
  'stat-card': {
    defaultCode: STAT_CARD_DEFAULT_CODE,
    sampleData: STAT_CARD_SAMPLE_DATA,
  },
};

// Legacy exports for backwards compatibility (kept for any code that might reference them)
export const TABLE_SAMPLE_DATA = STAT_CARD_SAMPLE_DATA;
export const POST_LIST_SAMPLE_DATA = STAT_CARD_SAMPLE_DATA;
export const TABLE_DEFAULT_CODE = STAT_CARD_DEFAULT_CODE;
export const POST_LIST_DEFAULT_CODE = STAT_CARD_DEFAULT_CODE;

/**
 * Get the default code for a layout template.
 */
export function getTemplateDefaultCode(template: LayoutTemplate): string {
  return TEMPLATE_DEFINITIONS[template]?.defaultCode ?? '';
}

/**
 * Get the sample data for a layout template.
 */
export function getTemplateSampleData(template: LayoutTemplate): unknown {
  return TEMPLATE_DEFINITIONS[template]?.sampleData ?? {};
}
