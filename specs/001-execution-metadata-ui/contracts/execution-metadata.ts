/**
 * Execution Metadata Type Contracts
 *
 * Feature: 001-execution-metadata-ui
 * Date: 2026-01-08
 *
 * These interfaces define the standardized execution metadata
 * that all nodes must include in their output.
 */

// =============================================================================
// Base Execution Metadata
// =============================================================================

/**
 * Base execution metadata interface that all nodes include in their output.
 * This provides a consistent contract for downstream nodes and UI components.
 */
export interface ExecutionMetadata {
  /**
   * Whether the node execution completed successfully.
   * - true: Node completed without errors
   * - false: Node encountered an error during execution
   */
  success: boolean;

  /**
   * Error message if execution failed.
   * Only present when success is false.
   */
  error?: string;

  /**
   * Execution duration in milliseconds.
   * Optional for most nodes, required for transforms and API calls.
   */
  durationMs?: number;
}

// =============================================================================
// Node-Specific Metadata Extensions
// =============================================================================

/**
 * Extended metadata for API call nodes.
 * Includes HTTP-specific information for debugging API interactions.
 */
export interface ApiExecutionMetadata extends ExecutionMetadata {
  /**
   * HTTP response status code (e.g., 200, 404, 500).
   * Only present for HTTP responses (not for network errors).
   */
  httpStatus?: number;

  /**
   * HTTP status text (e.g., "OK", "Not Found", "Internal Server Error").
   */
  httpStatusText?: string;

  /**
   * The URL that was called.
   * Useful for debugging template variable resolution.
   */
  requestUrl?: string;
}

/**
 * Extended metadata for transform nodes.
 * Duration is required as transforms are computationally significant.
 */
export interface TransformExecutionMetadata extends ExecutionMetadata {
  /**
   * Execution duration in milliseconds.
   * Required for transform nodes to track computation time.
   */
  durationMs: number;
}

// =============================================================================
// Node Output Wrapper Types
// =============================================================================

/**
 * Standard node output structure.
 * All node outputs follow this pattern: data at root with _execution metadata.
 *
 * @template T - The type of the actual output data
 * @template M - The type of execution metadata (defaults to base)
 */
export type NodeOutput<T extends object, M extends ExecutionMetadata = ExecutionMetadata> =
  T & { _execution: M };

/**
 * Wrapper for primitive outputs.
 * Used when a node returns a non-object value (string, number, boolean, etc.).
 */
export interface PrimitiveOutput<T, M extends ExecutionMetadata = ExecutionMetadata> {
  _value: T;
  _execution: M;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if an object has execution metadata.
 */
export function hasExecutionMetadata(
  obj: unknown
): obj is { _execution: ExecutionMetadata } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    '_execution' in obj &&
    typeof (obj as Record<string, unknown>)._execution === 'object'
  );
}

/**
 * Type guard to check if execution metadata indicates success.
 */
export function isSuccessfulExecution(metadata: ExecutionMetadata): boolean {
  return metadata.success === true;
}

/**
 * Type guard to check if execution metadata is from an API call.
 */
export function isApiExecutionMetadata(
  metadata: ExecutionMetadata
): metadata is ApiExecutionMetadata {
  return 'httpStatus' in metadata || 'requestUrl' in metadata;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Extract the actual data from a node output, excluding _execution.
 */
export function extractOutputData<T extends object>(
  output: NodeOutput<T>
): Omit<T, '_execution'> {
  const { _execution, ...data } = output;
  return data as Omit<T, '_execution'>;
}

/**
 * Create a successful execution metadata object.
 */
export function createSuccessMetadata(durationMs?: number): ExecutionMetadata {
  return {
    success: true,
    ...(durationMs !== undefined && { durationMs }),
  };
}

/**
 * Create an error execution metadata object.
 */
export function createErrorMetadata(error: string, durationMs?: number): ExecutionMetadata {
  return {
    success: false,
    error,
    ...(durationMs !== undefined && { durationMs }),
  };
}
