import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { FlowExecutionService } from '../flow-execution/flow-execution.service';
import type { McpToolResponse, LayoutTemplate, NodeInstance, InterfaceNodeParameters, ReturnNodeParameters, CallFlowNodeParameters, ApiCallNodeParameters, Connection, NodeExecutionData } from '@chatgpt-app-builder/shared';
import { ApiCallNode } from '@chatgpt-app-builder/nodes';

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
    private readonly flowRepository: Repository<FlowEntity>,
    private readonly flowExecutionService: FlowExecutionService
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
   * Get nodes connected to user-intent in topological order.
   * Only nodes reachable from user-intent (via connections) will be executed.
   * Uses BFS to traverse the connection graph and returns nodes in execution order.
   *
   * @param nodes - All nodes in the flow
   * @param connections - All connections in the flow
   * @returns Nodes connected to user-intent in topological (execution) order
   */
  private getConnectedNodes(
    nodes: NodeInstance[],
    connections: Connection[]
  ): NodeInstance[] {
    // Build adjacency list from connections
    const adjacencyList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Initialize all nodes
    for (const node of nodes) {
      adjacencyList.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    // Build graph from connections
    for (const conn of connections) {
      const targets = adjacencyList.get(conn.sourceNodeId);
      if (targets) {
        targets.push(conn.targetNodeId);
        inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) ?? 0) + 1);
      }
    }

    // Find UserIntent (trigger) node IDs
    const triggerNodeIds = new Set(
      nodes.filter(n => n.type === 'UserIntent').map(n => n.id)
    );

    // Find nodes directly connected from UserIntent trigger nodes
    const startNodeIds = connections
      .filter(conn => triggerNodeIds.has(conn.sourceNodeId))
      .map(conn => conn.targetNodeId);

    if (startNodeIds.length === 0) {
      // No connections from trigger nodes, return empty (nothing to execute)
      return [];
    }

    // BFS to find all reachable nodes from user-intent connections
    const reachable = new Set<string>(startNodeIds);
    const queue = [...startNodeIds];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacencyList.get(current) ?? [];

      for (const neighbor of neighbors) {
        if (!reachable.has(neighbor)) {
          reachable.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // Topological sort (Kahn's algorithm) on reachable nodes only
    // Start with nodes that have no incoming edges from reachable set
    const reachableInDegree = new Map<string, number>();
    for (const nodeId of reachable) {
      reachableInDegree.set(nodeId, 0);
    }

    for (const conn of connections) {
      if (reachable.has(conn.sourceNodeId) && reachable.has(conn.targetNodeId)) {
        reachableInDegree.set(
          conn.targetNodeId,
          (reachableInDegree.get(conn.targetNodeId) ?? 0) + 1
        );
      }
    }

    // Nodes directly from user-intent have effective in-degree 0 in our traversal
    const sortQueue: string[] = [];
    for (const nodeId of reachable) {
      if (reachableInDegree.get(nodeId) === 0) {
        sortQueue.push(nodeId);
      }
    }

    const sortedIds: string[] = [];
    while (sortQueue.length > 0) {
      const current = sortQueue.shift()!;
      sortedIds.push(current);

      const neighbors = adjacencyList.get(current) ?? [];
      for (const neighbor of neighbors) {
        if (reachable.has(neighbor)) {
          const newDegree = (reachableInDegree.get(neighbor) ?? 1) - 1;
          reachableInDegree.set(neighbor, newDegree);
          if (newDegree === 0) {
            sortQueue.push(neighbor);
          }
        }
      }
    }

    // Map sorted IDs back to node instances
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return sortedIds
      .map(id => nodeMap.get(id))
      .filter((n): n is NodeInstance => n !== undefined);
  }

  /**
   * Execute an MCP tool call for a published app's flow
   * Returns ChatGPT Apps SDK formatted response
   *
   * Uses flow.nodes and flow.connections to determine execution path:
   * - Only nodes connected to user-intent are executed
   * - Execution follows topological order based on connections
   * - Interface nodes: return structuredContent + widget metadata
   * - Return nodes: return text content array for LLM processing
   * - CallFlow nodes: trigger target flow
   *
   * Tracks execution in FlowExecution entity for history and debugging
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

    // Create execution record
    const execution = await this.flowExecutionService.createExecution({
      flowId: flow.id,
      flowName: flow.name,
      flowToolName: flow.toolName,
      initialParams: input,
    });

    const nodeExecutions: NodeExecutionData[] = [];

    try {
      const allNodes = flow.nodes ?? [];
      const connections = flow.connections ?? [];

      // Get only nodes connected to user-intent in execution order
      const connectedNodes = this.getConnectedNodes(allNodes, connections);

      // If no nodes are connected, fall back to legacy behavior (all nodes)
      // This maintains backward compatibility for flows without explicit connections
      const nodes = connectedNodes.length > 0 ? connectedNodes : allNodes;

      // Store outputs from executed nodes for chaining
      const nodeOutputs = new Map<string, unknown>();
      let result: McpToolResponse | null = null;

      // Execute nodes in topological order (as returned by getConnectedNodes)
      for (const node of nodes) {
        // Build input data from upstream node outputs
        const nodeInputData: Record<string, unknown> = { ...input };

        // Find connections where this node is the target to get upstream outputs
        for (const conn of connections) {
          if (conn.targetNodeId === node.id && nodeOutputs.has(conn.sourceNodeId)) {
            nodeInputData[conn.sourceNodeId] = nodeOutputs.get(conn.sourceNodeId);
          }
        }

        if (node.type === 'ApiCall') {
          const apiResult = await this.executeApiCallNode(flow.id, node, nodeOutputs);
          nodeOutputs.set(node.id, apiResult.output);
          nodeExecutions.push(this.createNodeExecution(
            node,
            nodeInputData,
            apiResult.output,
            apiResult.success ? 'completed' : 'error',
            apiResult.error
          ));

          // If this is the last node, use its output as result
          result = {
            content: [{ type: 'text', text: JSON.stringify(apiResult.output, null, 2) }],
            structuredContent: apiResult.output,
          };
        } else if (node.type === 'Return') {
          const params = node.parameters as ReturnNodeParameters;
          const returnOutput = { text: params.text };
          nodeOutputs.set(node.id, returnOutput);
          nodeExecutions.push(this.createNodeExecution(node, nodeInputData, returnOutput, 'completed'));
          result = {
            content: [{ type: 'text', text: params.text || '' }],
          };
        } else if (node.type === 'CallFlow') {
          result = await this.executeCallFlowNode(app, flow, node);
          nodeOutputs.set(node.id, result.structuredContent);
          nodeExecutions.push(this.createNodeExecution(node, nodeInputData, result.structuredContent, 'completed'));
        } else if (node.type === 'Interface') {
          result = this.executeInterfaceFlow(app, flow, node, input);
          const params = node.parameters as InterfaceNodeParameters;
          nodeOutputs.set(node.id, params.mockData);
          nodeExecutions.push(this.createNodeExecution(node, nodeInputData, params.mockData, 'completed'));
        }
      }

      if (!result) {
        throw new NotFoundException(`No connected nodes found for tool: ${toolName}`);
      }

      // Update execution as fulfilled
      await this.flowExecutionService.updateExecution(execution.id, {
        status: 'fulfilled',
        endedAt: new Date(),
        nodeExecutions,
      });

      return result;
    } catch (error) {
      // Update execution as error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const lastNode = nodeExecutions[nodeExecutions.length - 1];

      await this.flowExecutionService.updateExecution(execution.id, {
        status: 'error',
        endedAt: new Date(),
        nodeExecutions,
        errorInfo: {
          message: errorMessage,
          nodeId: lastNode?.nodeId,
          nodeName: lastNode?.nodeName,
        },
      });

      throw error;
    }
  }

  /**
   * Create a node execution record
   */
  private createNodeExecution(
    node: NodeInstance,
    input: Record<string, unknown>,
    output: unknown,
    status: 'pending' | 'completed' | 'error',
    error?: string
  ): NodeExecutionData {
    return {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      executedAt: new Date().toISOString(),
      inputData: input,
      outputData: output ?? {},
      status,
      error,
    };
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
   * Execute ApiCall node - make HTTP request to external API
   */
  private async executeApiCallNode(
    flowId: string,
    node: NodeInstance,
    nodeOutputs: Map<string, unknown>
  ): Promise<{ success: boolean; output?: unknown; error?: string }> {
    const params = node.parameters as ApiCallNodeParameters;

    // Create execution context for the ApiCall node
    const context = {
      flowId,
      nodeId: node.id,
      parameters: params,
      getNodeValue: async (nodeId: string): Promise<unknown> => {
        return nodeOutputs.get(nodeId);
      },
      callFlow: async (_targetFlowId: string, _params: Record<string, unknown>): Promise<unknown> => {
        // Not used by ApiCall nodes, but required by interface
        return null;
      },
    };

    try {
      const result = await ApiCallNode.execute(context);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
