import { useState, useCallback } from 'react';
import type { InsertTransformerResponse, NodeType } from '@chatgpt-app-builder/shared';
import { api } from '../lib/api';

/**
 * State for the insert transformer operation
 */
interface InsertTransformerState {
  isLoading: boolean;
  error: string | null;
  result: InsertTransformerResponse | null;
}

/**
 * Hook for inserting a transformer node between two connected nodes.
 * Handles the API call, loading state, and error handling.
 */
export function useInsertTransformer(flowId: string) {
  const [state, setState] = useState<InsertTransformerState>({
    isLoading: false,
    error: null,
    result: null,
  });

  /**
   * Insert a transformer node between source and target nodes.
   * @param sourceNodeId - The ID of the source node
   * @param targetNodeId - The ID of the target node
   * @param transformerType - The type of transformer to insert
   * @returns The result of the insertion, or null if failed
   */
  const insertTransformer = useCallback(
    async (
      sourceNodeId: string,
      targetNodeId: string,
      transformerType: NodeType
    ): Promise<InsertTransformerResponse | null> => {
      setState({ isLoading: true, error: null, result: null });

      try {
        const result = await api.insertTransformer(flowId, {
          sourceNodeId,
          targetNodeId,
          transformerType,
        });

        setState({ isLoading: false, error: null, result });
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to insert transformer';
        setState({ isLoading: false, error: errorMessage, result: null });
        return null;
      }
    },
    [flowId]
  );

  /**
   * Reset the state (clear error and result)
   */
  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, result: null });
  }, []);

  return {
    ...state,
    insertTransformer,
    reset,
  };
}
