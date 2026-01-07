import type { JSONSchema } from '@chatgpt-app-builder/shared';
import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../../types.js';

/**
 * Return Node (formerly ReturnValue)
 *
 * Returns a text value as the output of a flow execution.
 * This is typically the final node in a flow that terminates execution
 * and provides the result back to the caller.
 *
 * Input: Accepts any data structure (passes through to output).
 * Output: null (Return nodes terminate the flow, no downstream connections).
 */
export const ReturnNode: NodeTypeDefinition = {
  name: 'Return',
  displayName: 'Return Value',
  icon: 'corner-down-left',
  group: ['flow', 'output'],
  category: 'return',
  description: 'Return a text value as the flow output. Terminates the current flow execution.',

  inputs: ['main'],
  outputs: [], // Return nodes have no outputs - they terminate the flow

  defaultParameters: {
    text: '',
  },

  // Return nodes accept any input data structure
  inputSchema: {
    type: 'object',
    additionalProperties: true,
    description: 'Any data structure from upstream nodes',
  } as JSONSchema,

  // Return nodes have no outputs - they terminate the flow
  // Note: The execute output { type: 'return', value } has static structure
  // but no downstream schema since flow terminates here
  outputSchema: null,

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { parameters } = context;
    const text = parameters.text as string;

    // Return nodes simply return their configured text value
    // This terminates the flow and provides the final output
    return {
      success: true,
      output: {
        type: 'return',
        value: text,
      },
    };
  },
};
