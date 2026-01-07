import type { JSONSchema } from '@chatgpt-app-builder/shared';
import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../types.js';

/**
 * Interface Node (formerly View)
 *
 * Displays a UI interface to the user with data rendered in a layout template.
 * Supports action handles for user interactions (e.g., button clicks, form submissions).
 *
 * Input: Accepts any data structure to render in the layout.
 * Output: Dynamic based on layout actions - each action output includes action metadata.
 */
export const InterfaceNode: NodeTypeDefinition = {
  name: 'Interface',
  displayName: 'Agentic Interface',
  icon: 'layout-template',
  group: ['ui', 'display'],
  category: 'interface',
  description: 'Display a UI interface with data in a layout template. Supports user actions.',

  inputs: ['main'],
  outputs: ['action:submit', 'action:click', 'action:select'],

  defaultParameters: {
    layoutTemplate: 'table',
  },

  // Interface nodes accept any input data to render
  inputSchema: {
    type: 'object',
    additionalProperties: true,
    description: 'Data to display in the interface layout',
  } as JSONSchema,

  // Output schema is dynamic based on the action that occurs
  // Static fields marked with x-field-source: 'static', action data is dynamic
  getOutputSchema(parameters: Record<string, unknown>): JSONSchema | null {
    const layoutTemplate = (parameters.layoutTemplate as string) ?? 'table';

    // Base output structure for all actions
    return {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'interface', 'x-field-source': 'static' },
        action: {
          type: 'string',
          enum: ['submit', 'click', 'select'],
          description: 'The action that triggered this output',
          'x-field-source': 'static',
        },
        layoutTemplate: { type: 'string', const: layoutTemplate, 'x-field-source': 'static' },
        data: {
          type: 'object',
          additionalProperties: true,
          description: 'Action-specific data (form values, selected item, etc.)',
          'x-field-source': 'dynamic',
        },
      },
      required: ['type', 'action', 'layoutTemplate'],
    } as JSONSchema;
  },

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { parameters } = context;
    const layoutTemplate = parameters.layoutTemplate as string;

    // Interface nodes render UI and wait for user interaction
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
