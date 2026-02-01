import type { ThemeVariables } from '@manifest/shared';

/**
 * Internal state for the theme editor component
 */
export interface ThemeEditorState {
  /** Current editing values (may differ from saved) */
  variables: ThemeVariables;
  /** Original saved values from database */
  savedVariables: ThemeVariables;
  /** Map of variable keys to validation error messages */
  errors: Map<string, string>;
  /** Whether a save operation is in progress */
  isSaving: boolean;
}

/**
 * Props interface for custom preview components
 * External components can implement this interface to create custom previews
 */
export interface ThemePreviewProps {
  /** Current theme variables to apply */
  themeVariables: ThemeVariables;
}
