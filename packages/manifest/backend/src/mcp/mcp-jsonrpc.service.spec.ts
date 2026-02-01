import { McpJsonRpcService, JsonRpcErrorCode } from './mcp-jsonrpc.service';
import { McpToolService } from './mcp.tool';
import type { Request } from 'express';

describe('McpJsonRpcService', () => {
  let service: McpJsonRpcService;
  let mcpToolService: Partial<McpToolService>;

  beforeEach(() => {
    mcpToolService = {
      getAppBySlug: jest.fn(),
      listTools: jest.fn(),
      executeTool: jest.fn(),
      listResources: jest.fn(),
      readResource: jest.fn(),
    };
    service = new McpJsonRpcService(mcpToolService as McpToolService);
  });

  describe('success', () => {
    it('should format a JSON-RPC success response', () => {
      const result = service.success(1, { tools: [] });
      expect(result).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { tools: [] },
      });
    });
  });

  describe('error', () => {
    it('should format a JSON-RPC error response', () => {
      const result = service.error(1, -32601, 'Method not found');
      expect(result).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32601, message: 'Method not found' },
      });
    });
  });

  describe('handleRequest', () => {
    const mockReq = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      get: () => 'TestAgent/1.0',
    } as unknown as Request;

    it('should return 404 when app not found', async () => {
      (mcpToolService.getAppBySlug as jest.Mock).mockResolvedValue(null);

      const result = await service.handleRequest('missing', { jsonrpc: '2.0', id: 1, method: 'tools/list' }, mockReq);

      expect(result.type).toBe('response');
      if (result.type === 'response') {
        expect(result.status).toBe(404);
        expect('error' in result.data).toBe(true);
      }
    });

    it('should handle initialize method', async () => {
      (mcpToolService.getAppBySlug as jest.Mock).mockResolvedValue({ name: 'Test App' });

      const result = await service.handleRequest('test', { jsonrpc: '2.0', id: 1, method: 'initialize' }, mockReq);

      expect(result.type).toBe('response');
      if (result.type === 'response') {
        const data = result.data as { result: { protocolVersion: string; serverInfo: { name: string } } };
        expect(data.result.protocolVersion).toBe('2024-11-05');
        expect(data.result.serverInfo.name).toBe('Test App');
      }
    });

    it('should return no-content for notifications/initialized', async () => {
      (mcpToolService.getAppBySlug as jest.Mock).mockResolvedValue({ name: 'Test App' });

      const result = await service.handleRequest(
        'test',
        { jsonrpc: '2.0', id: 1, method: 'notifications/initialized' },
        mockReq,
      );

      expect(result.type).toBe('no-content');
    });

    it('should handle tools/list method', async () => {
      (mcpToolService.getAppBySlug as jest.Mock).mockResolvedValue({ name: 'Test App' });
      (mcpToolService.listTools as jest.Mock).mockResolvedValue([{ name: 'tool1', description: 'desc' }]);

      const result = await service.handleRequest('test', { jsonrpc: '2.0', id: 1, method: 'tools/list' }, mockReq);

      expect(result.type).toBe('response');
      if (result.type === 'response') {
        const data = result.data as { result: { tools: unknown[] } };
        expect(data.result.tools).toHaveLength(1);
      }
    });

    it('should return INVALID_PARAMS when tools/call has no name', async () => {
      (mcpToolService.getAppBySlug as jest.Mock).mockResolvedValue({ name: 'Test App' });

      const result = await service.handleRequest(
        'test',
        { jsonrpc: '2.0', id: 1, method: 'tools/call', params: {} },
        mockReq,
      );

      expect(result.type).toBe('response');
      if (result.type === 'response') {
        const data = result.data as { error: { code: number } };
        expect(data.error.code).toBe(JsonRpcErrorCode.INVALID_PARAMS);
      }
    });

    it('should return METHOD_NOT_FOUND for unknown methods', async () => {
      (mcpToolService.getAppBySlug as jest.Mock).mockResolvedValue({ name: 'Test App' });

      const result = await service.handleRequest(
        'test',
        { jsonrpc: '2.0', id: 1, method: 'unknown/method' },
        mockReq,
      );

      expect(result.type).toBe('response');
      if (result.type === 'response') {
        const data = result.data as { error: { code: number } };
        expect(data.error.code).toBe(JsonRpcErrorCode.METHOD_NOT_FOUND);
      }
    });

    it('should return INTERNAL_ERROR when tool execution throws', async () => {
      (mcpToolService.getAppBySlug as jest.Mock).mockResolvedValue({ name: 'Test App' });
      (mcpToolService.executeTool as jest.Mock).mockRejectedValue(new Error('Execution failed'));

      const result = await service.handleRequest(
        'test',
        { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'tool1' } },
        mockReq,
      );

      expect(result.type).toBe('response');
      if (result.type === 'response') {
        const data = result.data as { error: { code: number; message: string } };
        expect(data.error.code).toBe(JsonRpcErrorCode.INTERNAL_ERROR);
        expect(data.error.message).toBe('Execution failed');
      }
    });

    it('should return INVALID_PARAMS when resources/read has no URI', async () => {
      (mcpToolService.getAppBySlug as jest.Mock).mockResolvedValue({ name: 'Test App' });

      const result = await service.handleRequest(
        'test',
        { jsonrpc: '2.0', id: 1, method: 'resources/read', params: {} },
        mockReq,
      );

      expect(result.type).toBe('response');
      if (result.type === 'response') {
        const data = result.data as { error: { code: number } };
        expect(data.error.code).toBe(JsonRpcErrorCode.INVALID_PARAMS);
      }
    });
  });
});
