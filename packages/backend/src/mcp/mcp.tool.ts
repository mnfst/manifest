import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import type { McpToolResponse, LayoutTemplate, NodeInstance, InterfaceNodeParameters, ReturnNodeParameters, CallFlowNodeParameters } from '@chatgpt-app-builder/shared';

/**
 * MCP protocol error for inactive tools
 * Error code -32602 is "Invalid params" per JSON-RPC 2.0 specification
 */
export class McpInactiveToolError extends BadRequestException {
  readonly code = -32602;

  constructor(toolName: string) {
    super({
      code: -32602,
      message: `Tool '${toolName}' is not active and cannot be executed`,
    });
  }
}

/**
 * Service for handling MCP tool calls for published apps
 * Implements ChatGPT Apps SDK response format
 * Each flow in an app becomes an MCP tool
 *
 * Updated to use new unified node architecture:
 * - Interface nodes (formerly Views) contain UI layouts
 * - Return nodes contain text content for LLM
 * - CallFlow nodes trigger other flows
 */
@Injectable()
export class McpToolService {
  constructor(
    @InjectRepository(AppEntity)
    private readonly appRepository: Repository<AppEntity>,
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>
  ) {}

  /**
   * Get app by slug (used for MCP server discovery)
   */
  async getAppBySlug(slug: string): Promise<AppEntity | null> {
    return this.appRepository.findOne({
      where: { slug, status: 'published' },
      relations: ['flows'],
    });
  }

  /**
   * Execute an MCP tool call for a published app's flow
   * Returns ChatGPT Apps SDK formatted response
   *
   * Uses flow.nodes to determine execution path:
   * - Interface nodes: return structuredContent + widget metadata
   * - Return nodes: return text content array for LLM processing
   * - CallFlow nodes: trigger target flow
   */
  async executeTool(
    appSlug: string,
    toolName: string,
    input: { message: string }
  ): Promise<McpToolResponse> {
    const app = await this.getAppBySlug(appSlug);
    if (!app) {
      throw new NotFoundException(`No published app found for slug: ${appSlug}`);
    }

    const flow = await this.flowRepository.findOne({
      where: { appId: app.id, toolName },
    });

    if (!flow) {
      throw new NotFoundException(`No tool found with name: ${toolName}`);
    }

    if (!flow.isActive) {
      throw new McpInactiveToolError(toolName);
    }

    const nodes = flow.nodes ?? [];

    // Get nodes by type
    const interfaceNodes = nodes.filter(n => n.type === 'Interface');
    const returnNodes = nodes.filter(n => n.type === 'Return');
    const callFlowNodes = nodes.filter(n => n.type === 'CallFlow');

    // Priority: Return nodes > CallFlow nodes > Interface nodes
    if (returnNodes.length > 0) {
      return this.executeReturnFlow(flow, returnNodes);
    }

    if (callFlowNodes.length > 0) {
      return this.executeCallFlowNode(app, flow, callFlowNodes[0]);
    }

    if (interfaceNodes.length > 0) {
      return this.executeInterfaceFlow(app, flow, interfaceNodes[0], input);
    }

    throw new NotFoundException(`No nodes found for tool: ${toolName}`);
  }

  /**
   * Execute Return nodes - return text content array for LLM
   */
  private executeReturnFlow(
    flow: FlowEntity,
    returnNodes: NodeInstance[]
  ): McpToolResponse {
    const content = returnNodes.map((node) => {
      const params = node.parameters as ReturnNodeParameters;
      return {
        type: 'text' as const,
        text: params.text || '',
      };
    });

    return { content };
  }

  /**
   * Execute CallFlow node - trigger target flow
   */
  private async executeCallFlowNode(
    app: AppEntity,
    flow: FlowEntity,
    callFlowNode: NodeInstance
  ): Promise<McpToolResponse> {
    const params = callFlowNode.parameters as CallFlowNodeParameters;

    if (!params.targetFlowId) {
      return {
        content: [{ type: 'text', text: 'Error: No target flow configured.' }],
      };
    }

    const targetFlow = await this.flowRepository.findOne({
      where: { id: params.targetFlowId },
    });

    if (!targetFlow) {
      return {
        content: [{ type: 'text', text: 'Error: Target flow not found.' }],
      };
    }

    return {
      structuredContent: {
        action: 'callFlow',
        targetToolName: targetFlow.toolName,
        targetFlowName: targetFlow.name,
      },
      content: [{ type: 'text', text: `Triggering ${targetFlow.name}...` }],
      _meta: {
        'openai/outputTemplate': `ui://widget/${app.slug}/${flow.toolName}-callflow.html`,
        'openai/widgetPrefersBorder': false,
        flowName: flow.name,
        toolName: flow.toolName,
        targetToolName: targetFlow.toolName,
      },
    };
  }

