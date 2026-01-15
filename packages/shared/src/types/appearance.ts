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

// =============================================================================
// Component Appearance Registry
// =============================================================================

/**
 * Registry of appearance schemas by component type.
 * Maps component names to their configurable appearance options.
 */
export const COMPONENT_APPEARANCE_REGISTRY: Record<string, ComponentAppearanceSchema> = {
  PostList: {
    componentType: 'PostList',
    options: [
      {
        key: 'variant',
        label: 'Layout Variant',
        type: 'enum',
        enumValues: ['list', 'grid', 'carousel'],
        defaultValue: 'list',
        description: 'How posts are arranged',
      },
      {
        key: 'columns',
        label: 'Columns',
        type: 'enum',
        enumValues: [2, 3],
        defaultValue: 3,
        description: 'Number of columns in grid/carousel view',
      },
      {
        key: 'showAuthor',
        label: 'Show Author',
        type: 'boolean',
        defaultValue: true,
        description: 'Display author name and avatar',
      },
      {
        key: 'showCategory',
        label: 'Show Category',
        type: 'boolean',
        defaultValue: true,
        description: 'Display post category badge',
      },
    ],
  },

  ProductList: {
    componentType: 'ProductList',
    options: [
      {
        key: 'variant',
        label: 'Layout Variant',
        type: 'enum',
        enumValues: ['list', 'grid', 'carousel', 'picker'],
        defaultValue: 'grid',
      },
      {
        key: 'columns',
        label: 'Columns',
        type: 'enum',
        enumValues: [2, 3],
        defaultValue: 3,
      },
    ],
  },

  OptionList: {
    componentType: 'OptionList',
    options: [
      {
        key: 'selectable',
        label: 'Selection Mode',
        type: 'enum',
        enumValues: ['single', 'multiple'],
        defaultValue: 'single',
        description: 'Allow single or multiple selections',
      },
    ],
  },

  TagSelect: {
    componentType: 'TagSelect',
    options: [
      {
        key: 'multiSelect',
        label: 'Multi-Select',
        type: 'boolean',
        defaultValue: false,
        description: 'Allow selecting multiple tags',
      },
    ],
  },

  ProgressSteps: {
    componentType: 'ProgressSteps',
    options: [
      {
        key: 'layout',
        label: 'Layout',
        type: 'enum',
        enumValues: ['horizontal', 'vertical'],
        defaultValue: 'horizontal',
      },
    ],
  },

  StatusBadge: {
    componentType: 'StatusBadge',
    options: [
      {
        key: 'status',
        label: 'Status',
        type: 'enum',
        enumValues: ['success', 'pending', 'processing', 'error', 'shipped', 'delivered'],
        defaultValue: 'pending',
      },
    ],
  },

  PostCard: {
    componentType: 'PostCard',
    options: [
      {
        key: 'variant',
        label: 'Variant',
        type: 'enum',
        enumValues: ['default', 'compact', 'horizontal', 'covered'],
        defaultValue: 'default',
      },
    ],
  },

  Table: {
    componentType: 'Table',
    options: [
      {
        key: 'selectable',
        label: 'Row Selection',
        type: 'enum',
        enumValues: ['none', 'single', 'multi'],
        defaultValue: 'none',
      },
      {
        key: 'compact',
        label: 'Compact Mode',
        type: 'boolean',
        defaultValue: false,
        description: 'Reduce row height',
      },
      {
        key: 'stickyHeader',
        label: 'Sticky Header',
        type: 'boolean',
        defaultValue: false,
        description: 'Keep header visible when scrolling',
      },
    ],
  },

  // Stats component has no configurable appearance options
  Stats: {
    componentType: 'Stats',
    options: [],
  },

  // Default for StatCard (current UI node type)
  StatCard: {
    componentType: 'StatCard',
    options: [],
  },

  // BlankComponent: appearance options are dynamically parsed from user's TypeScript interface
  BlankComponent: {
    componentType: 'BlankComponent',
    options: [],
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the appearance schema for a component type.
 * Returns undefined if the component type is not in the registry.
 */
export function getAppearanceSchema(componentType: string): ComponentAppearanceSchema | undefined {
  return COMPONENT_APPEARANCE_REGISTRY[componentType];
}

/**
 * Get default appearance config for a component type.
 * Returns an object with all default values from the schema.
 */
export function getDefaultAppearanceConfig(componentType: string): AppearanceConfig {
  const schema = getAppearanceSchema(componentType);
  if (!schema) return {};

  return schema.options.reduce<AppearanceConfig>((acc, option) => {
    acc[option.key] = option.defaultValue;
    return acc;
  }, {});
}
