import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../types.js';

/**
 * CallFlow Node
 *
 * Invokes another flow by its ID and passes the result to downstream nodes.
 * Used for flow composition and reusability.
 */
export const CallFlowNode: NodeTypeDefinition = {
  name: 'CallFlow',
  displayName: 'Call Flow',
  icon: 'git-branch',
  group: ['flow', 'logic'],
  category: 'return',
  description: 'Invoke another flow and pass its result to connected nodes.',

  inputs: ['main'],
  outputs: ['main'], // Output carries the result of the called flow

  defaultParameters: {
    targetFlowId: null,
    inputMapping: {}, // Maps input parameters to the target flow
  },

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { parameters, callFlow } = context;
    const targetFlowId = parameters.targetFlowId as string | null;
    const inputMapping = (parameters.inputMapping as Record<string, unknown>) ?? {};

    if (!targetFlowId) {
      return {
        success: false,
        error: 'No target flow configured for CallFlow node',
      };
    }

    try {
      // Execute the target flow with the mapped parameters
      const result = await callFlow(targetFlowId, inputMapping);

      return {
        success: true,
        output: {
          type: 'callFlow',
          targetFlowId,
          result,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error calling flow';
      return {
        success: false,
        error: `Failed to call flow ${targetFlowId}: ${message}`,
      };
    }
  },
};
