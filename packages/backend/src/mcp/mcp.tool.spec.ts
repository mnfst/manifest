/**
 * Unit tests for McpToolService
 *
 * Tests MCP tool operations with mocked repositories and dependencies.
 * Focuses on tool listing, execution, resource handling, and action execution.
 *
 * Test organization:
 * - Each public method has its own describe block
 * - Success paths tested first, then error paths
 * - Edge cases and complex scenarios included
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { McpToolService, McpInactiveToolError } from './mcp.tool';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { FlowExecutionService } from '../flow-execution/flow-execution.service';
import {
  createMockAppRepository,
  createMockFlowRepository,
  type MockRepository,
} from './test/mock-repository';
import {
  createMockAppEntity,
  createMockFlowEntity,
  createMockUserIntentNode,
  createMockStatCardNode,
  createMockReturnNode,
  createMockCallFlowNode,
  createMockPostListNode,
  createMockConnection,
  createMockFlowExecutionService,
  createSimpleTriggerReturnFlow,
  createTriggerStatCardFlow,
} from './test/fixtures';

// Mock the node modules that make actual HTTP calls
jest.mock('@chatgpt-app-builder/nodes', () => ({
  ApiCallNode: {
    execute: jest.fn().mockResolvedValue({ success: true, output: { data: 'test' } }),
  },
  JavaScriptCodeTransform: {
    execute: jest.fn().mockResolvedValue({
      success: true,
      output: { result: 'transformed', _execution: { success: true } },
    }),
  },
}));

describe('McpToolService', () => {
  let service: McpToolService;
  let mockAppRepository: MockRepository<AppEntity>;
  let mockFlowRepository: MockRepository<FlowEntity>;
  let mockFlowExecutionService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockAppRepository = createMockAppRepository();
    mockFlowRepository = createMockFlowRepository();
    mockFlowExecutionService = createMockFlowExecutionService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpToolService,
        {
          provide: getRepositoryToken(AppEntity),
          useValue: mockAppRepository,
        },
        {
          provide: getRepositoryToken(FlowEntity),
          useValue: mockFlowRepository,
        },
        {
          provide: FlowExecutionService,
          useValue: mockFlowExecutionService,
        },
      ],
    }).compile();

    service = module.get<McpToolService>(McpToolService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // Tests for getAppBySlug() method
  // ============================================================
  describe('getAppBySlug', () => {
    it('should return published app when found', async () => {
      const mockApp = createMockAppEntity({ slug: 'test-app', status: 'published' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const result = await service.getAppBySlug('test-app');

      expect(result).toBeDefined();
      expect(result?.slug).toBe('test-app');
      expect(mockAppRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'test-app', status: 'published' },
        relations: ['flows'],
      });
    });

    it('should return null when app not found', async () => {
      mockAppRepository.findOne!.mockResolvedValue(null);

      const result = await service.getAppBySlug('non-existent');

      expect(result).toBeNull();
    });

    it('should return null for draft apps', async () => {
      // The query filters by status: 'published', so draft apps won't be found
      mockAppRepository.findOne!.mockResolvedValue(null);

      const result = await service.getAppBySlug('draft-app');

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // Tests for listTools() method
  // ============================================================
  describe('listTools', () => {
    it('should return empty array when app not found', async () => {
      mockAppRepository.findOne!.mockResolvedValue(null);

      const result = await service.listTools('non-existent');

      expect(result).toEqual([]);
    });

    it('should return tools from active UserIntent trigger nodes', async () => {
      const mockApp = createMockAppEntity({ id: 'app-1' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const mockFlow = createMockFlowEntity({
        appId: 'app-1',
        isActive: true,
        nodes: [
          createMockUserIntentNode({
            toolName: 'my_tool',
            toolDescription: 'My tool description',
          }),
        ],
      });
      mockFlowRepository.find!.mockResolvedValue([mockFlow]);

      const result = await service.listTools('test-app');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('my_tool');
      expect(result[0].description).toContain('My tool description');
    });

    it('should skip inactive trigger nodes', async () => {
      const mockApp = createMockAppEntity({ id: 'app-1' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const mockFlow = createMockFlowEntity({
        nodes: [
          createMockUserIntentNode({
            id: 'active-trigger',
            toolName: 'active_tool',
            isActive: true,
          }),
          createMockUserIntentNode({
            id: 'inactive-trigger',
            toolName: 'inactive_tool',
            isActive: false,
          }),
        ],
      });
      mockFlowRepository.find!.mockResolvedValue([mockFlow]);

      const result = await service.listTools('test-app');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('active_tool');
    });

    it('should include whenToUse and whenNotToUse in description', async () => {
      const mockApp = createMockAppEntity({ id: 'app-1' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const mockFlow = createMockFlowEntity({
        nodes: [
          {
            id: 'trigger-1',
            type: 'UserIntent',
            name: 'Test Trigger',
            slug: 'test-trigger',
            position: { x: 0, y: 0 },
            parameters: {
              toolName: 'my_tool',
              toolDescription: 'Main description',
              whenToUse: 'Use when X',
              whenNotToUse: 'Do not use when Y',
              isActive: true,
              parameters: [],
            },
          },
        ],
      });
      mockFlowRepository.find!.mockResolvedValue([mockFlow]);

      const result = await service.listTools('test-app');

      expect(result[0].description).toContain('Main description');
      expect(result[0].description).toContain('WHEN TO USE');
      expect(result[0].description).toContain('Use when X');
      expect(result[0].description).toContain('WHEN NOT TO USE');
      expect(result[0].description).toContain('Do not use when Y');
    });

    it('should build input schema from trigger parameters', async () => {
      const mockApp = createMockAppEntity({ id: 'app-1' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const mockFlow = createMockFlowEntity({
        nodes: [
          createMockUserIntentNode({
            toolName: 'param_tool',
            parameters: [
              { name: 'query', type: 'string', description: 'Search query', optional: false },
              { name: 'limit', type: 'number', description: 'Max results', optional: true },
            ],
          }),
        ],
      });
      mockFlowRepository.find!.mockResolvedValue([mockFlow]);

      const result = await service.listTools('test-app');

      expect(result[0].inputSchema).toEqual({
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results' },
        },
        required: ['query'],
      });
    });

    it('should use default message schema when no parameters defined', async () => {
      const mockApp = createMockAppEntity({ id: 'app-1' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const mockFlow = createMockFlowEntity({
        nodes: [
          createMockUserIntentNode({
            toolName: 'simple_tool',
            parameters: [],
          }),
        ],
      });
      mockFlowRepository.find!.mockResolvedValue([mockFlow]);

      const result = await service.listTools('test-app');

      expect(result[0].inputSchema).toEqual({
        type: 'object',
        properties: {
          message: { type: 'string', description: 'User query or request' },
        },
        required: ['message'],
      });
    });

    it('should add _meta for flows with StatCard nodes', async () => {
      const mockApp = createMockAppEntity({ id: 'app-1', slug: 'my-app' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const flow = createTriggerStatCardFlow({ toolName: 'stats_tool' });
      mockFlowRepository.find!.mockResolvedValue([flow]);

      const result = await service.listTools('my-app');

      expect(result[0]._meta).toBeDefined();
      expect(result[0]._meta?.['openai/outputTemplate']).toBe('ui://widget/my-app/stats_tool.html');
    });
  });

  // ============================================================
  // Tests for executeTool() method
  // ============================================================
  describe('executeTool', () => {
    it('should throw NotFoundException when app not found', async () => {
      mockAppRepository.findOne!.mockResolvedValue(null);

      await expect(
        service.executeTool('non-existent', 'tool', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when tool not found', async () => {
      const mockApp = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(mockApp);
      mockFlowRepository.find!.mockResolvedValue([]);

      await expect(
        service.executeTool('test-app', 'non_existent_tool', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw McpInactiveToolError when trigger is inactive', async () => {
      const mockApp = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const mockFlow = createMockFlowEntity({
        nodes: [
          createMockUserIntentNode({
            toolName: 'inactive_tool',
            isActive: false,
          }),
        ],
      });
      mockFlowRepository.find!.mockResolvedValue([mockFlow]);

      await expect(
        service.executeTool('test-app', 'inactive_tool', {}),
      ).rejects.toThrow(McpInactiveToolError);
    });

    it('should execute a simple trigger -> return flow', async () => {
      const mockApp = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const flow = createSimpleTriggerReturnFlow({
        toolName: 'simple_tool',
        returnText: 'Hello World!',
      });
      mockFlowRepository.find!.mockResolvedValue([flow]);

      const result = await service.executeTool('test-app', 'simple_tool', { message: 'test' });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe('Hello World!');
      expect(mockFlowExecutionService.createExecution).toHaveBeenCalled();
      expect(mockFlowExecutionService.updateExecution).toHaveBeenCalled();
    });

    it('should return message when trigger has no connected nodes', async () => {
      const mockApp = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const flow = createMockFlowEntity({
        nodes: [
          createMockUserIntentNode({ toolName: 'isolated_tool' }),
        ],
        connections: [],
      });
      mockFlowRepository.find!.mockResolvedValue([flow]);

      const result = await service.executeTool('test-app', 'isolated_tool', { message: 'test' });

      expect(result.content[0].text).toContain('not connected to any nodes');
    });

    it('should validate required parameters', async () => {
      const mockApp = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const flow = createMockFlowEntity({
        nodes: [
          createMockUserIntentNode({
            toolName: 'param_tool',
            parameters: [
              { name: 'required_param', type: 'string', optional: false },
            ],
          }),
        ],
      });
      mockFlowRepository.find!.mockResolvedValue([flow]);

      await expect(
        service.executeTool('test-app', 'param_tool', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow optional parameters to be missing', async () => {
      const mockApp = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const flow = createSimpleTriggerReturnFlow({ toolName: 'optional_tool' });
      // Modify the trigger to have optional parameters
      (flow.nodes[0].parameters as any).parameters = [
        { name: 'optional_param', type: 'string', optional: true },
      ];
      mockFlowRepository.find!.mockResolvedValue([flow]);

      const result = await service.executeTool('test-app', 'optional_tool', {});

      // Should not throw, should complete execution
      expect(result.content).toBeDefined();
    });

    it('should execute StatCard node and return structuredContent', async () => {
      const mockApp = createMockAppEntity({ slug: 'test-app' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const flow = createTriggerStatCardFlow({ toolName: 'stats_tool' });
      mockFlowRepository.find!.mockResolvedValue([flow]);

      const result = await service.executeTool('test-app', 'stats_tool', { message: 'get stats' });

      expect(result.structuredContent).toBeDefined();
      expect(result._meta).toBeDefined();
      expect(result._meta?.['openai/outputTemplate']).toContain('stats_tool.html');
    });

    it('should record error in execution when flow fails', async () => {
      const mockApp = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      // Create a flow that will throw during execution
      const flow = createMockFlowEntity({
        nodes: [
          createMockUserIntentNode({ toolName: 'error_tool' }),
          createMockCallFlowNode({ targetFlowId: 'non-existent-flow' }),
        ],
        connections: [
          createMockConnection({
            sourceNodeId: 'trigger-1',
            targetNodeId: 'callflow-1',
          }),
        ],
      });
      mockFlowRepository.find!.mockResolvedValue([flow]);
      mockFlowRepository.findOne!.mockResolvedValue(null); // Target flow not found

      const result = await service.executeTool('test-app', 'error_tool', { message: 'test' });

      // CallFlow with missing target returns error message, not throws
      expect(result.content[0].text).toContain('Error');
    });
  });

  // ============================================================
  // Tests for executeAction() method
  // ============================================================
  describe('executeAction', () => {
    it('should throw NotFoundException when app not found', async () => {
      mockAppRepository.findOne!.mockResolvedValue(null);

      await expect(
        service.executeAction('non-existent', {
          toolName: 'tool',
          nodeId: 'node-1',
          action: 'onClick',
          data: {},
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when tool not found', async () => {
      const mockApp = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(mockApp);
      mockFlowRepository.find!.mockResolvedValue([]);

      await expect(
        service.executeAction('test-app', {
          toolName: 'non_existent',
          nodeId: 'node-1',
          action: 'onClick',
          data: {},
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when node not found', async () => {
      const mockApp = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const flow = createMockFlowEntity({
        nodes: [createMockUserIntentNode({ toolName: 'test_tool' })],
      });
      mockFlowRepository.find!.mockResolvedValue([flow]);

      await expect(
        service.executeAction('test-app', {
          toolName: 'test_tool',
          nodeId: 'non-existent-node',
          action: 'onClick',
          data: {},
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return message when action has no connected nodes', async () => {
      const mockApp = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const postListNode = createMockPostListNode({ id: 'postlist-1' });
      const flow = createMockFlowEntity({
        nodes: [
          createMockUserIntentNode({ toolName: 'test_tool' }),
          postListNode,
        ],
        connections: [
          createMockConnection({
            sourceNodeId: 'trigger-1',
            sourceHandle: 'output',
            targetNodeId: 'postlist-1',
          }),
        ],
      });
      mockFlowRepository.find!.mockResolvedValue([flow]);

      const result = await service.executeAction('test-app', {
        toolName: 'test_tool',
        nodeId: 'postlist-1',
        action: 'onReadMore',
        data: { postId: '123' },
      });

      expect(result.content[0].text).toContain('no connected nodes');
    });

    it('should execute Return node connected to action handle', async () => {
      const mockApp = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const flow = createMockFlowEntity({
        nodes: [
          createMockUserIntentNode({ toolName: 'test_tool' }),
          createMockPostListNode({ id: 'postlist-1' }),
          createMockReturnNode({ id: 'return-1', text: 'Action executed!' }),
        ],
        connections: [
          createMockConnection({
            id: 'conn-1',
            sourceNodeId: 'trigger-1',
            sourceHandle: 'output',
            targetNodeId: 'postlist-1',
            targetHandle: 'input',
          }),
          createMockConnection({
            id: 'conn-2',
            sourceNodeId: 'postlist-1',
            sourceHandle: 'action:onReadMore',
            targetNodeId: 'return-1',
            targetHandle: 'input',
          }),
        ],
      });
      mockFlowRepository.find!.mockResolvedValue([flow]);

      const result = await service.executeAction('test-app', {
        toolName: 'test_tool',
        nodeId: 'postlist-1',
        action: 'onReadMore',
        data: { postId: '123' },
      });

      expect(result.content[0].text).toBe('Action executed!');
    });
  });

  // ============================================================
  // Tests for listResources() method
  // ============================================================
  describe('listResources', () => {
    it('should return empty array when app not found', async () => {
      mockAppRepository.findOne!.mockResolvedValue(null);

      const result = await service.listResources('non-existent');

      expect(result).toEqual([]);
    });

    it('should return resources for flows with StatCard nodes', async () => {
      const mockApp = createMockAppEntity({ slug: 'my-app' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const flow = createTriggerStatCardFlow({ toolName: 'stats_tool' });
      mockFlowRepository.find!.mockResolvedValue([flow]);

      const result = await service.listResources('my-app');

      expect(result).toHaveLength(1);
      expect(result[0].uri).toBe('ui://widget/my-app/stats_tool.html');
      expect(result[0].mimeType).toBe('text/html+skybridge');
    });

    it('should skip inactive triggers', async () => {
      const mockApp = createMockAppEntity({ slug: 'my-app' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const flow = createMockFlowEntity({
        nodes: [
          createMockUserIntentNode({
            toolName: 'inactive_tool',
            isActive: false,
          }),
          createMockStatCardNode(),
        ],
      });
      mockFlowRepository.find!.mockResolvedValue([flow]);

      const result = await service.listResources('my-app');

      expect(result).toEqual([]);
    });

    it('should return callflow resources for flows with CallFlow nodes', async () => {
      const mockApp = createMockAppEntity({ slug: 'my-app' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const flow = createMockFlowEntity({
        nodes: [
          createMockUserIntentNode({ toolName: 'call_tool' }),
          createMockCallFlowNode(),
        ],
      });
      mockFlowRepository.find!.mockResolvedValue([flow]);

      const result = await service.listResources('my-app');

      expect(result).toHaveLength(1);
      expect(result[0].uri).toBe('ui://widget/my-app/call_tool-callflow.html');
    });
  });

  // ============================================================
  // Tests for readResource() method
  // ============================================================
  describe('readResource', () => {
    it('should throw NotFoundException when app not found', async () => {
      mockAppRepository.findOne!.mockResolvedValue(null);

      await expect(
        service.readResource('non-existent', 'ui://widget/test/tool.html'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for invalid URI format', async () => {
      const mockApp = createMockAppEntity({ slug: 'test-app' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      await expect(
        service.readResource('test-app', 'invalid-uri'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when trigger not found', async () => {
      const mockApp = createMockAppEntity({ slug: 'test-app', id: 'app-1' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);
      mockFlowRepository.find!.mockResolvedValue([]);

      await expect(
        service.readResource('test-app', 'ui://widget/test-app/unknown_tool.html'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return widget HTML for StatCard flow', async () => {
      const mockApp = createMockAppEntity({ slug: 'test-app', id: 'app-1' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const flow = createTriggerStatCardFlow({ toolName: 'stats_tool' });
      mockFlowRepository.find!.mockResolvedValue([flow]);

      const result = await service.readResource(
        'test-app',
        'ui://widget/test-app/stats_tool.html',
      );

      expect(result.uri).toBe('ui://widget/test-app/stats_tool.html');
      expect(result.mimeType).toBe('text/html+skybridge');
      expect(result.text).toContain('<!DOCTYPE html>');
      expect(result.text).toContain('stats-grid');
    });

    it('should return callflow widget HTML', async () => {
      const mockApp = createMockAppEntity({ slug: 'test-app', id: 'app-1' });
      mockAppRepository.findOne!.mockResolvedValue(mockApp);

      const targetFlow = createMockFlowEntity({
        id: 'target-flow-id',
        name: 'Target Flow',
        nodes: [createMockUserIntentNode({ toolName: 'target_tool' })],
      });

      const flow = createMockFlowEntity({
        nodes: [
          createMockUserIntentNode({ toolName: 'call_tool' }),
          createMockCallFlowNode({ targetFlowId: 'target-flow-id' }),
        ],
      });

      mockFlowRepository.find!.mockResolvedValue([flow]);
      mockFlowRepository.findOne!.mockResolvedValue(targetFlow);

      const result = await service.readResource(
        'test-app',
        'ui://widget/test-app/call_tool-callflow.html',
      );

      expect(result.text).toContain('<!DOCTYPE html>');
      expect(result.text).toContain('Triggering');
    });
  });

  // ============================================================
  // Tests for McpInactiveToolError
  // ============================================================
  describe('McpInactiveToolError', () => {
    it('should have correct error code', () => {
      const error = new McpInactiveToolError('test_tool');

      expect(error.code).toBe(-32602);
    });

    it('should have descriptive message', () => {
      const error = new McpInactiveToolError('my_tool');

      expect(error.getResponse()).toEqual({
        code: -32602,
        message: "Tool 'my_tool' is not active and cannot be executed",
      });
    });
  });
});
