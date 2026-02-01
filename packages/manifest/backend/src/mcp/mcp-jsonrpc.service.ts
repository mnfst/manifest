import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { McpToolService } from './mcp.tool';
import { generateUserFingerprint } from './mcp.utils';

export const JsonRpcErrorCode = {
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export interface JsonRpcRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  id: number | string;
  result: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: number | string;
  error: { code: number; message: string };
}

export type HandleRequestResult =
  | { type: 'response'; data: JsonRpcSuccessResponse | JsonRpcErrorResponse; status?: number }
  | { type: 'no-content' };

@Injectable()
export class McpJsonRpcService {
  constructor(private readonly mcpToolService: McpToolService) {}

  success(id: number | string, result: unknown): JsonRpcSuccessResponse {
    return { jsonrpc: '2.0', id, result };
  }

  error(id: number | string, code: number, message: string): JsonRpcErrorResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }

  async handleRequest(slug: string, body: JsonRpcRequest, req: Request): Promise<HandleRequestResult> {
    const app = await this.mcpToolService.getAppBySlug(slug);
    if (!app) {
      return {
        type: 'response',
        data: this.error(body.id, JsonRpcErrorCode.INVALID_REQUEST, `No published app found for slug: ${slug}`),
        status: 404,
      };
    }

    const { id, method, params } = body;

    try {
      let result: unknown;

      switch (method) {
        case 'initialize':
          result = {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {}, resources: {} },
            serverInfo: { name: app.name, version: '1.0.0' },
          };
          break;

        case 'notifications/initialized':
          return { type: 'no-content' };

        case 'tools/list': {
          const tools = await this.mcpToolService.listTools(slug);
          result = { tools };
          break;
        }

        case 'tools/call': {
          const toolParams = params as { name: string; arguments?: Record<string, unknown> };
          if (!toolParams?.name) {
            return {
              type: 'response',
              data: this.error(id, JsonRpcErrorCode.INVALID_PARAMS, 'Missing tool name'),
            };
          }
          const userFingerprint = generateUserFingerprint(req);
          result = await this.mcpToolService.executeTool(
            slug,
            toolParams.name,
            toolParams.arguments ?? {},
            userFingerprint,
          );
          break;
        }

        case 'resources/list': {
          const resourcesList = await this.mcpToolService.listResources(slug);
          result = { resources: resourcesList };
          break;
        }

        case 'resources/read': {
          const resourceParams = params as { uri: string };
          if (!resourceParams?.uri) {
            return {
              type: 'response',
              data: this.error(id, JsonRpcErrorCode.INVALID_PARAMS, 'Missing resource URI'),
            };
          }
          const resourceContent = await this.mcpToolService.readResource(slug, resourceParams.uri);
          result = { contents: [resourceContent] };
          break;
        }

        default:
          return {
            type: 'response',
            data: this.error(id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Method not found: ${method}`),
          };
      }

      return { type: 'response', data: this.success(id, result) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        type: 'response',
        data: this.error(id, JsonRpcErrorCode.INTERNAL_ERROR, errorMessage),
      };
    }
  }
}