  /**
   * Execute Interface node - return widget with structured content
   */
  private executeInterfaceFlow(
    app: AppEntity,
    flow: FlowEntity,
    interfaceNode: NodeInstance,
    input: { message: string }
  ): McpToolResponse {
    const params = interfaceNode.parameters as InterfaceNodeParameters;
    const responseText = this.generateResponseText(flow.name, params.layoutTemplate, input.message);

    return {
      structuredContent: params.mockData,
      content: [{ type: 'text', text: responseText }],
      _meta: {
        'openai/outputTemplate': `ui://widget/${app.slug}/${flow.toolName}.html`,
        'openai/widgetPrefersBorder': true,
        flowName: flow.name,
        toolName: flow.toolName,
      },
    };
  }

  /**
   * List all tools available for an MCP server
   */
  async listTools(appSlug: string): Promise<{
    name: string;
    description: string;
    inputSchema: object;
  }[]> {
    const app = await this.getAppBySlug(appSlug);
    if (!app) return [];

    const flows = await this.flowRepository.find({
      where: { appId: app.id, isActive: true },
    });

    return flows.map((flow) => {
      const parts = [flow.toolDescription || `Execute the ${flow.name} flow`];
      if (flow.whenToUse) parts.push(`\nWHEN TO USE:\n${flow.whenToUse}`);
      if (flow.whenNotToUse) parts.push(`\nWHEN NOT TO USE:\n${flow.whenNotToUse}`);

      const nodes = flow.nodes ?? [];
      const hasInterface = nodes.some(n => n.type === 'Interface');
      const hasCallFlow = nodes.some(n => n.type === 'CallFlow');

      const toolDef: { name: string; description: string; inputSchema: object; _meta?: object } = {
        name: flow.toolName,
        description: parts.join(''),
        inputSchema: {
          type: 'object',
          properties: { message: { type: 'string', description: 'User query or request' } },
          required: ['message'],
        },
      };

      if (hasInterface) {
        toolDef._meta = {
          'openai/outputTemplate': `ui://widget/${appSlug}/${flow.toolName}.html`,
          'openai/toolInvocation/invoking': `Loading ${flow.name}...`,
          'openai/toolInvocation/invoked': `Loaded ${flow.name}`,
        };
      } else if (hasCallFlow) {
        toolDef._meta = {
          'openai/outputTemplate': `ui://widget/${appSlug}/${flow.toolName}-callflow.html`,
          'openai/toolInvocation/invoking': `Triggering ${flow.name}...`,
          'openai/toolInvocation/invoked': `Triggered ${flow.name}`,
        };
      }

      return toolDef;
    });
  }

