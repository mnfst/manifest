import type { JSONSchema } from '@chatgpt-app-builder/shared';
import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../../types.js';

/**
 * CallFlow Node
 *
 * Invokes another flow by its ID and passes the result to downstream nodes.
 * Used for flow composition and reusability.
 *
 * Input: Accepts any data structure to pass to the called flow.
 * Output: Dynamic based on the target flow's return value (unknown until configured).
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

  // CallFlow accepts any input data to pass to the target flow
  inputSchema: {
    type: 'object',
    additionalProperties: true,
    description: 'Data to pass to the target flow',
  } as JSONSchema,

  // Output schema depends on the target flow - dynamic resolution needed
  // For now, return a base structure (full resolution requires target flow lookup)
  getOutputSchema(parameters: Record<string, unknown>): JSONSchema | null {
    const targetFlowId = parameters.targetFlowId as string | null;

    if (!targetFlowId) {
      // No target flow configured - output is unknown
      return null;
    }

    // Base structure - the actual 'result' schema depends on target flow
    // Full schema resolution happens at the service layer with flow context
    // Static fields are marked with x-field-source: 'static', result is dynamic
    return {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'callFlow', 'x-field-source': 'static' },
        targetFlowId: { type: 'string', 'x-field-source': 'static' },
        result: {
          description: 'Result from the called flow (schema depends on target flow)',
          'x-field-source': 'dynamic',
        },
      },
      required: ['type', 'targetFlowId'],
    } as JSONSchema;
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
