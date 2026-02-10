import { useState, useCallback } from 'react';
import type { TestApiCallResponse, JSONSchema } from '@manifest/shared';
import { api } from '../lib/api';

/**
 * State for the test API request operation.
 */
interface TestApiRequestState {
  isLoading: boolean;
  error: string | null;
  result: TestApiCallResponse | null;
}

/**
 * Hook for testing an API call node by executing the actual HTTP request.
 * Handles the API call, loading state, and error handling.
 */
export function useTestApiRequest(flowId: string) {
  const [state, setState] = useState<TestApiRequestState>({
    isLoading: false,
    error: null,
    result: null,
  });

  /**
   * Test an API call node by executing the actual HTTP request.
   * @param nodeId - The ID of the ApiCall node to test
   * @param mockValues - Optional mock values for template variables (keyed by node slug)
   * @param saveSchema - Whether to save the inferred schema to the node
   * @returns The test result, or null if failed
   */
  const testRequest = useCallback(
    async (
      nodeId: string,
      mockValues?: Record<string, unknown>,
      saveSchema?: boolean
    ): Promise<TestApiCallResponse | null> => {
      setState({ isLoading: true, error: null, result: null });

      try {
        const result = await api.testApiRequest(flowId, nodeId, {
          mockValues,
          saveSchema,
        });

        setState({ isLoading: false, error: null, result });
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to test API request';
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
    testRequest,
    reset,
  };
}
