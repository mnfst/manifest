/**
 * Test fixtures and mock factories for Node module tests
 *
 * Usage:
 *   import { createMockFlowEntity, createMockNodeInstance } from './test/fixtures';
 *
 *   const flow = createMockFlowEntity(); // Get default mock flow
 *   const node = createMockNodeInstance({ name: 'Custom' }); // Override fields
 */

import type {
  NodeInstance,
  Connection,
  CreateNodeRequest,
  UpdateNodeRequest,
  CreateConnectionRequest,
  InsertTransformerRequest,
  TestTransformRequest,
} from '@manifest/shared';
import type { FlowEntity } from '../../flow/flow.entity';

/**
 * Creates a mock FlowEntity for repository tests
 */
export function createMockFlowEntity(
  overrides: Partial<FlowEntity> = {},
): FlowEntity {
  const now = new Date();
  return {
    id: 'test-flow-id',
    appId: 'test-app-id',
    name: 'Test Flow',
    description: 'Test flow description',
    isActive: true,
    nodes: [],
    connections: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as FlowEntity;
}

/**
 * Creates a mock NodeInstance
 */
export function createMockNodeInstance(
  overrides: Partial<NodeInstance> = {},
): NodeInstance {
  return {
    id: 'node-1',
    type: 'ApiCall',
    name: 'Test Node',
    slug: 'test-node',
    position: { x: 100, y: 100 },
    parameters: {},
    ...overrides,
  };
}

/**
 * Creates a mock UserIntent trigger node
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
 * Creates a mock ApiCall node
 */
export function createMockApiCallNode(
  overrides: Partial<NodeInstance> = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'api-call-1',
    type: 'ApiCall',
    name: 'API Call',
    slug: 'api-call',
    parameters: {
      method: 'GET',
      url: 'https://api.example.com/data',
      headers: [],
    },
    ...overrides,
  });
}

/**
 * Creates a mock StatCard UI node
 */
export function createMockStatCardNode(
  overrides: Partial<NodeInstance> = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'statcard-1',
    type: 'StatCard',
    name: 'Stat Card',
    slug: 'stat-card',
    parameters: {
      layoutTemplate: 'stat-card',
    },
    ...overrides,
  });
}

/**
 * Creates a mock Return node
 */
export function createMockReturnNode(
  overrides: Partial<NodeInstance> = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'return-1',
    type: 'Return',
    name: 'Return',
    slug: 'return',
    parameters: {
      text: 'Return text',
    },
    ...overrides,
  });
}

/**
 * Creates a mock Link node
 */
export function createMockLinkNode(
  overrides: Partial<NodeInstance> = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'link-1',
    type: 'Link',
    name: 'Link',
    slug: 'link',
    parameters: {
      url: 'https://example.com',
      text: 'Click here',
    },
    ...overrides,
  });
}

/**
 * Creates a mock JavaScriptCodeTransform node
 */
export function createMockJavaScriptCodeTransformNode(
  overrides: Partial<NodeInstance> = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'transform-1',
    type: 'JavaScriptCodeTransform',
    name: 'Transform',
    slug: 'transform',
    parameters: {
      code: 'return input;',
    },
    ...overrides,
  });
}

/**
 * Creates a mock Connection
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
 * Creates a mock CreateNodeRequest
 */
export function createMockCreateNodeRequest(
  overrides: Partial<CreateNodeRequest> = {},
): CreateNodeRequest {
  return {
    type: 'ApiCall',
    name: 'New Node',
    position: { x: 200, y: 200 },
    parameters: {},
    ...overrides,
  };
}

/**
 * Creates a mock UpdateNodeRequest
 */
export function createMockUpdateNodeRequest(
  overrides: Partial<UpdateNodeRequest> = {},
): UpdateNodeRequest {
  return {
    name: 'Updated Node',
    ...overrides,
  };
}

/**
 * Creates a mock CreateConnectionRequest
 */
export function createMockCreateConnectionRequest(
  overrides: Partial<CreateConnectionRequest> = {},
): CreateConnectionRequest {
  return {
    sourceNodeId: 'node-1',
    sourceHandle: 'output',
    targetNodeId: 'node-2',
    targetHandle: 'input',
    ...overrides,
  };
}

/**
 * Creates a mock InsertTransformerRequest
 */
export function createMockInsertTransformerRequest(
  overrides: Partial<InsertTransformerRequest> = {},
): InsertTransformerRequest {
  return {
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    transformerType: 'JavaScriptCodeTransform',
    ...overrides,
  };
}

/**
 * Creates a mock TestTransformRequest
 */
export function createMockTestTransformRequest(
  overrides: Partial<TestTransformRequest> = {},
): TestTransformRequest {
  return {
    code: 'return { result: input.value * 2 };',
    sampleInput: { value: 5 },
    ...overrides,
  };
}

/**
 * Creates a flow with nodes that need slug migration (missing slugs)
 */
export function createMockFlowNeedingMigration(): FlowEntity {
  return createMockFlowEntity({
    nodes: [
      {
        id: 'node-uuid-1',
        type: 'UserIntent',
        name: 'My Trigger',
        position: { x: 0, y: 0 },
        parameters: { toolName: 'test', isActive: true },
        // Note: no slug
      } as NodeInstance,
      {
        id: 'node-uuid-2',
        type: 'ApiCall',
        name: 'API Call',
        position: { x: 100, y: 100 },
        parameters: {
          url: '{{ node-uuid-1.data }}', // UUID reference that needs migration
        },
      } as NodeInstance,
    ],
  });
}

/**
 * Creates a flow with a cycle (for testing cycle detection)
 */
export function createMockFlowWithPotentialCycle(): FlowEntity {
  return createMockFlowEntity({
    nodes: [
      createMockNodeInstance({ id: 'A', name: 'Node A', slug: 'node-a' }),
      createMockNodeInstance({ id: 'B', name: 'Node B', slug: 'node-b' }),
      createMockNodeInstance({ id: 'C', name: 'Node C', slug: 'node-c' }),
    ],
    connections: [
      createMockConnection({
        id: 'conn-1',
        sourceNodeId: 'A',
        targetNodeId: 'B',
      }),
      createMockConnection({
        id: 'conn-2',
        sourceNodeId: 'B',
        targetNodeId: 'C',
      }),
    ],
  });
}
