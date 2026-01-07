import { useState, useCallback, useRef, useEffect } from 'react';
import type { ValidateConnectionResponse, Connection } from '@chatgpt-app-builder/shared';
import { api } from '../lib/api';
import type { ConnectionValidationState } from '../types/schema';

/**
 * Cache entry for validation results
 */
interface CacheEntry {
  result: ConnectionValidationState;
  timestamp: number;
}

/**
 * Generate a cache key for a connection
 */
function getCacheKey(sourceNodeId: string, targetNodeId: string): string {
  return `${sourceNodeId}->${targetNodeId}`;
}

/**
 * Convert API response to ConnectionValidationState
 */
function toValidationState(response: ValidateConnectionResponse): ConnectionValidationState {
  const errorCount = response.issues.filter(i => i.severity === 'error').length;
  const warningCount = response.issues.filter(i => i.severity === 'warning').length;

  let summary = '';
  if (response.status === 'compatible') {
    summary = 'Schemas are compatible';
  } else if (response.status === 'unknown') {
    summary = 'Schema not defined';
  } else if (errorCount > 0 && warningCount > 0) {
    summary = `${errorCount} error${errorCount > 1 ? 's' : ''}, ${warningCount} warning${warningCount > 1 ? 's' : ''}`;
  } else if (errorCount > 0) {
    summary = `${errorCount} error${errorCount > 1 ? 's' : ''}`;
  } else if (warningCount > 0) {
    summary = `${warningCount} warning${warningCount > 1 ? 's' : ''}`;
  }

  return {
    status: response.status,
    errorCount,
    warningCount,
    summary,
    details: {
      status: response.status,
      issues: response.issues,
      sourceSchema: response.sourceSchema,
      targetSchema: response.targetSchema,
      validatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Hook for managing schema validation state and caching validation results.
 *
 * @param flowId - The ID of the flow containing the connections
 * @param cacheTimeMs - How long to cache validation results (default: 5 minutes)
 */
export function useSchemaValidation(flowId: string, cacheTimeMs = 5 * 60 * 1000) {
  // Map of connection key to validation state
  const [validationResults, setValidationResults] = useState<Map<string, ConnectionValidationState>>(new Map());

  // Cache for validation results with timestamps
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  // Pending requests to avoid duplicate API calls
  const pendingRef = useRef<Map<string, Promise<ConnectionValidationState>>>(new Map());

  /**
   * Validate a single connection and return the result.
   * Uses cache if available and not expired.
   */
  const validateConnection = useCallback(async (
    sourceNodeId: string,
    targetNodeId: string,
    forceRefresh = false
  ): Promise<ConnectionValidationState> => {
    const cacheKey = getCacheKey(sourceNodeId, targetNodeId);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheTimeMs) {
        return cached.result;
      }
    }

    // Check if there's already a pending request
    const pending = pendingRef.current.get(cacheKey);
    if (pending) {
      return pending;
    }

    // Create new request
    const requestPromise = (async () => {
      try {
        const response = await api.validateConnection(flowId, {
          sourceNodeId,
          sourceHandle: 'output',
          targetNodeId,
          targetHandle: 'input',
        });

        const validationState = toValidationState(response);

        // Update cache
        cacheRef.current.set(cacheKey, {
          result: validationState,
          timestamp: Date.now(),
        });

        // Update results map
        setValidationResults(prev => {
          const next = new Map(prev);
          next.set(cacheKey, validationState);
          return next;
        });

        return validationState;
      } finally {
        // Clean up pending request
        pendingRef.current.delete(cacheKey);
      }
    })();

    pendingRef.current.set(cacheKey, requestPromise);
    return requestPromise;
  }, [flowId, cacheTimeMs]);

  /**
   * Validate multiple connections in batch.
   * Returns a map of connection IDs to validation states.
   */
  const validateConnections = useCallback(async (
    connections: Connection[]
  ): Promise<Map<string, ConnectionValidationState>> => {
    const results = new Map<string, ConnectionValidationState>();

    // Validate all connections in parallel
    await Promise.all(
      connections.map(async (conn) => {
        try {
          const result = await validateConnection(conn.sourceNodeId, conn.targetNodeId);
          results.set(conn.id, result);
        } catch {
          // On error, set unknown status
          results.set(conn.id, {
            status: 'unknown',
            errorCount: 0,
            warningCount: 0,
            summary: 'Validation failed',
          });
        }
      })
    );

    return results;
  }, [validateConnection]);

  /**
   * Get cached validation result for a connection.
   * Returns undefined if not cached.
   */
  const getValidation = useCallback((
    sourceNodeId: string,
    targetNodeId: string
  ): ConnectionValidationState | undefined => {
    const cacheKey = getCacheKey(sourceNodeId, targetNodeId);
    return validationResults.get(cacheKey);
  }, [validationResults]);

  /**
   * Get validation result by connection ID.
   */
  const getValidationByConnection = useCallback((
    connection: Connection
  ): ConnectionValidationState | undefined => {
    return getValidation(connection.sourceNodeId, connection.targetNodeId);
  }, [getValidation]);

  /**
   * Invalidate cache for connections involving a specific node.
   * Call this when a node's schema changes.
   */
  const invalidateNode = useCallback((nodeId: string) => {
    const keysToDelete: string[] = [];

    // Find all cache entries involving this node
    cacheRef.current.forEach((_, key) => {
      if (key.includes(nodeId)) {
        keysToDelete.push(key);
      }
    });

    // Delete from cache
    keysToDelete.forEach(key => {
      cacheRef.current.delete(key);
    });

    // Update state
    setValidationResults(prev => {
      const next = new Map(prev);
      keysToDelete.forEach(key => next.delete(key));
      return next;
    });
  }, []);

  /**
   * Clear all cached validation results.
   */
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    setValidationResults(new Map());
  }, []);

  // Clean up expired cache entries periodically
  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      cacheRef.current.forEach((entry, key) => {
        if (now - entry.timestamp > cacheTimeMs) {
          keysToDelete.push(key);
        }
      });

      if (keysToDelete.length > 0) {
        keysToDelete.forEach(key => cacheRef.current.delete(key));
      }
    };

    const interval = setInterval(cleanup, cacheTimeMs / 2);
    return () => clearInterval(interval);
  }, [cacheTimeMs]);

  return {
    validationResults,
    validateConnection,
    validateConnections,
    getValidation,
    getValidationByConnection,
    invalidateNode,
    clearCache,
  };
}
