import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../types.js';

/**
 * UserIntent Node (Trigger)
 *
 * Defines when the AI should trigger this flow based on user intent.
 * This is a trigger node with no inputs - it can only have outgoing connections.
 * Multiple UserIntent nodes can exist per flow for different trigger conditions.
 *
 * Each UserIntent node represents an MCP tool entry point with its own:
 * - toolName: Auto-generated from node name in snake_case
 * - toolDescription: Description shown in MCP
 * - parameters: Input parameters for the tool
 * - isActive: Whether this trigger is exposed as MCP tool
 */
export const UserIntentNode: NodeTypeDefinition = {
  name: 'UserIntent',
  displayName: 'User Intent',
  icon: 'zap',
  group: ['flow', 'trigger'],
  category: 'trigger',
  description: 'Defines when the AI should trigger this flow based on user intent',

  inputs: [], // Trigger nodes have no inputs
  outputs: ['main'],

  defaultParameters: {
    whenToUse: '',
    whenNotToUse: '',
    toolName: '', // Auto-generated from node name
    toolDescription: '',
    parameters: [],
    isActive: true,
  },

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    // Trigger nodes don't execute - they define activation conditions
    // The execution engine uses their parameters to determine if the flow should run
    const params = context.parameters as {
      toolName?: string;
    };

    return {
      success: true,
      output: {
        type: 'trigger',
        triggered: true,
        toolName: params.toolName,
      },
    };
  },
};
