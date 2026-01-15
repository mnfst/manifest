import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../../types.js';
import { BLANK_COMPONENT_DEFAULT_CODE } from '@chatgpt-app-builder/shared';

/**
 * BlankComponent Node
 *
 * A customizable UI component that follows the Manifest UI 4-argument pattern:
 * - data: Input from flow execution
 * - appearance: Visual styling options
 * - control: Behavior and state control
 * - actions: Event callbacks
 *
 * Provides users with a template to create their own custom UI components.
 */
export const BlankComponentNode: NodeTypeDefinition = {
  name: 'BlankComponent',
  displayName: 'Blank Component',
  icon: 'square',
  group: ['ui', 'custom'],
  category: 'interface',
  description: 'Create your own custom UI component with the 4-argument pattern (data, appearance, control, actions)',
  inputs: ['main'],
  outputs: ['main'],
  defaultParameters: {},
  inputSchema: { type: 'object', additionalProperties: true },
  outputSchema: { type: 'object', additionalProperties: true },

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { customCode, appearanceConfig } = context.parameters as {
      customCode?: string;
      appearanceConfig?: Record<string, unknown>;
    };

    // Get the input data from the previous node
    let inputData: unknown = null;
    try {
      inputData = await context.getNodeValue(context.nodeId);
    } catch {
      // No input data available, which is fine for UI components
    }

    return {
      success: true,
      output: {
        component: 'BlankComponent',
        code: customCode || BLANK_COMPONENT_DEFAULT_CODE,
        appearance: appearanceConfig || {},
        data: inputData,
      },
    };
  },
};
