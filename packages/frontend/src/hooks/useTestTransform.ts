import { useState, useCallback } from 'react';
import type { TestTransformResponse, JSONSchema } from '@chatgpt-app-builder/shared';
import { api } from '../lib/api';

/**
 * State for the test transform operation.
 */
interface TestTransformState {
  isLoading: boolean;
  error: string | null;
  result: TestTransformResponse | null;
}

/**
 * Hook for testing JavaScript transform code with sample input.
 * Handles the API call, loading state, and error handling.
 */
export function useTestTransform(flowId: string) {
  const [state, setState] = useState<TestTransformState>({
    isLoading: false,
    error: null,
    result: null,
  });

  /**
   * Test a transform with the given code and sample input.
   * @param code - The JavaScript code to execute
   * @param sampleInput - The sample input data to transform
   * @returns The test result, or null if failed
   */
  const testTransform = useCallback(
    async (
      code: string,
      sampleInput: unknown
    ): Promise<TestTransformResponse | null> => {
      setState({ isLoading: true, error: null, result: null });

      try {
        const result = await api.testTransform(flowId, {
          code,
          sampleInput,
        });

        setState({ isLoading: false, error: null, result });
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to test transform';
        setState({ isLoading: false, error: errorMessage, result: null });
        return null;
      }
    },
    [flowId]
  );

  /**
   * Reset the state (clear error and result).
   */
  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, result: null });
  }, []);

  /**
   * Get the output schema from the last successful test.
   */
  const outputSchema: JSONSchema | undefined = state.result?.success
    ? state.result.outputSchema
    : undefined;

  return {
    ...state,
    outputSchema,
    testTransform,
    reset,
  };
}
