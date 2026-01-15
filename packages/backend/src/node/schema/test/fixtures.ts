/**
 * Test fixtures for Schema module tests
 */

import type { FlowEntity } from '../../../flow/flow.entity';
import type {
  NodeInstance,
  Connection,
  ValidateConnectionRequest,
  ResolveSchemaRequest,
} from '@chatgpt-app-builder/shared';

/**
 * Creates a mock FlowEntity
 */
export function createMockFlowEntity(
  overrides: Partial<FlowEntity> = {},
): FlowEntity {
  const now = new Date();
  return {
    id: 'test-flow-id',
    appId: 'test-app-id',
    name: 'Test Flow',
    description: 'Test flow',
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
 * Creates a mock UserIntent node
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
      parameters: [
        { name: 'query', type: 'string', description: 'User query', required: true },
      ],
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
 * Creates a mock ApiCall node with resolved schema
 */
export function createMockApiCallNodeWithSchema(
  overrides: Partial<NodeInstance> = {},
): NodeInstance {
  return createMockApiCallNode({
    parameters: {
      method: 'GET',
      url: 'https://api.example.com/data',
      headers: [],
      resolvedOutputSchema: {
        type: 'object',
        properties: {
          data: { type: 'string' },
        },
      },
    },
    ...overrides,
  });
}

/**
 * Creates a mock StatCard node
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
    },
    ...overrides,
  });
}

/**
 * Creates a mock JavaScriptCodeTransform node
 */
export function createMockTransformNode(
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
 * Creates a mock ValidateConnectionRequest
 */
export function createMockValidateConnectionRequest(
  overrides: Partial<ValidateConnectionRequest> = {},
): ValidateConnectionRequest {
  return {
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    ...overrides,
  };
}

/**
 * Creates a mock ResolveSchemaRequest
 */
export function createMockResolveSchemaRequest(
  overrides: Partial<ResolveSchemaRequest> = {},
): ResolveSchemaRequest {
  return {
    sampleResponse: { data: 'test' },
    ...overrides,
  };
}
