/**
 * Test fixtures and mock factories for FlowExecution module tests
 *
 * Usage:
 *   import { createMockExecutionEntity, createMockExecution } from './test/fixtures';
 *
 *   const entity = createMockExecutionEntity(); // Get default mock entity
 *   const entity = createMockExecutionEntity({ status: 'success' }); // Override fields
 */

import type {
  ExecutionStatus,
  NodeExecutionData,
  ExecutionErrorInfo,
  FlowExecution,
  ExecutionListItem,
} from '@manifest/shared';
import type { FlowExecutionEntity } from '../flow-execution.entity';
import type {
  CreateExecutionParams,
  UpdateExecutionParams,
} from '../flow-execution.service';

/**
 * Creates a mock FlowExecutionEntity for repository tests
 */
export function createMockExecutionEntity(
  overrides: Partial<FlowExecutionEntity> = {},
): FlowExecutionEntity {
  const now = new Date();
  return {
    id: 'test-execution-id',
    flowId: 'test-flow-id',
    flowName: 'Test Flow',
    flowToolName: 'test_tool',
    status: 'pending' as ExecutionStatus,
    startedAt: now,
    endedAt: undefined,
    initialParams: { query: 'test query' },
    nodeExecutions: [],
    errorInfo: undefined,
    isPreview: false,
    userFingerprint: undefined,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as FlowExecutionEntity;
}

/**
 * Creates a mock FlowExecution (API response format)
 */
export function createMockFlowExecution(
  overrides: Partial<FlowExecution> = {},
): FlowExecution {
  return {
    id: 'test-execution-id',
    flowId: 'test-flow-id',
    flowName: 'Test Flow',
    flowToolName: 'test_tool',
    status: 'pending',
    startedAt: '2026-01-08T00:00:00.000Z',
    endedAt: undefined,
    initialParams: { query: 'test query' },
    nodeExecutions: [],
    errorInfo: undefined,
    isPreview: false,
    createdAt: '2026-01-08T00:00:00.000Z',
    updatedAt: '2026-01-08T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Creates a mock ExecutionListItem (list response format)
 */
export function createMockExecutionListItem(
  overrides: Partial<ExecutionListItem> = {},
): ExecutionListItem {
  return {
    id: 'test-execution-id',
    flowId: 'test-flow-id',
    flowName: 'Test Flow',
    flowToolName: 'test_tool',
    status: 'pending',
    startedAt: '2026-01-08T00:00:00.000Z',
    endedAt: undefined,
    duration: undefined,
    initialParamsPreview: 'test query',
    isPreview: false,
    ...overrides,
  };
}

/**
 * Creates a mock CreateExecutionParams for service.createExecution()
 */
export function createMockCreateExecutionParams(
  overrides: Partial<CreateExecutionParams> = {},
): CreateExecutionParams {
  return {
    flowId: 'test-flow-id',
    flowName: 'Test Flow',
    flowToolName: 'test_tool',
    initialParams: { query: 'test query' },
    isPreview: false,
    userFingerprint: undefined,
    ...overrides,
  };
}

/**
 * Creates a mock UpdateExecutionParams for service.updateExecution()
 */
export function createMockUpdateExecutionParams(
  overrides: Partial<UpdateExecutionParams> = {},
): UpdateExecutionParams {
  return {
    status: 'success' as ExecutionStatus,
    endedAt: new Date(),
    nodeExecutions: [],
    ...overrides,
  };
}

/**
 * Creates a mock NodeExecutionData for nodeExecutions array
 */
export function createMockNodeExecutionData(
  overrides: Partial<NodeExecutionData> = {},
): NodeExecutionData {
  return {
    nodeId: 'node-1',
    nodeName: 'Test Node',
    nodeType: 'ApiCall',
    status: 'success',
    startedAt: '2026-01-08T00:00:00.000Z',
    endedAt: '2026-01-08T00:00:01.000Z',
    duration: 1000,
    inputData: { input: 'test' },
    outputData: { result: 'success' },
    ...overrides,
  };
}

/**
 * Creates a mock ExecutionErrorInfo
 */
export function createMockErrorInfo(
  overrides: Partial<ExecutionErrorInfo> = {},
): ExecutionErrorInfo {
  return {
    message: 'Test error message',
    nodeId: 'node-1',
    nodeName: 'Test Node',
    ...overrides,
  };
}

/**
 * Creates an entity that looks like it timed out (pending, old startedAt)
 */
export function createMockTimedOutEntity(
  minutesAgo: number = 10,
): FlowExecutionEntity {
  const startedAt = new Date(Date.now() - minutesAgo * 60 * 1000);
  return createMockExecutionEntity({
    id: `timed-out-${minutesAgo}`,
    status: 'pending',
    startedAt,
  });
}

/**
 * Creates a completed execution entity with duration
 */
export function createMockCompletedEntity(
  durationMs: number = 1000,
): FlowExecutionEntity {
  const startedAt = new Date('2026-01-08T00:00:00.000Z');
  const endedAt = new Date(startedAt.getTime() + durationMs);
  return createMockExecutionEntity({
    status: 'success',
    startedAt,
    endedAt,
    nodeExecutions: [createMockNodeExecutionData()],
  });
}

/**
 * Creates an error execution entity
 */
export function createMockErrorEntity(): FlowExecutionEntity {
  return createMockExecutionEntity({
    status: 'error',
    endedAt: new Date(),
    errorInfo: createMockErrorInfo(),
  });
}