  /**
   * List all UI resources for an app
   */
  async listResources(appSlug: string): Promise<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
  }[]> {
    const app = await this.getAppBySlug(appSlug);
    if (!app) return [];

    const flows = await this.flowRepository.find({
      where: { appId: app.id, isActive: true },
    });

    const resources: { uri: string; name: string; description: string; mimeType: string }[] = [];

    for (const flow of flows) {
      const nodes = flow.nodes ?? [];
      const hasInterface = nodes.some(n => n.type === 'Interface');
      const hasCallFlow = nodes.some(n => n.type === 'CallFlow');

      if (hasInterface) {
        resources.push({
          uri: `ui://widget/${appSlug}/${flow.toolName}.html`,
          name: `${flow.name} Widget`,
          description: `UI widget for ${flow.toolName}`,
          mimeType: 'text/html+skybridge',
        });
      } else if (hasCallFlow) {
        resources.push({
          uri: `ui://widget/${appSlug}/${flow.toolName}-callflow.html`,
          name: `${flow.name} Call Flow Widget`,
          description: `Call flow trigger widget for ${flow.toolName}`,
          mimeType: 'text/html+skybridge',
        });
      }
    }

    return resources;
  }

  /**
   * Read a UI resource and return its HTML content
   */
  async readResource(appSlug: string, uri: string): Promise<{
    uri: string;
    mimeType: string;
    text: string;
  }> {
    const app = await this.getAppBySlug(appSlug);
    if (!app) {
      throw new NotFoundException(`No published app found for slug: ${appSlug}`);
    }

    const callFlowMatch = uri.match(/^ui:\/\/widget\/([^/]+)\/([^-]+)-callflow\.html$/);
    const viewMatch = uri.match(/^ui:\/\/widget\/([^/]+)\/([^.]+)\.html$/);

    if (callFlowMatch && callFlowMatch[1] === appSlug) {
      const toolName = callFlowMatch[2];
      const flow = await this.flowRepository.findOne({
        where: { appId: app.id, toolName, isActive: true },
      });

      if (!flow) throw new NotFoundException(`No active flow found for tool: ${toolName}`);

      const nodes = flow.nodes ?? [];
      const callFlowNode = nodes.find(n => n.type === 'CallFlow');

      if (!callFlowNode) throw new NotFoundException(`No call flow node found for tool: ${toolName}`);

      const params = callFlowNode.parameters as CallFlowNodeParameters;
      let targetFlowName = 'Target Flow';
      let targetToolName = 'target_tool';

      if (params.targetFlowId) {
        const targetFlow = await this.flowRepository.findOne({ where: { id: params.targetFlowId } });
        if (targetFlow) {
          targetFlowName = targetFlow.name;
          targetToolName = targetFlow.toolName;
        }
      }

      const widgetHtml = this.generateCallFlowWidgetHtml(flow.name, targetToolName, targetFlowName);
      return { uri, mimeType: 'text/html+skybridge', text: widgetHtml };
    } else if (viewMatch && viewMatch[1] === appSlug) {
      const toolName = viewMatch[2];
      const flow = await this.flowRepository.findOne({
        where: { appId: app.id, toolName, isActive: true },
      });

      if (!flow) throw new NotFoundException(`No active flow found for tool: ${toolName}`);

      const nodes = flow.nodes ?? [];
      const interfaceNode = nodes.find(n => n.type === 'Interface');

      if (!interfaceNode) throw new NotFoundException(`No interface node found for tool: ${toolName}`);

      const params = interfaceNode.parameters as InterfaceNodeParameters;
      const widgetHtml = this.generateWidgetHtml(flow.name, params.layoutTemplate, app.themeVariables);

      return { uri, mimeType: 'text/html+skybridge', text: widgetHtml };
    }

    throw new NotFoundException(`Invalid resource URI: ${uri}`);
  }

  /**
   * Generate widget HTML with ChatGPT Apps SDK bridge
   */
  private generateWidgetHtml(
    flowName: string,
    layoutTemplate: LayoutTemplate,
    themeVariables: Record<string, string>
  ): string {
    const cssVariables = Object.entries(themeVariables)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value};`)
      .join('\n      ');

    if (layoutTemplate === 'table') {
      return this.generateTableWidgetHtml(flowName, cssVariables);
    } else {
      return this.generatePostListWidgetHtml(flowName, cssVariables);
    }
  }

  private generateTableWidgetHtml(flowName: string, cssVariables: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${flowName}</title>
  <style>
    :root { ${cssVariables} }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: transparent; color: var(--text-color, #1a1a2e); padding: 12px; }
    .table-container { overflow-x: auto; border-radius: 8px; border: 1px solid #e5e5e5; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f5f5f5; font-weight: 500; text-align: left; padding: 12px 16px; font-size: 14px; }
    td { padding: 12px 16px; font-size: 14px; border-top: 1px solid #e5e5e5; }
    .loading { text-align: center; padding: 40px; color: #666; }
  </style>
</head>
<body>
  <div id="root">
    <div id="loading" class="loading">Loading...</div>
    <div class="table-container" id="table-container" style="display: none;">
      <table id="data-table"><thead><tr id="header-row"></tr></thead><tbody id="body-rows"></tbody></table>
    </div>
  </div>
  <script>
    (function() {
      function getToolData() { return window.openai && window.openai.toolOutput ? window.openai.toolOutput : null; }
      function initWidget() { var data = getToolData(); if (data) renderTable(data); }
      window.addEventListener('openai:set_globals', function(e) { if (e.detail && e.detail.toolOutput) renderTable(e.detail.toolOutput); });
      window.addEventListener('message', function(e) { if (e.data) renderTable(e.data.structuredContent || e.data); });
      function renderTable(data) {
        if (!data || !data.columns || !data.rows) return;
        document.getElementById('loading').style.display = 'none';
        document.getElementById('table-container').style.display = 'block';
        document.getElementById('header-row').innerHTML = data.columns.map(function(c) { return '<th>' + c.header + '</th>'; }).join('');
        document.getElementById('body-rows').innerHTML = data.rows.map(function(r) { return '<tr>' + data.columns.map(function(c) { return '<td>' + (r[c.key] || '') + '</td>'; }).join('') + '</tr>'; }).join('');
      }
      if (document.readyState === 'complete') initWidget(); else window.addEventListener('DOMContentLoaded', initWidget);
    })();
  </script>
</body>
</html>`;
  }

  private generatePostListWidgetHtml(flowName: string, cssVariables: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${flowName}</title>
  <style>
    :root { ${cssVariables} }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: transparent; padding: 12px; }
    .posts-container { display: flex; flex-direction: column; gap: 16px; }
    .post-card { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; }
    .post-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    .post-excerpt { font-size: 12px; color: #666; }
    .loading { text-align: center; padding: 40px; color: #666; }
  </style>
</head>
<body>
  <div id="root">
    <div id="loading" class="loading">Loading...</div>
    <div id="posts-container" class="posts-container" style="display: none;"></div>
  </div>
  <script>
    (function() {
      function getToolData() { return window.openai && window.openai.toolOutput ? window.openai.toolOutput : null; }
      function initWidget() { var data = getToolData(); if (data) renderPosts(data); }
      window.addEventListener('openai:set_globals', function(e) { if (e.detail && e.detail.toolOutput) renderPosts(e.detail.toolOutput); });
      window.addEventListener('message', function(e) { if (e.data) renderPosts(e.data.structuredContent || e.data); });
      function renderPosts(data) {
        var posts = data.posts || [];
        if (posts.length === 0) { document.getElementById('loading').textContent = 'No posts'; return; }
        document.getElementById('loading').style.display = 'none';
        var c = document.getElementById('posts-container'); c.style.display = 'flex';
        c.innerHTML = posts.map(function(p) { return '<div class="post-card"><div class="post-title">' + (p.title || '') + '</div><div class="post-excerpt">' + (p.excerpt || '') + '</div></div>'; }).join('');
      }
      if (document.readyState === 'complete') initWidget(); else window.addEventListener('DOMContentLoaded', initWidget);
    })();
  </script>
</body>
</html>`;
  }

  private generateCallFlowWidgetHtml(flowName: string, targetToolName: string, targetFlowName: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${flowName} - Call Flow</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: transparent; padding: 12px; }
    .status { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #666; }
    .spinner { width: 16px; height: 16px; border: 2px solid #e5e5e5; border-top-color: #10a37f; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="status"><div class="spinner"></div><span>Triggering ${targetFlowName}...</span></div>
  <script>
    (function() {
      var triggered = false;
      function triggerFlow() {
        if (triggered) return; triggered = true;
        if (window.openai && window.openai.callTool) {
          window.openai.callTool('${targetToolName}', { message: 'Triggered from call flow' });
        }
      }
      window.addEventListener('openai:set_globals', triggerFlow);
      if (document.readyState === 'complete') triggerFlow(); else window.addEventListener('DOMContentLoaded', triggerFlow);
    })();
  </script>
</body>
</html>`;
  }

  private generateResponseText(flowName: string, layoutTemplate: LayoutTemplate, _message: string): string {
    return layoutTemplate === 'table' ? `Here are the results from ${flowName}:` : `Here's the content from ${flowName}:`;
  }
}
