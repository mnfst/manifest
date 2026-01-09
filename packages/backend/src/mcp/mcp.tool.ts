import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { FlowExecutionService } from '../flow-execution/flow-execution.service';
import type { McpToolResponse, LayoutTemplate, NodeInstance, StatCardNodeParameters, ReturnNodeParameters, CallFlowNodeParameters, ApiCallNodeParameters, Connection, NodeExecutionData, UserIntentNodeParameters, JavaScriptCodeTransformParameters, ExecuteActionRequest } from '@chatgpt-app-builder/shared';
import { ApiCallNode, JavaScriptCodeTransform } from '@chatgpt-app-builder/nodes';

/**
 * Resolves template variables in a string using upstream node outputs.
 * Template syntax: {{ nodeSlug.path }} where path can be dot-notation like 'data.userId'
 * Supports both slug-based and ID-based lookups.
 *
 * @param template - String containing template variables
 * @param nodeOutputs - Map of nodeId to output data
 * @param allNodes - All nodes in the flow (for slug-to-id resolution)
 * @returns Resolved string with actual values
 */
function resolveTemplateVariables(
  template: string,
  nodeOutputs: Map<string, unknown>,
  allNodes: NodeInstance[]
): string {
  if (!template) return template;

  // Build slug-to-id map
  const slugToId = new Map<string, string>();
  for (const node of allNodes) {
    if (node.slug) {
      slugToId.set(node.slug, node.id);
    }
  }

  const templatePattern = /\{\{\s*([^}]+)\s*\}\}/g;

  return template.replace(templatePattern, (_fullMatch, pathStr) => {
    const path = pathStr.trim();
    const parts = path.split('.');
    const slugOrId = parts[0];
    const pathParts = parts.slice(1);

    // Try slug first, then ID
    const nodeId = slugToId.get(slugOrId) || slugOrId;
    let value = nodeOutputs.get(nodeId);

    // Navigate nested path
    for (const part of pathParts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }

    // Return the resolved value, or empty string if not found
    if (value === undefined || value === null) {
      return '';
    }
    // If it's an object or array, stringify it
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

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
 * - StatCard nodes contain UI layouts for displaying statistics
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
   * Find a trigger node by its toolName across all flows in an app.
   * Returns the trigger node and its parent flow.
   *
   * @param appId - The app ID to search in
   * @param toolName - The toolName to find
   * @returns The trigger node and its flow, or null if not found
   */
  private async findTriggerByToolName(
    appId: string,
    toolName: string
  ): Promise<{ trigger: NodeInstance; flow: FlowEntity } | null> {
    const flows = await this.flowRepository.find({
      where: { appId, isActive: true },
    });

    for (const flow of flows) {
      const nodes = flow.nodes ?? [];
      for (const node of nodes) {
        if (node.type === 'UserIntent') {
          const params = node.parameters as UserIntentNodeParameters;
          if (params.toolName === toolName) {
            return { trigger: node, flow };
          }
        }
      }
    }

    return null;
  }

  /**
   * Get nodes reachable from a specific trigger node in topological order.
   * Only nodes reachable from the specified trigger (via connections) will be executed.
   * Uses BFS to traverse the connection graph and returns nodes in execution order.
   *
   * @param nodes - All nodes in the flow
   * @param connections - All connections in the flow
   * @param triggerNodeId - The specific trigger node ID to start from
   * @returns Nodes connected to the trigger in topological (execution) order
   */
  private getNodesReachableFrom(
    nodes: NodeInstance[],
    connections: Connection[],
    triggerNodeId: string
  ): NodeInstance[] {
    // Build adjacency list from connections, EXCLUDING action handles
    // Action handles (sourceHandle starting with 'action:') create conditional paths
    // that only execute when the action is triggered, not during initial execution
    const adjacencyList = new Map<string, string[]>();

    // Initialize all nodes
    for (const node of nodes) {
      adjacencyList.set(node.id, []);
    }

    // Build graph from connections, excluding action handles
    for (const conn of connections) {
      // Skip connections from action handles - these are conditional paths
      if (conn.sourceHandle.startsWith('action:')) {
        continue;
      }
      const targets = adjacencyList.get(conn.sourceNodeId);
      if (targets) {
        targets.push(conn.targetNodeId);
      }
    }

    // Find nodes directly connected from the specific trigger node (non-action connections only)
    const startNodeIds = connections
      .filter(conn => conn.sourceNodeId === triggerNodeId && !conn.sourceHandle.startsWith('action:'))
      .map(conn => conn.targetNodeId);

    if (startNodeIds.length === 0) {
      // No connections from this trigger node, return empty (nothing to execute)
      return [];
    }

    // BFS to find all reachable nodes from this trigger
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
    // Exclude action handle connections from in-degree calculation
    const reachableInDegree = new Map<string, number>();
    for (const nodeId of reachable) {
      reachableInDegree.set(nodeId, 0);
    }

    for (const conn of connections) {
      // Skip action handle connections in topological sort
      if (conn.sourceHandle.startsWith('action:')) {
        continue;
      }
      if (reachable.has(conn.sourceNodeId) && reachable.has(conn.targetNodeId)) {
        reachableInDegree.set(
          conn.targetNodeId,
          (reachableInDegree.get(conn.targetNodeId) ?? 0) + 1
        );
      }
    }

    // Nodes directly from trigger have effective in-degree 0 in our traversal
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
   * Finds the trigger node by toolName and executes nodes reachable from it:
   * - Only nodes connected to the specific trigger are executed
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
    input: Record<string, unknown>
  ): Promise<McpToolResponse> {
    const app = await this.getAppBySlug(appSlug);
    if (!app) {
      throw new NotFoundException(`No published app found for slug: ${appSlug}`);
    }

    // Find the trigger node by toolName
    const triggerResult = await this.findTriggerByToolName(app.id, toolName);

    if (!triggerResult) {
      throw new NotFoundException(`No tool found with name: ${toolName}`);
    }

    const { trigger, flow } = triggerResult;
    const triggerParams = trigger.parameters as UserIntentNodeParameters;

    // Check if trigger is active
    if (triggerParams.isActive === false) {
      throw new McpInactiveToolError(toolName);
    }

    // Validate input against trigger's parameter schema
    const validatedInput = this.validateTriggerInput(triggerParams, input);

    // Create execution record
    const execution = await this.flowExecutionService.createExecution({
      flowId: flow.id,
      flowName: flow.name,
      flowToolName: toolName, // Use trigger's toolName
      initialParams: validatedInput,
    });

    const nodeExecutions: NodeExecutionData[] = [];

    // Add the trigger node as the first execution entry
    nodeExecutions.push(this.createNodeExecution(
      trigger,
      {}, // Trigger has no input from other nodes
      validatedInput, // Output is the validated input parameters
      'completed'
    ));

    try {
      const allNodes = flow.nodes ?? [];
      const connections = flow.connections ?? [];

      // Get only nodes reachable from this specific trigger
      const nodes = this.getNodesReachableFrom(allNodes, connections, trigger.id);

      // If no nodes are connected to this trigger, return a message indicating so
      if (nodes.length === 0) {
        await this.flowExecutionService.updateExecution(execution.id, {
          status: 'fulfilled',
          endedAt: new Date(),
          nodeExecutions,
        });

        return {
          content: [{ type: 'text', text: `Trigger "${trigger.name}" is not connected to any nodes.` }],
        };
      }

      // Store outputs from executed nodes for chaining
      const nodeOutputs = new Map<string, unknown>();

      // Store the trigger node's output (validated input parameters)
      // This allows downstream nodes to reference trigger params like {{ trigger.pokemonName }}
      nodeOutputs.set(trigger.id, validatedInput);

      let result: McpToolResponse | null = null;

      // Execute nodes in topological order (as returned by getNodesReachableFrom)
      for (const node of nodes) {
        // Build input data from upstream node outputs, starting with validated trigger input
        const nodeInputData: Record<string, unknown> = { ...validatedInput };

        // Find connections where this node is the target to get upstream outputs
        for (const conn of connections) {
          if (conn.targetNodeId === node.id && nodeOutputs.has(conn.sourceNodeId)) {
            nodeInputData[conn.sourceNodeId] = nodeOutputs.get(conn.sourceNodeId);
          }
        }

        if (node.type === 'ApiCall') {
          const apiResult = await this.executeApiCallNode(flow.id, node, nodeOutputs, allNodes);
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
          // Resolve template variables in the return text
          const resolvedText = resolveTemplateVariables(params.text || '', nodeOutputs, allNodes);
          const returnOutput = { text: resolvedText };
          nodeOutputs.set(node.id, returnOutput);
          nodeExecutions.push(this.createNodeExecution(node, nodeInputData, returnOutput, 'completed'));
          result = {
            content: [{ type: 'text', text: resolvedText }],
          };
        } else if (node.type === 'CallFlow') {
          result = await this.executeCallFlowNode(app, toolName, trigger.name, node);
          nodeOutputs.set(node.id, result.structuredContent);
          nodeExecutions.push(this.createNodeExecution(node, nodeInputData, result.structuredContent, 'completed'));
        } else if (node.type === 'StatCard') {
          result = this.executeStatCardFlow(app, toolName, trigger.name, node, nodeInputData);
          // StatCard nodes output their structured content (populated from upstream data)
          const structuredContent = result.structuredContent || {};
          nodeOutputs.set(node.id, structuredContent);
          nodeExecutions.push(this.createNodeExecution(node, nodeInputData, structuredContent, 'completed'));
        } else if (node.type === 'PostList') {
          result = this.executePostListFlow(app, toolName, trigger.name, node, nodeInputData);
          // PostList nodes output their structured content with action metadata
          const structuredContent = result.structuredContent || {};
          nodeOutputs.set(node.id, structuredContent);
          nodeExecutions.push(this.createNodeExecution(node, nodeInputData, structuredContent, 'completed'));
        } else if (node.type === 'JavaScriptCodeTransform') {
          // Execute JavaScript transform node
          const transformResult = await this.executeTransformNode(flow.id, node, nodeOutputs, allNodes, connections);
          nodeOutputs.set(node.id, transformResult.output);
          nodeExecutions.push(this.createNodeExecution(
            node,
            nodeInputData,
            transformResult.output,
            transformResult.success ? 'completed' : 'error',
            transformResult.error
          ));

          // If transform failed, we still continue to allow downstream handling
          if (!transformResult.success) {
            result = {
              content: [{ type: 'text', text: `Transform error: ${transformResult.error}` }],
            };
          } else {
            // Transform nodes pass through - result will be set by downstream terminal node
            result = {
              content: [{ type: 'text', text: JSON.stringify(transformResult.output, null, 2) }],
              structuredContent: transformResult.output,
            };
          }
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
    triggerToolName: string,
    triggerName: string,
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

    // Get the first active trigger's toolName from target flow
    const targetNodes = targetFlow.nodes ?? [];
    const targetTrigger = targetNodes.find(n => {
      if (n.type === 'UserIntent') {
        const tp = n.parameters as UserIntentNodeParameters;
        return tp.isActive !== false;
      }
      return false;
    });

    let targetToolName = 'target_tool';
    if (targetTrigger) {
      const targetParams = targetTrigger.parameters as UserIntentNodeParameters;
      targetToolName = targetParams.toolName;
    }

    return {
      structuredContent: {
        action: 'callFlow',
        targetToolName,
        targetFlowName: targetFlow.name,
      },
      content: [{ type: 'text', text: `Triggering ${targetFlow.name}...` }],
      _meta: {
        'openai/outputTemplate': `ui://widget/${app.slug}/${triggerToolName}-callflow.html`,
        'openai/widgetPrefersBorder': false,
        flowName: triggerName,
        toolName: triggerToolName,
        targetToolName,
      },
    };
  }

  /**
   * Execute ApiCall node - make HTTP request to external API
   * Supports both slug-based and UUID-based template variable resolution.
   */
  private async executeApiCallNode(
    flowId: string,
    node: NodeInstance,
    nodeOutputs: Map<string, unknown>,
    allNodes: NodeInstance[]
  ): Promise<{ success: boolean; output?: unknown; error?: string }> {
    const params = node.parameters as ApiCallNodeParameters;

    // Build slug-to-id map for template resolution
    const slugToId = new Map<string, string>();
    for (const n of allNodes) {
      if (n.slug) {
        slugToId.set(n.slug, n.id);
      }
    }

    // Create execution context for the ApiCall node
    const context = {
      flowId,
      nodeId: node.id,
      parameters: params,
      getNodeValue: async (slugOrId: string): Promise<unknown> => {
        // Try slug first (new behavior)
        const nodeIdFromSlug = slugToId.get(slugOrId);
        if (nodeIdFromSlug) {
          return nodeOutputs.get(nodeIdFromSlug);
        }
        // Fall back to ID lookup (backward compatibility)
        return nodeOutputs.get(slugOrId);
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
   * Execute JavaScriptCodeTransform node - transform data using user-defined JS code
   */
  private async executeTransformNode(
    flowId: string,
    node: NodeInstance,
    nodeOutputs: Map<string, unknown>,
    allNodes: NodeInstance[],
    connections: Connection[]
  ): Promise<{ success: boolean; output?: unknown; error?: string }> {
    const params = node.parameters as JavaScriptCodeTransformParameters;

    // Build slug-to-id map for value resolution
    const slugToId = new Map<string, string>();
    for (const n of allNodes) {
      if (n.slug) {
        slugToId.set(n.slug, n.id);
      }
    }

    // Find ALL upstream nodes connected to this transform node
    const incomingConnections = connections.filter(c => c.targetNodeId === node.id);

    // Build an object with all predecessor outputs keyed by their slug
    const upstreamOutput: Record<string, unknown> = {};
    for (const conn of incomingConnections) {
      const sourceNode = allNodes.find(n => n.id === conn.sourceNodeId);
      if (sourceNode) {
        const slug = sourceNode.slug || sourceNode.id;
        upstreamOutput[slug] = nodeOutputs.get(conn.sourceNodeId) || {};
      }
    }

    // Create execution context for the Transform node
    const context = {
      flowId,
      nodeId: node.id,
      parameters: params,
      getNodeValue: async (slugOrId: string): Promise<unknown> => {
        // Special case: 'main' or 'input' returns the upstream connected node's output
        if (slugOrId === 'main' || slugOrId === 'input') {
          return upstreamOutput;
        }
        // Try slug first (new behavior)
        const nodeIdFromSlug = slugToId.get(slugOrId);
        if (nodeIdFromSlug) {
          return nodeOutputs.get(nodeIdFromSlug);
        }
        // Fall back to ID lookup (backward compatibility)
        return nodeOutputs.get(slugOrId);
      },
      callFlow: async (_targetFlowId: string, _params: Record<string, unknown>): Promise<unknown> => {
        // Not used by Transform nodes, but required by interface
        return null;
      },
    };

    try {
      const result = await JavaScriptCodeTransform.execute(context);
      // The transform node spreads data at root with _execution metadata
      const transformOutput = result.output as Record<string, unknown> & { _execution?: { success: boolean; error?: string } };
      if (transformOutput?._execution?.success) {
        return { success: true, output: transformOutput };
      } else {
        return { success: false, output: undefined, error: transformOutput?._execution?.error || result.error };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute StatCard node - return widget with structured content
   */
  private executeStatCardFlow(
    app: AppEntity,
    triggerToolName: string,
    triggerName: string,
    statCardNode: NodeInstance,
    input: Record<string, unknown>
  ): McpToolResponse {
    const params = statCardNode.parameters as StatCardNodeParameters;
    const message = typeof input.message === 'string' ? input.message : '';
    const responseText = this.generateResponseText(triggerName, params.layoutTemplate, message);

    // Extract stats from upstream node outputs (nested under source node ID)
    // or from top-level if directly provided
    let stats: unknown[] = [];
    if (Array.isArray(input.stats)) {
      stats = input.stats;
    } else {
      for (const key of Object.keys(input)) {
        const value = input[key];
        if (value && typeof value === 'object' && 'stats' in value) {
          stats = (value as { stats: unknown[] }).stats;
          break;
        }
      }
    }

    return {
      structuredContent: { stats },
      content: [{ type: 'text', text: responseText }],
      _meta: {
        'openai/outputTemplate': `ui://widget/${app.slug}/${triggerToolName}.html`,
        'openai/widgetPrefersBorder': true,
        flowName: triggerName,
        toolName: triggerToolName,
      },
    };
  }

  /**
   * Execute PostList node - return widget with structured content and action metadata
   */
  private executePostListFlow(
    app: AppEntity,
    triggerToolName: string,
    triggerName: string,
    postListNode: NodeInstance,
    input: Record<string, unknown>
  ): McpToolResponse {
    // PostList uses post-list layout template
    const responseText = `Here are the posts from ${triggerName}:`;

    return {
      structuredContent: {
        posts: input.posts || [],
        nodeId: postListNode.id,
        actions: ['onReadMore'],
      },
      content: [{ type: 'text', text: responseText }],
      _meta: {
        'openai/outputTemplate': `ui://widget/${app.slug}/${triggerToolName}.html`,
        'openai/widgetPrefersBorder': true,
        flowName: triggerName,
        toolName: triggerToolName,
        nodeId: postListNode.id,
        availableActions: ['onReadMore'],
      },
    };
  }

  /**
   * Get nodes connected to a specific action handle of a source node.
   * Action handles are identified by sourceHandle starting with 'action:'.
   *
   * @param nodes - All nodes in the flow
   * @param connections - All connections in the flow
   * @param sourceNodeId - The node ID that has the action handle
   * @param actionName - The action name (e.g., 'onReadMore')
   * @returns Nodes connected to the action handle in topological order
   */
  private getNodesFromActionHandle(
    nodes: NodeInstance[],
    connections: Connection[],
    sourceNodeId: string,
    actionName: string
  ): NodeInstance[] {
    const actionHandle = `action:${actionName}`;

    // Find nodes directly connected from the action handle
    const startNodeIds = connections
      .filter(conn => conn.sourceNodeId === sourceNodeId && conn.sourceHandle === actionHandle)
      .map(conn => conn.targetNodeId);

    if (startNodeIds.length === 0) {
      return [];
    }

    // Build adjacency list from connections (excluding action handles for traversal)
    const adjacencyList = new Map<string, string[]>();
    for (const node of nodes) {
      adjacencyList.set(node.id, []);
    }

    for (const conn of connections) {
      // Include all non-action connections for graph traversal
      if (!conn.sourceHandle.startsWith('action:')) {
        const targets = adjacencyList.get(conn.sourceNodeId);
        if (targets) {
          targets.push(conn.targetNodeId);
        }
      }
    }

    // BFS to find all reachable nodes from action handle targets
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

    // Topological sort on reachable nodes
    const reachableInDegree = new Map<string, number>();
    for (const nodeId of reachable) {
      reachableInDegree.set(nodeId, 0);
    }

    for (const conn of connections) {
      if (reachable.has(conn.sourceNodeId) && reachable.has(conn.targetNodeId)) {
        if (!conn.sourceHandle.startsWith('action:')) {
          reachableInDegree.set(
            conn.targetNodeId,
            (reachableInDegree.get(conn.targetNodeId) ?? 0) + 1
          );
        }
      }
    }

    // Nodes directly from action handle have in-degree 0
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
   * Execute a UI node action callback.
   * Called when a user interacts with a UI component action (e.g., clicks "Read More" on a post).
   * Finds downstream nodes connected to the action handle and executes them with the action data.
   */
  async executeAction(
    appSlug: string,
    request: ExecuteActionRequest
  ): Promise<McpToolResponse> {
    const app = await this.getAppBySlug(appSlug);
    if (!app) {
      throw new NotFoundException(`No published app found for slug: ${appSlug}`);
    }

    const { toolName, nodeId, action, data } = request;

    // Find the trigger and flow
    const triggerResult = await this.findTriggerByToolName(app.id, toolName);
    if (!triggerResult) {
      throw new NotFoundException(`No tool found with name: ${toolName}`);
    }

    const { flow } = triggerResult;
    const allNodes = flow.nodes ?? [];
    const connections = flow.connections ?? [];

    // Verify the node exists and is a UI node with actions
    const sourceNode = allNodes.find(n => n.id === nodeId);
    if (!sourceNode) {
      throw new NotFoundException(`Node not found: ${nodeId}`);
    }

    // Get nodes connected to the action handle
    const actionNodes = this.getNodesFromActionHandle(allNodes, connections, nodeId, action);

    if (actionNodes.length === 0) {
      return {
        content: [{ type: 'text', text: `Action "${action}" has no connected nodes.` }],
      };
    }

    // Create execution record
    const execution = await this.flowExecutionService.createExecution({
      flowId: flow.id,
      flowName: flow.name,
      flowToolName: `${toolName}:${action}`,
      initialParams: data,
    });

    const nodeExecutions: NodeExecutionData[] = [];

    // Store the action data as the source node's output
    const nodeOutputs = new Map<string, unknown>();
    nodeOutputs.set(nodeId, data);

    let result: McpToolResponse | null = null;

    try {
      // Execute nodes connected to the action handle
      for (const node of actionNodes) {
        const nodeInputData: Record<string, unknown> = { ...data };

        // Get upstream outputs for this node
        for (const conn of connections) {
          if (conn.targetNodeId === node.id && nodeOutputs.has(conn.sourceNodeId)) {
            nodeInputData[conn.sourceNodeId] = nodeOutputs.get(conn.sourceNodeId);
          }
        }

        if (node.type === 'Return') {
          const params = node.parameters as ReturnNodeParameters;
          const resolvedText = resolveTemplateVariables(params.text || '', nodeOutputs, allNodes);
          const returnOutput = { text: resolvedText };
          nodeOutputs.set(node.id, returnOutput);
          nodeExecutions.push(this.createNodeExecution(node, nodeInputData, returnOutput, 'completed'));
          result = {
            content: [{ type: 'text', text: resolvedText }],
          };
        } else if (node.type === 'ApiCall') {
          const apiResult = await this.executeApiCallNode(flow.id, node, nodeOutputs, allNodes);
          nodeOutputs.set(node.id, apiResult.output);
          nodeExecutions.push(this.createNodeExecution(
            node,
            nodeInputData,
            apiResult.output,
            apiResult.success ? 'completed' : 'error',
            apiResult.error
          ));
          result = {
            content: [{ type: 'text', text: JSON.stringify(apiResult.output, null, 2) }],
            structuredContent: apiResult.output,
          };
        } else if (node.type === 'JavaScriptCodeTransform') {
          const transformResult = await this.executeTransformNode(flow.id, node, nodeOutputs, allNodes, connections);
          nodeOutputs.set(node.id, transformResult.output);
          nodeExecutions.push(this.createNodeExecution(
            node,
            nodeInputData,
            transformResult.output,
            transformResult.success ? 'completed' : 'error',
            transformResult.error
          ));
          if (!transformResult.success) {
            result = {
              content: [{ type: 'text', text: `Transform error: ${transformResult.error}` }],
            };
          } else {
            result = {
              content: [{ type: 'text', text: JSON.stringify(transformResult.output, null, 2) }],
              structuredContent: transformResult.output,
            };
          }
        }
      }

      if (!result) {
        result = {
          content: [{ type: 'text', text: 'Action executed but no output produced.' }],
        };
      }

      // Update execution as fulfilled
      await this.flowExecutionService.updateExecution(execution.id, {
        status: 'fulfilled',
        endedAt: new Date(),
        nodeExecutions,
      });

      return result;
    } catch (error) {
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
   * List all tools available for an MCP server.
   * Each active UserIntent trigger node becomes an MCP tool.
   * Tools are derived from trigger nodes, not flows.
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

    const tools: { name: string; description: string; inputSchema: object; _meta?: object }[] = [];

    for (const flow of flows) {
      const nodes = flow.nodes ?? [];
      const triggerNodes = nodes.filter(n => n.type === 'UserIntent');
      const hasStatCard = nodes.some(n => n.type === 'StatCard');
      const hasCallFlow = nodes.some(n => n.type === 'CallFlow');

      for (const triggerNode of triggerNodes) {
        const params = triggerNode.parameters as UserIntentNodeParameters;

        // Skip inactive triggers
        if (params.isActive === false) {
          continue;
        }

        // Build description from trigger node parameters
        const parts = [params.toolDescription || `Execute the ${triggerNode.name} trigger`];
        if (params.whenToUse) parts.push(`\nWHEN TO USE:\n${params.whenToUse}`);
        if (params.whenNotToUse) parts.push(`\nWHEN NOT TO USE:\n${params.whenNotToUse}`);

        // Build input schema from trigger parameters
        const inputSchema = this.buildInputSchema(params);

        const toolDef: { name: string; description: string; inputSchema: object; _meta?: object } = {
          name: params.toolName,
          description: parts.join(''),
          inputSchema,
        };

        if (hasStatCard) {
          toolDef._meta = {
            'openai/outputTemplate': `ui://widget/${appSlug}/${params.toolName}.html`,
            'openai/toolInvocation/invoking': `Loading ${triggerNode.name}...`,
            'openai/toolInvocation/invoked': `Loaded ${triggerNode.name}`,
          };
        } else if (hasCallFlow) {
          toolDef._meta = {
            'openai/outputTemplate': `ui://widget/${appSlug}/${params.toolName}-callflow.html`,
            'openai/toolInvocation/invoking': `Triggering ${triggerNode.name}...`,
            'openai/toolInvocation/invoked': `Triggered ${triggerNode.name}`,
          };
        }

        tools.push(toolDef);
      }
    }

    return tools;
  }

  /**
   * Build JSON Schema for tool input from trigger parameters.
   * If trigger has no parameters defined, defaults to simple message input.
   */
  private buildInputSchema(params: UserIntentNodeParameters): object {
    const triggerParams = params.parameters ?? [];

    if (triggerParams.length === 0) {
      // Default schema with just message
      return {
        type: 'object',
        properties: { message: { type: 'string', description: 'User query or request' } },
        required: ['message'],
      };
    }

    // Build schema from trigger parameters
    const properties: Record<string, object> = {};
    const required: string[] = [];

    for (const param of triggerParams) {
      properties[param.name] = {
        type: param.type,
        description: param.description || '',
      };
      // FlowParameter uses 'optional: boolean', so !optional means required
      if (!param.optional) {
        required.push(param.name);
      }
    }

    return {
      type: 'object',
      properties,
      required,
    };
  }

  /**
   * Validate input against trigger's parameter schema.
   * Checks that required parameters are present and returns validated input.
   * If trigger has no parameters, defaults to expecting a 'message' field.
   */
  private validateTriggerInput(
    triggerParams: UserIntentNodeParameters,
    input: Record<string, unknown>
  ): Record<string, unknown> {
    const params = triggerParams.parameters ?? [];

    if (params.length === 0) {
      // Default behavior: require 'message' field
      if (!input.message && typeof input.message !== 'string') {
        // Allow empty message, just validate presence
      }
      return input;
    }

    // Validate required parameters (optional: false means required)
    const missingRequired: string[] = [];
    for (const param of params) {
      if (!param.optional && (input[param.name] === undefined || input[param.name] === null)) {
        missingRequired.push(param.name);
      }
    }

    if (missingRequired.length > 0) {
      throw new BadRequestException(
        `Missing required parameters: ${missingRequired.join(', ')}`
      );
    }

    return input;
  }

  /**
   * List all UI resources for an app.
   * Resources are now derived from trigger nodes (each trigger = one tool with potential widget).
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
      const triggerNodes = nodes.filter(n => n.type === 'UserIntent');
      const hasStatCard = nodes.some(n => n.type === 'StatCard');
      const hasCallFlow = nodes.some(n => n.type === 'CallFlow');

      for (const triggerNode of triggerNodes) {
        const params = triggerNode.parameters as UserIntentNodeParameters;

        // Skip inactive triggers
        if (params.isActive === false) {
          continue;
        }

        const toolName = params.toolName;

        if (hasStatCard) {
          resources.push({
            uri: `ui://widget/${appSlug}/${toolName}.html`,
            name: `${triggerNode.name} Widget`,
            description: `UI widget for ${toolName}`,
            mimeType: 'text/html+skybridge',
          });
        } else if (hasCallFlow) {
          resources.push({
            uri: `ui://widget/${appSlug}/${toolName}-callflow.html`,
            name: `${triggerNode.name} Call Flow Widget`,
            description: `Call flow trigger widget for ${toolName}`,
            mimeType: 'text/html+skybridge',
          });
        }
      }
    }

    return resources;
  }

  /**
   * Read a UI resource and return its HTML content.
   * Finds the trigger by toolName and generates appropriate widget HTML.
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

      // Find trigger by toolName
      const triggerResult = await this.findTriggerByToolName(app.id, toolName);
      if (!triggerResult) {
        throw new NotFoundException(`No active trigger found for tool: ${toolName}`);
      }

      const { trigger, flow } = triggerResult;
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
          // Get the first active trigger's toolName from target flow
          const targetNodes = targetFlow.nodes ?? [];
          const targetTrigger = targetNodes.find(n => {
            if (n.type === 'UserIntent') {
              const tp = n.parameters as UserIntentNodeParameters;
              return tp.isActive !== false;
            }
            return false;
          });
          if (targetTrigger) {
            const targetParams = targetTrigger.parameters as UserIntentNodeParameters;
            targetToolName = targetParams.toolName;
          }
        }
      }

      const widgetHtml = this.generateCallFlowWidgetHtml(trigger.name, targetToolName, targetFlowName);
      return { uri, mimeType: 'text/html+skybridge', text: widgetHtml };
    } else if (viewMatch && viewMatch[1] === appSlug) {
      const toolName = viewMatch[2];

      // Find trigger by toolName
      const triggerResult = await this.findTriggerByToolName(app.id, toolName);
      if (!triggerResult) {
        throw new NotFoundException(`No active trigger found for tool: ${toolName}`);
      }

      const { trigger, flow } = triggerResult;
      const nodes = flow.nodes ?? [];
      const statCardNode = nodes.find(n => n.type === 'StatCard');

      if (!statCardNode) throw new NotFoundException(`No StatCard node found for tool: ${toolName}`);

      const params = statCardNode.parameters as StatCardNodeParameters;
      const widgetHtml = this.generateWidgetHtml(trigger.name, params.layoutTemplate, app.themeVariables);

      return { uri, mimeType: 'text/html+skybridge', text: widgetHtml };
    }

    throw new NotFoundException(`Invalid resource URI: ${uri}`);
  }

  /**
   * Generate widget HTML with ChatGPT Apps SDK bridge
   * Currently only supports stat-card layout
   */
  private generateWidgetHtml(
    flowName: string,
    _layoutTemplate: LayoutTemplate,
    themeVariables: Record<string, string>
  ): string {
    const cssVariables = Object.entries(themeVariables)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value};`)
      .join('\n      ');

    // All layouts currently use stat-card
    return this.generateStatsWidgetHtml(flowName, cssVariables);
  }

  private generateStatsWidgetHtml(flowName: string, cssVariables: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${flowName}</title>
  <style>
    :root {
      ${cssVariables}
      --background: 0 0% 100%;
      --foreground: 222.2 84% 4.9%;
      --card: 0 0% 100%;
      --card-foreground: 222.2 84% 4.9%;
      --muted-foreground: 215.4 16.3% 46.9%;
      --border: 214.3 31.8% 91.4%;
      --success: 142.1 76.2% 36.3%;
      --destructive: 0 84.2% 60.2%;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: hsl(var(--background)); color: hsl(var(--foreground)); padding: 16px; }
    .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    @media (min-width: 768px) { .stats-grid { grid-template-columns: repeat(3, 1fr); } }
    .stat-card { padding: 16px; border-radius: 8px; border: 1px solid hsl(var(--border)); background: hsl(var(--card)); }
    .stat-label { font-size: 12px; font-weight: 500; color: hsl(var(--muted-foreground)); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .stat-value { font-size: 24px; font-weight: 600; color: hsl(var(--card-foreground)); margin-bottom: 4px; }
    @media (min-width: 768px) { .stat-value { font-size: 28px; } }
    .stat-change { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 500; }
    .stat-change.up { color: hsl(var(--success)); }
    .stat-change.down { color: hsl(var(--destructive)); }
    .stat-change.neutral { color: hsl(var(--muted-foreground)); }
    .trend-icon { width: 16px; height: 16px; }
    .change-label { font-size: 11px; color: hsl(var(--muted-foreground)); margin-left: 4px; }
    .empty-message { padding: 32px; text-align: center; color: hsl(var(--muted-foreground)); }
  </style>
</head>
<body>
  <div class="stats-grid" id="stats-grid"></div>
  <div class="empty-message" id="empty-message" style="display: none;">No statistics available</div>
  <script>
    (function() {
      var icons = {
        up: '<svg class="trend-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
        down: '<svg class="trend-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>',
        neutral: '<svg class="trend-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>'
      };
      function unwrap(d) { return (d && d.structuredContent) ? d.structuredContent : d; }
      function getToolData() {
        if (!window.openai) return null;
        // Check multiple possible locations for tool output
        return window.openai.toolOutput || window.openai.structuredContent || null;
      }
      function initWidget() { var data = getToolData(); if (data) renderStats(unwrap(data)); }
      window.addEventListener('openai:set_globals', function(e) {
        if (!e.detail) return;
        var output = e.detail.toolOutput || e.detail.structuredContent || (e.detail.globals && e.detail.globals.toolOutput);
        if (output) renderStats(unwrap(output));
      });
      window.addEventListener('message', function(e) {
        if (!e.data) return;
        // Only handle messages that look like tool output data
        var d = e.data.structuredContent || e.data;
        if (d && d.stats) renderStats(d);
      });
      function renderStats(data) {
        var grid = document.getElementById('stats-grid');
        var empty = document.getElementById('empty-message');
        var stats = (data && data.stats) || [];
        if (stats.length === 0) { grid.style.display = 'none'; empty.style.display = 'block'; return; }
        grid.style.display = 'grid'; empty.style.display = 'none';
        grid.innerHTML = stats.map(function(s) {
          var trend = s.trend || determineTrend(s.change);
          var changeVal = formatChange(s.change);
          var changeLabel = s.changeLabel || '';
          return '<div class="stat-card"><div class="stat-label">' + escapeHtml(s.label) + '</div><div class="stat-value">' + escapeHtml(String(s.value)) + '</div>' + (changeVal ? '<div class="stat-change ' + trend + '">' + icons[trend] + '<span>' + changeVal + '</span>' + (changeLabel ? '<span class="change-label">' + escapeHtml(changeLabel) + '</span>' : '') + '</div>' : '') + '</div>';
        }).join('');
      }
      function determineTrend(c) { if (c === undefined || c === null || c === 0) return 'neutral'; return c > 0 ? 'up' : 'down'; }
      function formatChange(c) { if (c === undefined || c === null) return ''; var sign = c > 0 ? '+' : ''; return sign + c.toFixed(1) + '%'; }
      function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
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

  private generateResponseText(flowName: string, _layoutTemplate: LayoutTemplate, _message: string): string {
    return `Here are the statistics from ${flowName}:`;
  }
}
