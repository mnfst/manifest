import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../types.js';

/**
 * UserIntent Node (Trigger)
 *
 * Defines when the AI should trigger this flow based on user intent.
 * This is a trigger node with no inputs - it can only have outgoing connections.
 * Multiple UserIntent nodes can exist per flow for different trigger conditions.
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
  },

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    // Trigger nodes don't execute - they define activation conditions
    // The execution engine uses their parameters to determine if the flow should run
    return {
      success: true,
      output: {
        type: 'trigger',
        triggered: true,
      },
    };
  },
};
