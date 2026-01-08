/**
 * Execution tracking types for flow invocations via MCP
 */

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
 * Paginated execution list response
 */
export interface ExecutionListResponse {
  items: ExecutionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasPendingExecutions: boolean;
}

/**
 * Query parameters for listing executions
 */
export interface ExecutionListQuery {
  page?: number;
  limit?: number;
  status?: ExecutionStatus;
  /** Filter by preview executions (true = only preview, false = only non-preview, undefined = all) */
  isPreview?: boolean;
}
