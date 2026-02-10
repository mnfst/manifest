import { Injectable, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import type { Request, Response } from 'express';
import { McpToolService } from './mcp.tool';

/**
 * Factory that creates per-slug McpServer instances with StreamableHTTPServerTransport.
 * Registers tools and resources from McpToolService.
 */
@Injectable()
export class McpServerFactory {
  private readonly logger = new Logger(McpServerFactory.name);
  private readonly serverCache = new Map<string, McpServer>();

  constructor(private readonly mcpToolService: McpToolService) {}

  /**
   * Handle an incoming MCP request for a given app slug.
   * Creates a stateless transport per request to avoid session conflicts.
   */
  async handleRequest(slug: string, req: Request, res: Response): Promise<void> {
    const server = await this.getOrCreateServer(slug);
    if (!server) {
      res.status(404).json({ error: `No published app found for slug: ${slug}` });
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  /**
   * Invalidate cached server for a slug (e.g., on app update)
   */
  invalidate(slug: string): void {
    this.serverCache.delete(slug);
  }

  private async getOrCreateServer(slug: string): Promise<McpServer | null> {
    const cached = this.serverCache.get(slug);
    if (cached) return cached;

    const app = await this.mcpToolService.getAppBySlug(slug);
    if (!app) return null;

    const server = new McpServer({
      name: app.name,
      version: '1.0.0',
    });

    await this.registerTools(server, slug);
    await this.registerResources(server, slug);
    await this.registerActionTools(server, slug);

    this.serverCache.set(slug, server);
    return server;
  }

  private async registerTools(server: McpServer, slug: string): Promise<void> {
    const tools = await this.mcpToolService.listTools(slug);
    const resources = await this.mcpToolService.listResources(slug);

    for (const tool of tools) {
      const resourceUri = resources.find(r =>
        r.uri.includes(`/${tool.name}/`) || r.uri.includes(`/${tool.name}-`)
      )?.uri;

      const toolConfig: Record<string, unknown> = {
        title: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      };

      if (resourceUri) {
        toolConfig._meta = { ui: { resourceUri } };
      }

      registerAppTool(
        server,
        tool.name,
        toolConfig,
        async (args: Record<string, unknown>, extra?: { _meta?: Record<string, unknown> }) => {
          const fingerprint = (extra?._meta?.fingerprint as string) || undefined;
          const result = await this.mcpToolService.executeTool(slug, tool.name, args, fingerprint);
          return result;
        },
      );
    }
  }

  private async registerResources(server: McpServer, slug: string): Promise<void> {
    const resources = await this.mcpToolService.listResources(slug);

    for (const resource of resources) {
      registerAppResource(
        server,
        resource.name,
        resource.uri,
        { mimeType: RESOURCE_MIME_TYPE },
        async () => {
          const content = await this.mcpToolService.readResource(slug, resource.uri);
          return {
            contents: [{
              uri: content.uri,
              mimeType: RESOURCE_MIME_TYPE,
              text: content.text,
            }],
          };
        },
      );
    }
  }

  private async registerActionTools(server: McpServer, slug: string): Promise<void> {
    // For each tool, find associated RegistryComponent nodes and their actions
    const app = await this.mcpToolService.getAppBySlug(slug);
    if (!app) return;

    const flows = app.flows ?? [];
    for (const flow of flows) {
      const nodes = flow.nodes ?? [];
      for (const node of nodes) {
        if (node.type !== 'RegistryComponent') continue;

        const params = node.parameters as { actions?: Array<{ name: string }>; toolName?: string };
        const actions = params.actions ?? [];
        if (actions.length === 0) continue;

        // Find which trigger this RegistryComponent belongs to
        const triggers = nodes.filter(n => n.type === 'UserIntent');
        for (const trigger of triggers) {
          const triggerParams = trigger.parameters as { toolName: string; isActive?: boolean };
          if (triggerParams.isActive === false) continue;

          for (const action of actions) {
            const actionToolName = `${triggerParams.toolName}__action__${action.name}`;

            server.registerTool(
              actionToolName,
              {
                title: `${action.name} action`,
                description: `Execute ${action.name} action on ${node.name}`,
                inputSchema: {
                  type: 'object' as const,
                  properties: {
                    data: { type: 'object' as const, description: 'Action data' },
                  },
                },
              },
              async (args: Record<string, unknown>) => {
                const result = await this.mcpToolService.executeAction(slug, {
                  toolName: triggerParams.toolName,
                  nodeId: node.id,
                  action: action.name,
                  data: (args.data as Record<string, unknown>) ?? {},
                });
                return result;
              },
            );
          }
        }
      }
    }
  }
}
