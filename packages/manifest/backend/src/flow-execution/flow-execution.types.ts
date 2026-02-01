import type {
  ExecutionStatus,
  NodeExecutionData,
  ExecutionErrorInfo,
} from '@manifest/shared';

export interface CreateExecutionParams {
  flowId: string;
  flowName: string;
  flowToolName: string;
  initialParams: Record<string, unknown>;
  /** Whether this execution was triggered from preview chat (vs MCP) */
  isPreview?: boolean;
  /** Unique user fingerprint (hash of IP + User-Agent) for analytics */
  userFingerprint?: string;
}

export interface UpdateExecutionParams {
  status?: ExecutionStatus;
  endedAt?: Date;
  nodeExecutions?: NodeExecutionData[];
  errorInfo?: ExecutionErrorInfo;
}

export interface FindByFlowOptions {
  page?: number;
  limit?: number;
  status?: ExecutionStatus;
  /** Filter by preview executions (true = only preview, false = only non-preview, undefined = all) */
  isPreview?: boolean;
}
