/**
 * Test fixtures and mock factories for MCP module tests
 *
 * Usage:
 *   import { createMockAppEntity, createMockFlowWithTrigger } from './test/fixtures';
 */

import type {
  NodeInstance,
  Connection,
  McpToolResponse,
  ExecuteActionRequest,
} from '@manifest/shared';
import type { AppEntity } from '../../app/app.entity';
import type { FlowEntity } from '../../flow/flow.entity';
import { DEFAULT_THEME_VARIABLES } from '@manifest/shared';

/**
 * Creates a mock AppEntity for MCP tests
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
    status: 'published',
    logoUrl: '/icons/icon-blue.png',
    createdAt: now,
    updatedAt: now,
    flows: [],
    ...overrides,
  } as AppEntity;
}

/**
 * Creates a mock FlowEntity for MCP tests
 * @param overrides - Optional partial FlowEntity to override defaults
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
 * Creates a mock UserIntent trigger node with MCP tool configuration
 * @param overrides - Partial to override defaults
 */
export function createMockUserIntentNode(
  overrides: {
    id?: string;
    name?: string;
    slug?: string;
    toolName?: string;
    toolDescription?: string;
    isActive?: boolean;
    parameters?: Array<{ name: string; type: string; description?: string; optional?: boolean }>;
  } = {},
): NodeInstance {
  return createMockNodeInstance({
    id: overrides.id ?? 'trigger-1',
    type: 'UserIntent',
    name: overrides.name ?? 'Test Trigger',
    slug: overrides.slug ?? 'test-trigger',
    parameters: {
      toolName: overrides.toolName ?? 'test_tool',
      toolDescription: overrides.toolDescription ?? 'A test tool',
      isActive: overrides.isActive ?? true,
      parameters: overrides.parameters ?? [],
    },
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
  overrides: Partial<NodeInstance> & { text?: string } = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'return-1',
    type: 'Return',
    name: 'Test Return',
    slug: 'test-return',
    parameters: {
      text: overrides.text ?? 'Test return text',
    },
    ...overrides,
  });
}

/**
 * Creates a mock ApiCall node
 * @param overrides - Optional partial to override defaults
 */
export function createMockApiCallNode(
  overrides: Partial<NodeInstance> & { url?: string; method?: string } = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'apicall-1',
    type: 'ApiCall',
    name: 'Test API Call',
    slug: 'test-api-call',
    parameters: {
      method: overrides.method ?? 'GET',
      url: overrides.url ?? 'https://api.example.com/data',
      headers: {},
    },
    ...overrides,
  });
}

/**
 * Creates a mock CallFlow node
 * @param overrides - Optional partial to override defaults
 */
export function createMockCallFlowNode(
  overrides: Partial<NodeInstance> & { targetFlowId?: string } = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'callflow-1',
    type: 'CallFlow',
    name: 'Test Call Flow',
    slug: 'test-call-flow',
    parameters: {
      targetFlowId: overrides.targetFlowId ?? 'target-flow-id',
    },
    ...overrides,
  });
}

/**
 * Creates a mock PostList node
 * @param overrides - Optional partial to override defaults
 */
export function createMockPostListNode(
  overrides: Partial<NodeInstance> = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'postlist-1',
    type: 'PostList',
    name: 'Test Post List',
    slug: 'test-post-list',
    parameters: {},
    ...overrides,
  });
}

/**
 * Creates a mock JavaScriptCodeTransform node
 * @param overrides - Optional partial to override defaults
 */
export function createMockTransformNode(
  overrides: Partial<NodeInstance> & { code?: string } = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'transform-1',
    type: 'JavaScriptCodeTransform',
    name: 'Test Transform',
    slug: 'test-transform',
    parameters: {
      code: overrides.code ?? 'return input;',
    },
    ...overrides,
  });
}

/**
 * Creates a mock Link node
 * @param overrides - Optional partial to override defaults
 */
