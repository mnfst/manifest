import type { ComponentType } from 'react';

/**
 * Available tabs in the flow detail page
 */
export type FlowDetailTab = 'build' | 'preview' | 'usage';

/**
 * Available tabs in the settings page
 */
export type SettingsTab = 'general' | 'api-keys' | 'account';

/**
 * Tab configuration for rendering
 */
export interface TabConfig {
  id: FlowDetailTab | SettingsTab;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Whether the tab is disabled (e.g., Preview when no views) */
  disabled?: boolean;
}

/**
 * Settings-specific tab config with narrower type
 */
export interface SettingsTabConfig {
  id: SettingsTab;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
}
