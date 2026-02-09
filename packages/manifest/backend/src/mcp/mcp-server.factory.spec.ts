/**
 * Unit tests for McpServerFactory
 *
 * Tests MCP server creation, caching, tool/resource/action registration,
 * and request handling with mocked McpToolService.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { McpServerFactory } from './mcp-server.factory';
import type { McpToolService } from './mcp.tool';
import { createMockAppEntity, createMockFlowEntity, createMockUserIntentNode } from './test/fixtures';
import type { AppEntity } from '../app/app.entity';
import { registerAppTool, registerAppResource } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Request, Response } from 'express';

// Mock the MCP SDK modules
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    registerTool: jest.fn(),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation(() => ({
    handleRequest: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  })),
}));

jest.mock('@modelcontextprotocol/ext-apps/server', () => ({
  registerAppTool: jest.fn(),
  registerAppResource: jest.fn(),
  RESOURCE_MIME_TYPE: 'text/html;profile=mcp-app',
}));

function createMockMcpToolService(): jest.Mocked<Pick<McpToolService,
  'getAppBySlug' | 'listTools' | 'listResources' | 'executeTool' | 'executeAction' | 'readResource'
>> {
  return {
    getAppBySlug: jest.fn().mockResolvedValue(null),
    listTools: jest.fn().mockResolvedValue([]),
    listResources: jest.fn().mockResolvedValue([]),
    executeTool: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] }),
    executeAction: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'action ok' }] }),
    readResource: jest.fn().mockResolvedValue({ uri: 'ui://test', mimeType: 'text/html;profile=mcp-app', text: '<html/>' }),
  };
}

function createMockResponse(): Record<string, jest.Mock> {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    on: jest.fn(),
  };
}

describe('McpServerFactory', () => {
  let factory: McpServerFactory;
  let mockToolService: ReturnType<typeof createMockMcpToolService>;

  beforeEach(() => {
    mockToolService = createMockMcpToolService();
    factory = new McpServerFactory(mockToolService as unknown as McpToolService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('handleRequest', () => {
    it('should return 404 when app not found', async () => {
      mockToolService.getAppBySlug.mockResolvedValue(null);
      const mockRes = createMockResponse();

      await factory.handleRequest(
        'non-existent',
        {} as unknown as Request,
        mockRes as unknown as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('non-existent') }),
      );
    });

    it('should create server and handle request for valid slug', async () => {
      const mockApp = createMockAppEntity({ slug: 'test-app', flows: [] });
      mockToolService.getAppBySlug.mockResolvedValue(mockApp);
      const mockRes = createMockResponse();

      await factory.handleRequest(
        'test-app',
        { body: {} } as unknown as Request,
        mockRes as unknown as Response,
      );

      expect(mockToolService.getAppBySlug).toHaveBeenCalledWith('test-app');
      expect(mockRes.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should cache server and reuse on second request', async () => {
      const mockApp = createMockAppEntity({ slug: 'cached-app', flows: [] });
      mockToolService.getAppBySlug.mockResolvedValue(mockApp);

      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();

      await factory.handleRequest('cached-app', { body: {} } as unknown as Request, mockRes1 as unknown as Response);
      await factory.handleRequest('cached-app', { body: {} } as unknown as Request, mockRes2 as unknown as Response);

      // listTools called once during initial creation (registerTools)
      expect(mockToolService.listTools).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidate', () => {
    it('should clear cached server for slug', async () => {
      const mockApp = createMockAppEntity({ slug: 'inv-app', flows: [] });
      mockToolService.getAppBySlug.mockResolvedValue(mockApp);

      const mockRes = createMockResponse();
      await factory.handleRequest('inv-app', { body: {} } as unknown as Request, mockRes as unknown as Response);

      factory.invalidate('inv-app');

      // After invalidation, next request should recreate the server
      const mockRes2 = createMockResponse();
      await factory.handleRequest('inv-app', { body: {} } as unknown as Request, mockRes2 as unknown as Response);

      // getAppBySlug called for both requests (cache was invalidated)
      expect(mockToolService.getAppBySlug).toHaveBeenCalledTimes(4); // 2 per request (getOrCreate + registerActionTools)
    });
  });

  describe('tool registration', () => {
    it('should register tools from McpToolService', async () => {
      const mockApp = createMockAppEntity({ slug: 'tool-app', flows: [] });
      mockToolService.getAppBySlug.mockResolvedValue(mockApp);
      mockToolService.listTools.mockResolvedValue([
        { name: 'my_tool', description: 'A tool', inputSchema: { type: 'object', properties: {} } },
      ]);

      const mockRes = createMockResponse();
      await factory.handleRequest('tool-app', { body: {} } as unknown as Request, mockRes as unknown as Response);

      expect(registerAppTool).toHaveBeenCalledWith(
        expect.anything(),
        'my_tool',
        expect.objectContaining({ title: 'my_tool', description: 'A tool' }),
        expect.any(Function),
      );
    });
  });

  describe('resource registration', () => {
    it('should register resources from McpToolService', async () => {
      const mockApp = createMockAppEntity({ slug: 'res-app', flows: [] });
      mockToolService.getAppBySlug.mockResolvedValue(mockApp);
      mockToolService.listResources.mockResolvedValue([
        { uri: 'ui://widget/res-app/tool/node.html', name: 'Widget', mimeType: 'text/html;profile=mcp-app' },
      ]);

      const mockRes = createMockResponse();
      await factory.handleRequest('res-app', { body: {} } as unknown as Request, mockRes as unknown as Response);

      expect(registerAppResource).toHaveBeenCalledWith(
        expect.anything(),
        'Widget',
        'ui://widget/res-app/tool/node.html',
        expect.objectContaining({ mimeType: 'text/html;profile=mcp-app' }),
        expect.any(Function),
      );
    });
  });

  describe('action tool registration', () => {
    it('should register action tools for RegistryComponent nodes', async () => {
      const mockApp = createMockAppEntity({
        slug: 'action-app',
        flows: [
          createMockFlowEntity({
            nodes: [
              createMockUserIntentNode({ toolName: 'ui_tool' }),
              {
                id: 'registry-1',
                type: 'RegistryComponent',
                name: 'Event List',
                slug: 'event-list',
                position: { x: 0, y: 0 },
                parameters: {
                  registryName: 'event-list',
                  actions: [{ name: 'onSelect' }],
                },
              },
            ],
          }),
        ] as AppEntity['flows'],
      });
      mockToolService.getAppBySlug.mockResolvedValue(mockApp);

      const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
      const mockRegisterTool = jest.fn();
      MockedMcpServer.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        registerTool: mockRegisterTool,
      }) as unknown as McpServer);

      const mockRes = createMockResponse();
      await factory.handleRequest('action-app', { body: {} } as unknown as Request, mockRes as unknown as Response);

      expect(mockRegisterTool).toHaveBeenCalledWith(
        'ui_tool__action__onSelect',
        expect.objectContaining({ title: 'onSelect action' }),
        expect.any(Function),
      );
    });
  });
});
