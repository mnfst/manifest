/**
 * Utility functions for working with execution metadata in the UI.
 * Provides backward-compatible helpers for extracting status and data
 * from both old and new node output formats.
 */

import type { ExecutionMetadata, NodeExecutionData } from '@manifest/shared';

/**
 * Execution status for UI display
 */
export type NodeStatus = 'success' | 'error' | 'pending';

/**
 * Check if an object has the new _execution metadata format.
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
 * Extract execution status from node output data.
 * Handles both new format (with _execution) and legacy format.
 *
 * @param outputData - The output data from a node execution
 * @param nodeStatus - The node execution status from the record (fallback)
 * @returns The status as 'success', 'error', or 'pending'
 */
export function extractNodeStatus(
  outputData: Record<string, unknown>,
  nodeStatus?: string
): NodeStatus {
  // New format: check _execution.success
  if (hasExecutionMetadata(outputData)) {
    const execution = outputData._execution as ExecutionMetadata;
    if (execution.success === true) return 'success';
    if (execution.success === false) return 'error';
  }

  // Legacy format: check success/error fields at root
  if ('success' in outputData) {
    if (outputData.success === true) return 'success';
    if (outputData.success === false) return 'error';
  }

  // Fallback to node execution status from record
  if (nodeStatus === 'completed') return 'success';
  if (nodeStatus === 'error') return 'error';
  if (nodeStatus === 'pending') return 'pending';

  return 'pending';
}

/**
 * Extract error message from node output data.
 * Handles both new format (with _execution.error) and legacy formats.
 *
 * @param outputData - The output data from a node execution
 * @param nodeError - The error from the node execution record (fallback)
 * @returns Error message string or undefined if no error
 */
export function extractErrorMessage(
  outputData: Record<string, unknown>,
  nodeError?: string
): string | undefined {
  // New format: check _execution.error
  if (hasExecutionMetadata(outputData)) {
    const execution = outputData._execution as ExecutionMetadata;
    if (execution.error) return execution.error;
  }

  // Legacy format: check error field at root
  if (typeof outputData.error === 'string') {
    return outputData.error;
  }

  // Fallback to node execution error
  return nodeError;
}

/**
 * Extract duration in milliseconds from node output data.
 *
 * @param outputData - The output data from a node execution
 * @param nodeExecutionTimeMs - The execution time from the record (fallback)
 * @returns Duration in ms or undefined if not available
 */
export function extractDurationMs(
  outputData: Record<string, unknown>,
  nodeExecutionTimeMs?: number
): number | undefined {
  // New format: check _execution.durationMs
  if (hasExecutionMetadata(outputData)) {
    const execution = outputData._execution as ExecutionMetadata;
    if (typeof execution.durationMs === 'number') return execution.durationMs;
  }

  // Fallback to node execution time from record
  return nodeExecutionTimeMs;
}

/**
 * Extract HTTP status from API call execution metadata.
 *
 * @param outputData - The output data from an API call node
 * @returns HTTP status code or undefined
 */
export function extractHttpStatus(
  outputData: Record<string, unknown>
): number | undefined {
  // New format: check _execution.httpStatus
  if (hasExecutionMetadata(outputData)) {
    const execution = outputData._execution as unknown as Record<string, unknown>;
    if (typeof execution.httpStatus === 'number') return execution.httpStatus;
  }

  // Legacy/alternative: check status at root (ApiCallNode output)
  if (typeof outputData.status === 'number') return outputData.status;

  return undefined;
}

/**
 * Extract request URL from API call execution metadata.
 *
 * @param outputData - The output data from an API call node
 * @returns Request URL string or undefined
 */
export function extractRequestUrl(
  outputData: Record<string, unknown>
): string | undefined {
  // New format: check _execution.requestUrl
  if (hasExecutionMetadata(outputData)) {
    const execution = outputData._execution as unknown as Record<string, unknown>;
    if (typeof execution.requestUrl === 'string') return execution.requestUrl;
  }

  return undefined;
}

/**
 * Extract the actual output data, excluding _execution metadata.
 * This provides a clean view of the data for display.
 *
 * @param outputData - The full output data from a node execution
 * @returns Output data without the _execution property
 */
export function extractOutputDataForDisplay(
  outputData: Record<string, unknown> | undefined | null
): Record<string, unknown> {
  if (!outputData || typeof outputData !== 'object') return {};

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _execution, ...data } = outputData;
  return data;
}

/**
 * Extract combined status info from a node execution.
 * Useful for UI components that need multiple pieces of info.
 */
export interface NodeExecutionStatusInfo {
  status: NodeStatus;
  error?: string;
  durationMs?: number;
  httpStatus?: number;
  requestUrl?: string;
}

/**
 * Extract all status information from a node execution record.
 *
 * @param nodeExecution - The node execution data
 * @returns Combined status information
 */
export function extractStatusInfo(nodeExecution: NodeExecutionData): NodeExecutionStatusInfo {
  const outputData = nodeExecution.outputData ?? {};

  return {
    status: extractNodeStatus(outputData, nodeExecution.status),
    error: extractErrorMessage(outputData, nodeExecution.error),
    durationMs: extractDurationMs(outputData, nodeExecution.executionTimeMs),
    httpStatus: extractHttpStatus(outputData),
    requestUrl: extractRequestUrl(outputData),
  };
}

// Re-export formatDuration from shared utils
export { formatDuration } from '@manifest/shared';
