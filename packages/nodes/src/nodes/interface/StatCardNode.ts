import type { JSONSchema } from '@chatgpt-app-builder/shared';
import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../../types.js';

/**
 * StatCard Node
 *
 * Displays statistical metrics with trend indicators in a responsive grid.
 * Supports label, value, percentage change, and trend direction (up/down/neutral).
 *
 * This is a read-only display component - it has no output actions.
 * Future iterations may add interactivity (click handlers, etc.).
 *
 * Input: Expects a stats array with StatCardData items.
 * Output: null (read-only node, no outputs).
 */
export const StatCardNode: NodeTypeDefinition = {
  name: 'StatCard',
  displayName: 'Stat Card',
  icon: 'bar-chart-3',
  group: ['ui', 'display', 'stats'],
  category: 'interface',
  description: 'Display statistical metrics with trend indicators',

  inputs: ['main'],
  outputs: [], // Read-only - no outputs for now

  defaultParameters: {
    layoutTemplate: 'stat-card',
  },

  // Input schema for stat card data
  inputSchema: {
    type: 'object',
    properties: {
      stats: {
        type: 'array',
        description: 'Array of statistics to display',
        items: {
          type: 'object',
          properties: {
            label: {
              type: 'string',
              description: 'Metric name (e.g., "Sales", "Orders")',
            },
            value: {
              oneOf: [{ type: 'string' }, { type: 'number' }],
              description: 'Display value (e.g., "$12,543" or 342)',
            },
            change: {
              type: 'number',
              description: 'Percentage change (e.g., 12.5 or -3.2)',
            },
            changeLabel: {
              type: 'string',
              description: 'Description of change (e.g., "vs last month")',
            },
            trend: {
              type: 'string',
              enum: ['up', 'down', 'neutral'],
              description: 'Trend direction indicator',
            },
          },
          required: ['label', 'value'],
        },
      },
    },
    required: ['stats'],
  } as JSONSchema,

  // Read-only node - no outputs
  outputSchema: null,

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { parameters } = context;
    const layoutTemplate = (parameters.layoutTemplate as string) || 'stat-card';

    // StatCard nodes render UI and display metrics
    // The actual rendering is handled by the frontend
    // This execution returns the configured interface data
    return {
      success: true,
      output: {
        type: 'interface',
        layoutTemplate,
      },
    };
  },
};
