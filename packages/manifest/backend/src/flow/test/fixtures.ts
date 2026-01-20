/**
 * Test fixtures and mock factories for Flow module tests
 *
 * Usage:
 *   import { createMockFlowEntity, createMockFlow, createMockNodeInstance } from './test/fixtures';
 *
 *   const flow = createMockFlow(); // Get default mock flow
 *   const flow = createMockFlow({ name: 'Custom Name' }); // Override specific fields
 */

import type {
  Flow,
  NodeInstance,
  Connection,
  FlowDeletionCheck,
  DeleteFlowResponse,
  CreateFlowRequest,
  UpdateFlowRequest,
} from '@manifest/shared';
import type { FlowEntity } from '../flow.entity';
import type { AppEntity } from '../../app/app.entity';
import { DEFAULT_THEME_VARIABLES } from '@manifest/shared';

/**
 * Creates a mock NodeInstance for testing
 * @param overrides - Optional partial NodeInstance to override defaults
 */
export function createMockNodeInstance(
  overrides: Partial<NodeInstance> = {},
): NodeInstance {
  return {
    id: 'node-1',
    type: 'UserIntent',
    name: 'Test Node',
    slug: 'test-node',
    position: { x: 0, y: 0 },
    parameters: {},
    ...overrides,
  };
}

/**
 * Creates a mock UserIntent trigger node
 * @param overrides - Optional partial to override defaults
 */
export function createMockUserIntentNode(
  overrides: Partial<NodeInstance> = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'trigger-1',
    type: 'UserIntent',
    name: 'Test Trigger',
    slug: 'test-trigger',
    parameters: {
      toolName: 'test_tool',
      toolDescription: 'A test tool',
      isActive: true,
      parameters: [],
    },
    ...overrides,
  });
}

/**
 * Creates a mock StatCard node
 * @param overrides - Optional partial to override defaults
 */
export function createMockStatCardNode(
  overrides: Partial<NodeInstance> = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'statcard-1',
    type: 'StatCard',
    name: 'Test StatCard',
    slug: 'test-statcard',
    parameters: {
      layoutTemplate: 'stat-card',
    },
    ...overrides,
  });
}

/**
 * Creates a mock Return node
 * @param overrides - Optional partial to override defaults
 */
export function createMockReturnNode(
  overrides: Partial<NodeInstance> = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'return-1',
    type: 'Return',
    name: 'Test Return',
    slug: 'test-return',
    parameters: {
      text: 'Test return text',
    },
    ...overrides,
  });
}

/**
 * Creates a mock ApiCall node
 * @param overrides - Optional partial to override defaults
 */
export function createMockApiCallNode(
  overrides: Partial<NodeInstance> = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'apicall-1',
    type: 'ApiCall',
    name: 'Test API Call',
    slug: 'test-api-call',
    parameters: {
      method: 'GET',
      url: 'https://api.example.com/data',
      headers: {},
    },
    ...overrides,
  });
}

/**
 * Creates a mock Connection between nodes
 * @param overrides - Optional partial Connection to override defaults
 */
export function createMockConnection(
  overrides: Partial<Connection> = {},
): Connection {
  return {
    id: 'conn-1',
    sourceNodeId: 'node-1',
    sourceHandle: 'output',
    targetNodeId: 'node-2',
    targetHandle: 'input',
    ...overrides,
  };
}

/**
 * Creates a mock Flow object for testing
 * @param overrides - Optional partial Flow to override defaults
 */
export function createMockFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: 'test-flow-id',
    appId: 'test-app-id',
    name: 'Test Flow',
    description: 'Test flow description',
    isActive: true,
    nodes: [],
    connections: [],
    createdAt: '2026-01-08T00:00:00.000Z',
    updatedAt: '2026-01-08T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Creates a mock FlowEntity for repository tests
 * @param overrides - Optional partial FlowEntity to override defaults
 */
export function createMockFlowEntity(
  overrides: Partial<FlowEntity> = {},
): FlowEntity {
  const now = new Date();
  return {
    id: 'test-entity-id',
    appId: 'test-app-id',
    name: 'Test Flow Entity',
    description: 'Entity description',
    isActive: true,
    nodes: [],
    connections: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as FlowEntity;
}

/**
 * Creates a mock AppEntity for relation tests
 * @param overrides - Optional partial AppEntity to override defaults
 */
export function createMockAppEntity(
  overrides: Partial<AppEntity> = {},
): AppEntity {
  const now = new Date();
  return {
    id: 'test-app-id',
    name: 'Test App',
    description: 'Test app description',
    slug: 'test-app',
    themeVariables: { ...DEFAULT_THEME_VARIABLES },
    status: 'draft',
    logoUrl: '/icons/icon-blue.png',
    createdAt: now,
    updatedAt: now,
    flows: [],
    ...overrides,
  } as AppEntity;
}

/**
 * Creates a mock CreateFlowRequest for testing flow creation
 * @param overrides - Optional partial CreateFlowRequest to override defaults
 */
export function createMockCreateFlowRequest(
  overrides: Partial<CreateFlowRequest> = {},
): CreateFlowRequest {
  return {
    name: 'New Test Flow',
    description: 'A new test flow',
    ...overrides,
  };
}

/**
 * Creates a mock UpdateFlowRequest for testing flow updates
 * @param overrides - Optional partial UpdateFlowRequest to override defaults
 */
export function createMockUpdateFlowRequest(
  overrides: Partial<UpdateFlowRequest> = {},
): UpdateFlowRequest {
  return {
    name: 'Updated Flow Name',
    ...overrides,
  };
}

/**
 * Creates a mock FlowDeletionCheck for testing deletion check
 * @param overrides - Optional partial FlowDeletionCheck to override defaults
 */
export function createMockFlowDeletionCheck(
  overrides: Partial<FlowDeletionCheck> = {},
): FlowDeletionCheck {
  return {
    canDelete: true,
    isLastFlow: false,
    appIsPublished: false,
    ...overrides,
  };
}

/**
 * Creates a mock DeleteFlowResponse for testing deletion
 * @param overrides - Optional partial DeleteFlowResponse to override defaults
 */
export function createMockDeleteFlowResponse(
  overrides: Partial<DeleteFlowResponse> = {},
): DeleteFlowResponse {
  return {
    success: true,
    deletedViewCount: 0,
    ...overrides,
  };
}
