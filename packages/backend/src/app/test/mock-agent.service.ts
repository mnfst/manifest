/**
 * Mock AgentService factory for App controller tests
 *
 * Usage:
 *   import { createMockAgentService, MockAgentService } from './test/mock-agent.service';
 *
 *   const mockAgentService = createMockAgentService();
 *   mockAgentService.generateApp.mockResolvedValue(mockResult);
 */

import { DEFAULT_THEME_VARIABLES } from '@chatgpt-app-builder/shared';
import type {
  GenerateAppResult,
  ProcessChatResult,
} from '../../agent/agent.service';

/**
 * Type for mocked AgentService
 */
export interface MockAgentService {
  generateApp: jest.Mock<Promise<GenerateAppResult>>;
  processChat: jest.Mock<Promise<ProcessChatResult>>;
  generateFlow: jest.Mock;
  processNodeChat: jest.Mock;
  generatePostListCode: jest.Mock;
}

/**
 * Creates a default GenerateAppResult for testing
 */
export function createMockGenerateAppResult(
  overrides: Partial<GenerateAppResult> = {},
): GenerateAppResult {
  return {
    name: 'Generated App',
    description: 'An AI-generated app',
    layoutTemplate: 'stat-card',
    themeVariables: { ...DEFAULT_THEME_VARIABLES },
    toolName: 'generated_tool',
    toolDescription: 'A generated tool',
    ...overrides,
  };
}

/**
 * Creates a default ProcessChatResult for testing
 */
export function createMockProcessChatResult(
  overrides: Partial<ProcessChatResult> = {},
): ProcessChatResult {
  return {
    response: 'Chat response',
    updates: {},
    changes: [],
    ...overrides,
  };
}

/**
 * Creates a mock AgentService for controller tests
 * All methods return jest.fn() mocks that can be configured per test
 */
export function createMockAgentService(): MockAgentService {
  return {
    generateApp: jest.fn().mockResolvedValue(createMockGenerateAppResult()),
    processChat: jest.fn().mockResolvedValue(createMockProcessChatResult()),
    generateFlow: jest.fn(),
    processNodeChat: jest.fn(),
    generatePostListCode: jest.fn(),
  };
}
