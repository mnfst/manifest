import type { ComponentType } from 'react';

/**
 * Available tabs in the flow detail page
 */
export type FlowDetailTab = 'build' | 'preview' | 'logs' | 'analytics';

/**
 * Available tabs in the user settings page
 */
export type SettingsTab = 'api-keys' | 'account';

/**
 * Available tabs in the app settings page
 */
export type AppSettingsTab = 'secrets';

/**
 * Tab configuration for rendering
 */
export interface TabConfig {
  id: FlowDetailTab | SettingsTab | AppSettingsTab;
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

/**
 * App settings-specific tab config
 */
export interface AppSettingsTabConfig {
  id: AppSettingsTab;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
}
