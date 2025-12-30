import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../types.js';
import { DEFAULT_TABLE_MOCK_DATA } from '@chatgpt-app-builder/shared';

/**
 * Interface Node (formerly View)
 *
 * Displays a UI interface to the user with data rendered in a layout template.
 * Supports action handles for user interactions (e.g., button clicks, form submissions).
 */
export const InterfaceNode: NodeTypeDefinition = {
  name: 'Interface',
  displayName: 'Display Interface',
  icon: 'layout-template',
  group: ['ui', 'display'],
  description: 'Display a UI interface with data in a layout template. Supports user actions.',

  inputs: ['main'],
  outputs: ['action:submit', 'action:click', 'action:select'],

  defaultParameters: {
    layoutTemplate: 'table',
    mockData: DEFAULT_TABLE_MOCK_DATA,
  },

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { parameters } = context;
    const layoutTemplate = parameters.layoutTemplate as string;
    const mockData = parameters.mockData;

    // Interface nodes render UI and wait for user interaction
    // The actual rendering is handled by the frontend
    // This execution returns the configured interface data
    return {
      success: true,
      output: {
        type: 'interface',
        layoutTemplate,
        data: mockData,
      },
    };
  },
};
