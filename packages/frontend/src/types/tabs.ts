import type { ComponentType } from 'react';

/**
 * Available tabs in the flow detail page
 */
export type FlowDetailTab = 'build' | 'preview' | 'usage';

/**
 * Tab configuration for rendering
 */
export interface TabConfig {
  id: FlowDetailTab;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Whether the tab is disabled (e.g., Preview when no views) */
  disabled?: boolean;
}