export function createMockLinkNode(
  overrides: Partial<NodeInstance> & { href?: string } = {},
): NodeInstance {
  return createMockNodeInstance({
    id: 'link-1',
    type: 'Link',
    name: 'Test Link',
    slug: 'test-link',
    parameters: {
      href: overrides.href ?? 'https://example.com',
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
 * Creates a mock flow with a UserIntent trigger and connected nodes
 * Useful for testing tool execution
 */
export function createMockFlowWithTrigger(options: {
  flowId?: string;
  appId?: string;
  triggerToolName?: string;
  triggerIsActive?: boolean;
  connectedNodes?: NodeInstance[];
  connections?: Connection[];
} = {}): FlowEntity {
  const triggerId = 'trigger-1';
  const triggerNode = createMockUserIntentNode({
    id: triggerId,
    toolName: options.triggerToolName ?? 'test_tool',
    isActive: options.triggerIsActive ?? true,
  });

  const nodes = [triggerNode, ...(options.connectedNodes ?? [])];
  const connections = options.connections ?? [];

  return createMockFlowEntity({
    id: options.flowId ?? 'test-flow-id',
    appId: options.appId ?? 'test-app-id',
    nodes,
    connections,
  });
}

/**
 * Creates a mock McpToolResponse
 * @param overrides - Optional partial to override defaults
 */
export function createMockMcpToolResponse(
  overrides: Partial<McpToolResponse> = {},
): McpToolResponse {
  return {
    content: [{ type: 'text', text: 'Test response' }],
    ...overrides,
  };
}

/**
 * Creates a mock ExecuteActionRequest
 * @param overrides - Optional partial to override defaults
 */
export function createMockExecuteActionRequest(
  overrides: Partial<ExecuteActionRequest> = {},
): ExecuteActionRequest {
  return {
    toolName: 'test_tool',
    nodeId: 'node-1',
    action: 'onReadMore',
    data: {},
    ...overrides,
  };
}

/**
 * Creates a mock FlowExecutionService for testing
 */
export function createMockFlowExecutionService(): Record<string, jest.Mock> {
  return {
    createExecution: jest.fn().mockResolvedValue({
      id: 'exec-1',
      flowId: 'flow-1',
      status: 'pending',
    }),
    updateExecution: jest.fn().mockResolvedValue({
      id: 'exec-1',
      status: 'fulfilled',
    }),
  };
}

/**
 * Creates a simple trigger -> return flow for testing
 */
export function createSimpleTriggerReturnFlow(options: {
  toolName?: string;
  returnText?: string;
} = {}): FlowEntity {
  const triggerId = 'trigger-1';
  const returnId = 'return-1';

  const trigger = createMockUserIntentNode({
    id: triggerId,
    toolName: options.toolName ?? 'simple_tool',
  });

  const returnNode = createMockReturnNode({
    id: returnId,
    text: options.returnText ?? 'Hello from the flow!',
  });

  const connection = createMockConnection({
    id: 'conn-1',
    sourceNodeId: triggerId,
    sourceHandle: 'output',
    targetNodeId: returnId,
    targetHandle: 'input',
  });

  return createMockFlowEntity({
    nodes: [trigger, returnNode],
    connections: [connection],
  });
}

/**
 * Creates a trigger -> statcard flow for testing UI widgets
 */
export function createTriggerStatCardFlow(options: {
  toolName?: string;
} = {}): FlowEntity {
  const triggerId = 'trigger-1';
  const statCardId = 'statcard-1';

  const trigger = createMockUserIntentNode({
    id: triggerId,
    toolName: options.toolName ?? 'stats_tool',
  });

  const statCard = createMockStatCardNode({ id: statCardId });

  const connection = createMockConnection({
    id: 'conn-1',
    sourceNodeId: triggerId,
    sourceHandle: 'output',
    targetNodeId: statCardId,
    targetHandle: 'input',
  });

  return createMockFlowEntity({
    nodes: [trigger, statCard],
    connections: [connection],
  });
}
