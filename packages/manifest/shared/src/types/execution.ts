/**
 * Execution tracking types for flow invocations via MCP
 */

import type { PaginatedResponse, PaginationQuery } from './pagination.js';

/**
 * Execution status enum
 * - pending: Execution is in progress
 * - fulfilled: Execution completed successfully
 * - error: Execution failed
 */
export type ExecutionStatus = 'pending' | 'fulfilled' | 'error';

/**
 * Node execution status (different from overall execution status)
 */
export type NodeExecutionStatus = 'pending' | 'completed' | 'error';

/**
 * Represents the state of a single node during execution.
 * Stored as array elements in `nodeExecutions`.
 */
export interface NodeExecutionData {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  executedAt: string; // ISO datetime string
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  status: NodeExecutionStatus;
  error?: string;
  /** Execution time in milliseconds (primarily useful for transform nodes) */
  executionTimeMs?: number;
}

/**
 * Detailed error information when execution fails.
 */
export interface ExecutionErrorInfo {
  message: string;
  nodeId?: string;
  nodeName?: string;
  stack?: string;
}

/**
 * Full execution record with all details
 */
export interface FlowExecution {
  id: string;
  flowId?: string;
  flowName: string;
  flowToolName: string;
  status: ExecutionStatus;
  startedAt: string; // ISO datetime string
  endedAt?: string; // ISO datetime string
  initialParams: Record<string, unknown>;
  nodeExecutions: NodeExecutionData[];
  errorInfo?: ExecutionErrorInfo;
  /** Whether this execution was triggered from preview chat (vs MCP) */
  isPreview?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Compact execution representation for list view
 */
export interface ExecutionListItem {
  id: string;
  flowId?: string;
  flowName: string;
  flowToolName: string;
  status: ExecutionStatus;
  startedAt: string;
  endedAt?: string;
  duration?: number; // milliseconds
  initialParamsPreview: string;
  /** Whether this execution was triggered from preview chat (vs MCP) */
  isPreview?: boolean;
}

/**
 * Paginated execution list response.
 * Extends the generic PaginatedResponse with execution-specific metadata.
 */
export interface ExecutionListResponse extends PaginatedResponse<ExecutionListItem> {
  hasPendingExecutions: boolean;
}

/**
 * Query parameters for listing executions.
 * Extends the generic PaginationQuery with execution-specific filters.
 */
export interface ExecutionListQuery extends PaginationQuery {
  status?: ExecutionStatus;
  /** Filter by preview executions (true = only preview, false = only non-preview, undefined = all) */
  isPreview?: boolean;
}

// =============================================================================
// Node Output Execution Metadata
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

/**
 * Extended metadata for trigger nodes.
 * Includes trigger-specific context about how the flow was invoked.
 */
export interface TriggerExecutionMetadata extends ExecutionMetadata {
  /**
   * Identifies this as a trigger node output.
   */
  type: 'trigger';

  /**
   * The MCP tool name that was invoked.
   * Auto-generated from the node name in snake_case.
   */
  toolName: string;
}

/**
 * Standard node output structure.
 * All node outputs follow this pattern: data at root with _execution metadata.
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

/**
 * Extract the actual data from a node output, excluding _execution.
 */
export function extractOutputData<T extends Record<string, unknown>>(
  output: T
): Omit<T, '_execution'> {
  if (!output || typeof output !== 'object') return output;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _execution, ...data } = output as T & { _execution?: unknown };
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
