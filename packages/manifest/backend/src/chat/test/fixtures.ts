/**
 * Test fixtures for Chat module tests
 */

import type { FlowEntity } from '../../flow/flow.entity';
import type { PreviewChatRequest } from '@manifest/shared';

/**
 * Creates a mock FlowEntity for chat tests
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
 * Creates a mock FlowEntity with UserIntent nodes (triggers)
 */
export function createMockFlowWithTriggers(
  overrides: Partial<FlowEntity> = {},
): FlowEntity {
  return createMockFlowEntity({
    nodes: [
      {
        id: 'trigger-1',
        type: 'UserIntent',
        name: 'Search Tool',
        slug: 'search_tool',
        position: { x: 100, y: 100 },
        parameters: {
          toolName: 'search',
          toolDescription: 'Search for information',
          isActive: true,
          parameters: [
            { name: 'query', type: 'string', description: 'Search query', required: true },
          ],
        },
      },
      {
        id: 'trigger-2',
        type: 'UserIntent',
        name: 'Calculate Tool',
        slug: 'calculate_tool',
        position: { x: 300, y: 100 },
        parameters: {
          toolName: 'calculate',
          toolDescription: 'Perform calculations',
          isActive: true,
          parameters: [
            { name: 'expression', type: 'string', description: 'Math expression', required: true },
          ],
        },
      },
    ],
    ...overrides,
  });
}

/**
 * Creates a mock FlowEntity with inactive trigger
 */
export function createMockFlowWithInactiveTrigger(
  overrides: Partial<FlowEntity> = {},
): FlowEntity {
  return createMockFlowEntity({
    nodes: [
      {
        id: 'trigger-inactive',
        type: 'UserIntent',
        name: 'Inactive Tool',
        slug: 'inactive_tool',
        position: { x: 100, y: 100 },
        parameters: {
          toolName: 'inactive',
          toolDescription: 'This tool is inactive',
          isActive: false,
          parameters: [],
        },
      },
    ],
    ...overrides,
  });
}

/**
 * Creates a mock FlowEntity with published app
 */
export function createMockFlowWithPublishedApp(
  overrides: Partial<FlowEntity> = {},
): FlowEntity {
  const flow = createMockFlowWithTriggers(overrides);
  flow.app = {
    id: 'app-id',
    slug: 'test-app',
    name: 'Test App',
    status: 'published',
  } as FlowEntity['app'];
  return flow;
}

/**
 * Creates a mock PreviewChatRequest
 */
export function createMockChatRequest(
  overrides: Partial<PreviewChatRequest> = {},
): PreviewChatRequest {
  return {
    flowId: 'test-flow-id',
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: 'Hello, how can you help me?' },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock chat request with conversation history
 */
export function createMockChatRequestWithHistory(
  overrides: Partial<PreviewChatRequest> = {},
): PreviewChatRequest {
  return createMockChatRequest({
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is 2+2?' },
      { role: 'assistant', content: 'The answer is 4.' },
      { role: 'user', content: 'And 3+3?' },
    ],
    ...overrides,
  });
}

/**
 * Creates a mock chat request with tool results
 */
export function createMockChatRequestWithToolResult(
  overrides: Partial<PreviewChatRequest> = {},
): PreviewChatRequest {
  return createMockChatRequest({
    messages: [
      { role: 'user', content: 'Search for cats' },
      {
        role: 'tool',
        content: '',
        toolResult: {
          toolCallId: 'call_123',
          content: 'Found 10 results about cats',
        },
      },
    ],
    ...overrides,
  });
}
