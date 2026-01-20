import type { JSONSchema, FlowParameter, TriggerExecutionMetadata } from '@manifest/shared';
import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../../types.js';
import { createUserIntentOutputSchema, USER_QUERY_PARAMETER } from '@manifest/shared';

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
 *
 * Output schema is dynamically generated from the parameters array.
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
    parameters: [USER_QUERY_PARAMETER],
    isActive: true,
  },

  // Trigger nodes have no inputs
  inputSchema: null,

  // Output schema is dynamic based on parameters
  getOutputSchema(parameters: Record<string, unknown>): JSONSchema | null {
    const flowParams = (parameters.parameters ?? []) as FlowParameter[];
    return createUserIntentOutputSchema(flowParams);
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
        _execution: {
          success: true,
          type: 'trigger',
          toolName: params.toolName ?? '',
        } as TriggerExecutionMetadata,
      },
    };
  },
};
