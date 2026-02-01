import type { AppearanceConfig, ComponentAppearanceSchema } from '../types/appearance.js';

/**
 * Registry of appearance schemas by component type.
 * Maps component names to their configurable appearance options.
 */
export const COMPONENT_APPEARANCE_REGISTRY: Record<string, ComponentAppearanceSchema> = {
  // RegistryComponent: appearance options are dynamically parsed from the component's TypeScript interface
  RegistryComponent: {
    componentType: 'RegistryComponent',
    options: [],
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

  // BlankComponent: appearance options are dynamically parsed from user's TypeScript interface
  BlankComponent: {
    componentType: 'BlankComponent',
    options: [],
  },
};

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
