/**
 * Type definitions for UI component appearance configuration.
 * This module defines schemas for form-based visual customization of UI components.
 */

// =============================================================================
// Appearance Value Types
// =============================================================================

/**
 * Possible values for an appearance configuration option.
 */
export type AppearanceValue = string | number | boolean;

/**
 * Configuration object storing component appearance options as key-value pairs.
 */
export type AppearanceConfig = Record<string, AppearanceValue>;

// =============================================================================
// Appearance Schema Types
// =============================================================================

/**
 * Defines the schema for a single appearance option.
 * Used to generate form controls in the Appearance tab.
 */
export interface AppearanceOptionSchema {
  /** Option identifier (e.g., 'variant', 'showAuthor') */
  key: string;

  /** Display label for the form control */
  label: string;

  /** Type of form control to render */
  type: 'enum' | 'boolean' | 'string' | 'number';

  /** For enum type: available values to show in dropdown */
  enumValues?: (string | number)[];

  /** Default value if not configured */
  defaultValue: AppearanceValue;

  /** Optional description/help text shown below the control */
  description?: string;
}

/**
 * Appearance schema for a component type.
 * Defines all available appearance options for a specific component.
 */
export interface ComponentAppearanceSchema {
  /** Component identifier */
  componentType: string;

  /** Available appearance options */
  options: AppearanceOptionSchema[];
}
