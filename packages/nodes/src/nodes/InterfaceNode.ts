import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../types.js';

/**
 * Interface Node (formerly View)
 *
 * Displays a UI interface to the user with data rendered in a layout template.
 * Supports action handles for user interactions (e.g., button clicks, form submissions).
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
