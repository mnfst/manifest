import type { LayoutTemplate } from '@manifest/shared';
import { Stats } from '../ui/stats';

interface LayoutRendererProps {
  layoutTemplate: LayoutTemplate;
  isDarkMode?: boolean;
}

/**
 * Renders an empty/placeholder layout component based on template
 * Currently supports stat-card layout for displaying metrics
 */
export function LayoutRenderer({ layoutTemplate, isDarkMode = false }: LayoutRendererProps) {
  // Stat card layout using Stats component with sample data
  if (layoutTemplate === 'stat-card') {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <Stats
          data={{
            stats: [
              { label: 'Metric 1', value: '--', trend: 'neutral' },
              { label: 'Metric 2', value: '--', trend: 'neutral' },
              { label: 'Metric 3', value: '--', trend: 'neutral' },
            ],
          }}
        />
      </div>
    );
  }

  // Fallback for unsupported layouts
  return (
    <div className={`p-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-muted-foreground'}`}>
      Unsupported layout template: {layoutTemplate}
    </div>
  );
}
