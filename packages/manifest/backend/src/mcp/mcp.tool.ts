import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { FlowExecutionService } from '../flow-execution/flow-execution.service';
import { SecretService } from '../secret/secret.service';
import type { McpToolResponse, NodeInstance, ReturnNodeParameters, CallFlowNodeParameters, ApiCallNodeParameters, LinkNodeParameters, Connection, NodeExecutionData, UserIntentNodeParameters, JavaScriptCodeTransformParameters, ExecuteActionRequest, RegistryNodeParameters } from '@manifest/shared';
import { ApiCallNode, JavaScriptCodeTransform } from '@manifest/nodes';
import { escapeHtml, escapeJs } from './mcp.utils';
import { resolveTemplateVariables } from './utils/template.utils';
import { McpInactiveToolError } from './errors/mcp-inactive-tool.error';

export { McpInactiveToolError } from './errors/mcp-inactive-tool.error';

/**
 * Service for handling MCP tool calls for published apps
 * Implements ChatGPT Apps SDK response format
 * Each flow in an app becomes an MCP tool
 *
 * Node architecture:
 * - RegistryComponent nodes contain UI components from the registry
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
    private readonly flowExecutionService: FlowExecutionService,
    private readonly secretService: SecretService
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
    input: Record<string, unknown>,
    userFingerprint?: string
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

    // Build trigger output with _execution metadata
    const triggerOutput = {
      ...validatedInput,
      _execution: {
        success: true,
        type: 'trigger' as const,
        toolName,
      },
    };

    // Create execution record
    const execution = await this.flowExecutionService.createExecution({
      flowId: flow.id,
      flowName: flow.name,
      flowToolName: toolName, // Use trigger's toolName
      initialParams: validatedInput,
      userFingerprint,
    });

    const nodeExecutions: NodeExecutionData[] = [];

    // Add the trigger node as the first execution entry
    nodeExecutions.push(this.createNodeExecution(
      trigger,
      {}, // Trigger has no input from other nodes
      triggerOutput, // Output includes validated params + _execution metadata
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

      // Load app secrets and add as virtual "secrets" namespace
      // Allows templates like {{ secrets.API_KEY }} to resolve
      const appSecrets = await this.secretService.listByAppId(app.id);
      const secretsObj: Record<string, string> = {};
      for (const secret of appSecrets) {
        secretsObj[secret.key] = secret.value;
      }
      nodeOutputs.set('secrets', secretsObj);

      // Store the trigger node's output (validated input parameters + _execution metadata)
      // This allows downstream nodes to reference trigger params like {{ trigger.pokemonName }}
      nodeOutputs.set(trigger.id, triggerOutput);

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
        } else if (node.type === 'RegistryComponent') {
          // Execute RegistryComponent node - return widget with component UI
          result = this.executeRegistryComponentFlow(app, toolName, trigger.name, node, nodeInputData);
          const structuredContent = result.structuredContent || {};
          nodeOutputs.set(node.id, structuredContent);
          nodeExecutions.push(this.createNodeExecution(node, nodeInputData, structuredContent, 'completed'));
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
   * Execute RegistryComponent node - return widget with custom component UI
   * The component files are embedded in the node parameters and rendered as a widget.
   */
  private executeRegistryComponentFlow(
    app: AppEntity,
    triggerToolName: string,
    triggerName: string,
    registryNode: NodeInstance,
    input: Record<string, unknown>
  ): McpToolResponse {
    const params = registryNode.parameters as RegistryNodeParameters;

    // Extract available actions from the component parameters
    const availableActions = (params.actions || []).map(a => a.name);

    const responseText = `Here is the ${params.title || registryNode.name} component:`;

    return {
      structuredContent: {
        ...input,
        nodeId: registryNode.id,
        actions: availableActions,
        registryName: params.registryName,
        title: params.title,
      },
      content: [{ type: 'text', text: responseText }],
      _meta: {
        'openai/outputTemplate': `ui://widget/${app.slug}/${triggerToolName}/${registryNode.id}.html`,
        'openai/widgetPrefersBorder': true,
        flowName: triggerName,
        toolName: triggerToolName,
        nodeId: registryNode.id,
        registryName: params.registryName,
        availableActions,
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
    request: ExecuteActionRequest,
    userFingerprint?: string
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
      userFingerprint,
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
        } else if (node.type === 'Link') {
          // Handle Link node - opens an external URL
          const params = node.parameters as LinkNodeParameters;
          const rawHref = params.href || '';

          if (!rawHref.trim()) {
            const linkOutput = { type: 'link', href: '', error: 'URL is required' };
            nodeOutputs.set(node.id, linkOutput);
            nodeExecutions.push(this.createNodeExecution(node, nodeInputData, linkOutput, 'error', 'URL is required'));
            result = {
              content: [{ type: 'text', text: 'Link node error: URL is required' }],
            };
          } else {
            // Resolve template variables in the href
            const resolvedHref = resolveTemplateVariables(rawHref, nodeOutputs, allNodes);

            // Normalize URL (add https:// if missing)
            let normalizedHref = resolvedHref.trim();
            if (!normalizedHref.startsWith('http://') && !normalizedHref.startsWith('https://')) {
              normalizedHref = `https://${normalizedHref}`;
            }

            const linkOutput = { type: 'link', href: normalizedHref };
            nodeOutputs.set(node.id, linkOutput);
            nodeExecutions.push(this.createNodeExecution(node, nodeInputData, linkOutput, 'completed'));
            result = {
              content: [{ type: 'text', text: `Opening: ${normalizedHref}` }],
              structuredContent: linkOutput,
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
      const hasCallFlow = nodes.some(n => n.type === 'CallFlow');
      const registryComponents = nodes.filter(n => n.type === 'RegistryComponent');

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

        if (hasCallFlow) {
          toolDef._meta = {
            'openai/outputTemplate': `ui://widget/${appSlug}/${params.toolName}-callflow.html`,
            'openai/toolInvocation/invoking': `Triggering ${triggerNode.name}...`,
            'openai/toolInvocation/invoked': `Triggered ${triggerNode.name}`,
          };
        } else if (registryComponents.length > 0) {
          // Use the first RegistryComponent for the tool definition
          const firstRegistry = registryComponents[0];
          toolDef._meta = {
            'openai/outputTemplate': `ui://widget/${appSlug}/${params.toolName}/${firstRegistry.id}.html`,
            'openai/toolInvocation/invoking': `Loading ${triggerNode.name}...`,
            'openai/toolInvocation/invoked': `Loaded ${triggerNode.name}`,
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
      const hasCallFlow = nodes.some(n => n.type === 'CallFlow');
      const registryComponents = nodes.filter(n => n.type === 'RegistryComponent');

      for (const triggerNode of triggerNodes) {
        const params = triggerNode.parameters as UserIntentNodeParameters;

        // Skip inactive triggers
        if (params.isActive === false) {
          continue;
        }

        const toolName = params.toolName;

        if (hasCallFlow) {
          resources.push({
            uri: `ui://widget/${appSlug}/${toolName}-callflow.html`,
            name: `${triggerNode.name} Call Flow Widget`,
            description: `Call flow trigger widget for ${toolName}`,
            mimeType: 'text/html+skybridge',
          });
        }

        // Add RegistryComponent widgets
        for (const registryNode of registryComponents) {
          const regParams = registryNode.parameters as RegistryNodeParameters;
          resources.push({
            uri: `ui://widget/${appSlug}/${toolName}/${registryNode.id}.html`,
            name: `${regParams.title || registryNode.name} Widget`,
            description: `Custom component widget: ${regParams.description || regParams.title}`,
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
    const registryMatch = uri.match(/^ui:\/\/widget\/([^/]+)\/([^/]+)\/([^.]+)\.html$/);

    // Handle RegistryComponent widgets: ui://widget/{appSlug}/{toolName}/{nodeId}.html
    if (registryMatch && registryMatch[1] === appSlug) {
      const toolName = registryMatch[2];
      const nodeId = registryMatch[3];

      // Find the flow containing this tool
      const triggerResult = await this.findTriggerByToolName(app.id, toolName);
      if (!triggerResult) {
        throw new NotFoundException(`No active trigger found for tool: ${toolName}`);
      }

      const { flow } = triggerResult;
      const nodes = flow.nodes ?? [];
      const registryNode = nodes.find(n => n.id === nodeId && n.type === 'RegistryComponent');

      if (!registryNode) {
        throw new NotFoundException(`No RegistryComponent node found with id: ${nodeId}`);
      }

      const params = registryNode.parameters as RegistryNodeParameters;
      const widgetHtml = this.generateRegistryComponentWidgetHtml(registryNode.name, params, app.themeVariables, app.slug, toolName);

      return { uri, mimeType: 'text/html+skybridge', text: widgetHtml };
    }

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

      const widgetHtml = this.generateCallFlowWidgetHtml(trigger.name, targetToolName, targetFlowName, app.themeVariables);
      return { uri, mimeType: 'text/html+skybridge', text: widgetHtml };
    }

    throw new NotFoundException(`Invalid resource URI: ${uri}`);
  }

  private generateCallFlowWidgetHtml(
    flowName: string,
    targetToolName: string,
    targetFlowName: string,
    themeVariables: Record<string, string>
  ): string {
    // SECURITY: Escape user inputs to prevent XSS
    const safeFlowName = escapeHtml(flowName);
    const safeTargetFlowName = escapeHtml(targetFlowName);
    const safeTargetToolName = escapeJs(targetToolName);

    const cssVariables = Object.entries(themeVariables)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value};`)
      .join('\n      ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeFlowName} - Call Flow</title>
  <style>
    :root {
      ${cssVariables}
      --primary: 222.2 47.4% 11.2%;
      --muted-foreground: 215.4 16.3% 46.9%;
      --border: 214.3 31.8% 91.4%;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: transparent; padding: 12px; }
    .status { display: flex; align-items: center; gap: 8px; font-size: 14px; color: hsl(var(--muted-foreground)); }
    .spinner { width: 16px; height: 16px; border: 2px solid hsl(var(--border)); border-top-color: hsl(var(--primary)); border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="status"><div class="spinner"></div><span>Triggering ${safeTargetFlowName}...</span></div>
  <script>
    (function() {
      var triggered = false;
      function triggerFlow() {
        if (triggered) return; triggered = true;
        if (window.openai && window.openai.callTool) {
          window.openai.callTool('${safeTargetToolName}', { message: 'Triggered from call flow' });
        }
      }
      window.addEventListener('openai:set_globals', triggerFlow);
      if (document.readyState === 'complete') triggerFlow(); else window.addEventListener('DOMContentLoaded', triggerFlow);
    })();
  </script>
</body>
</html>`;
  }

  /**
   * Generate widget HTML for a RegistryComponent.
   * Renders the actual React component using Sucrase for runtime JSX transpilation.
   */
  private generateRegistryComponentWidgetHtml(
    nodeName: string,
    params: RegistryNodeParameters,
    themeVariables: Record<string, string>,
    appSlug: string,
    toolName: string
  ): string {
    // SECURITY: Escape user inputs to prevent XSS
    const safeTitle = escapeHtml(params.title || nodeName);

    const cssVariables = Object.entries(themeVariables)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value};`)
      .join('\n      ');

    // Get the main component source code
    const mainFile = params.files?.[0];
    const componentCode = mainFile?.content || '';

    // Escape the component code for embedding in JavaScript
    const escapedCode = JSON.stringify(componentCode);

    // Extract action names for callback handling
    const actions = params.actions || [];
    const actionNames = JSON.stringify(actions.map(a => a.name));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <!-- React and ReactDOM -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <!-- Babel Standalone for runtime JSX transpilation -->
  <script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>
  <!-- Lucide React Icons -->
  <script src="https://unpkg.com/lucide-react@0.344.0/dist/umd/lucide-react.min.js"></script>
  <style>
    :root {
      ${cssVariables}
      --background: 0 0% 100%;
      --foreground: 222.2 84% 4.9%;
      --card: 0 0% 100%;
      --card-foreground: 222.2 84% 4.9%;
      --popover: 0 0% 100%;
      --popover-foreground: 222.2 84% 4.9%;
      --primary: 222.2 47.4% 11.2%;
      --primary-foreground: 210 40% 98%;
      --secondary: 210 40% 96.1%;
      --secondary-foreground: 222.2 47.4% 11.2%;
      --muted: 210 40% 96.1%;
      --muted-foreground: 215.4 16.3% 46.9%;
      --accent: 210 40% 96.1%;
      --accent-foreground: 222.2 47.4% 11.2%;
      --destructive: 0 84.2% 60.2%;
      --destructive-foreground: 210 40% 98%;
      --border: 214.3 31.8% 91.4%;
      --input: 214.3 31.8% 91.4%;
      --ring: 222.2 84% 4.9%;
      --radius: 0.5rem;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: hsl(var(--background));
      color: hsl(var(--foreground));
      padding: 16px;
    }
    #root { min-height: 100px; }
    .error-container {
      padding: 16px;
      background: hsl(0 84.2% 60.2% / 0.1);
      border: 1px solid hsl(0 84.2% 60.2%);
      border-radius: 8px;
      color: hsl(0 84.2% 60.2%);
    }
    .loading { text-align: center; padding: 24px; color: hsl(var(--muted-foreground)); }
    /* shadcn/ui Button styles */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      border-radius: calc(var(--radius) - 2px);
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
      cursor: pointer;
      border: none;
      outline: none;
    }
    .btn:disabled { pointer-events: none; opacity: 0.5; }
    .btn-default {
      background: hsl(var(--primary));
      color: hsl(var(--primary-foreground));
      padding: 8px 16px;
    }
    .btn-default:hover { opacity: 0.9; }
    .btn-outline {
      border: 1px solid hsl(var(--input));
      background: transparent;
      padding: 8px 16px;
    }
    .btn-outline:hover { background: hsl(var(--accent)); }
    .btn-ghost {
      background: transparent;
      padding: 8px 16px;
    }
    .btn-ghost:hover { background: hsl(var(--accent)); }
    .btn-sm { padding: 4px 12px; font-size: 12px; }
    .btn-lg { padding: 12px 24px; font-size: 16px; }
    .btn-icon { padding: 8px; }
  </style>
</head>
<body>
  <div id="root"><div class="loading">Loading component...</div></div>
  <script>
    (function() {
      var nodeId = '${params.registryName}';
      var toolData = {};
      var currentData = null;
      var appSlug = '${appSlug}';
      var toolName = '${toolName}';
      var actionNames = ${actionNames};

      // cn utility function (clsx-like)
      function cn() {
        var classes = [];
        for (var i = 0; i < arguments.length; i++) {
          var arg = arguments[i];
          if (!arg) continue;
          if (typeof arg === 'string') classes.push(arg);
          else if (Array.isArray(arg)) classes.push(cn.apply(null, arg));
          else if (typeof arg === 'object') {
            for (var key in arg) {
              if (arg[key]) classes.push(key);
            }
          }
        }
        return classes.join(' ');
      }

      // Simple Button component
      function Button(props) {
        var variant = props.variant || 'default';
        var size = props.size || 'default';
        var className = props.className || '';

        var variantClass = 'btn-' + variant;
        var sizeClass = size !== 'default' ? 'btn-' + size : '';

        return React.createElement('button', {
          className: cn('btn', variantClass, sizeClass, className),
          onClick: props.onClick,
          disabled: props.disabled,
          type: props.type || 'button',
        }, props.children);
      }

      // Create action callback handlers
      function createActionHandler(actionName) {
        return function(data) {
          console.log('Action triggered:', actionName, data);
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              type: 'mcp-action',
              appSlug: appSlug,
              toolName: toolName,
              nodeId: nodeId,
              action: actionName,
              data: Object.assign({}, toolData, data || {})
            }, '*');
          }
        };
      }

      // Build actions object for component
      var actionsObj = {};
      actionNames.forEach(function(name) {
        actionsObj[name] = createActionHandler(name);
      });

      // Mock require function for imports
      function mockRequire(moduleName) {
        if (moduleName === 'react') return React;
        if (moduleName === 'lucide-react') return window.lucideReact || {};
        if (moduleName === '@/lib/utils') return { cn: cn };
        if (moduleName === '@/components/ui/button' || moduleName.includes('button')) {
          return { Button: Button };
        }
        console.warn('Unknown import:', moduleName);
        return {};
      }

      // Compile and render component
      function compileAndRender(code, data) {
        try {
          // Strip Next.js directives
          var processedCode = code
            .replace(/['"]use client['"]\\s*;?/g, '')
            .replace(/['"]use server['"]\\s*;?/g, '');

          // Transform with Babel
          var result = Babel.transform(processedCode, {
            presets: ['react', 'typescript'],
            plugins: ['transform-modules-commonjs'],
            filename: 'component.tsx'
          });

          // Create module wrapper
          var moduleCode = 'var exports = {}; var module = { exports: exports };' +
            result.code +
            '; if (module.exports.default) return module.exports.default;' +
            'if (typeof module.exports === "function") return module.exports;' +
            'for (var key in exports) { if (typeof exports[key] === "function") return exports[key]; }' +
            'return null;';

          var factory = new Function('React', 'require', moduleCode);
          var Component = factory(React, mockRequire);

          if (typeof Component !== 'function') {
            throw new Error('Component must export a function');
          }

          // Render with data and actions
          var root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(
            React.createElement(Component, {
              data: data || {},
              actions: actionsObj,
              appearance: {}
            })
          );
        } catch (err) {
          console.error('Compilation error:', err);
          document.getElementById('root').innerHTML =
            '<div class="error-container"><strong>Error:</strong> ' +
            (err.message || 'Unknown error') + '</div>';
        }
      }

      // Get component code
      var componentCode = ${escapedCode};

      function unwrap(d) {
        return (d && d.structuredContent) ? d.structuredContent : d;
      }

      function getToolData() {
        if (!window.openai) return null;
        return window.openai.toolOutput || window.openai.structuredContent || null;
      }

      function renderComponent(data) {
        toolData = data || {};
        nodeId = data?.nodeId || nodeId;
        currentData = data;
        compileAndRender(componentCode, data);
      }

      function initWidget() {
        var data = getToolData();
        if (data) renderComponent(unwrap(data));
        else compileAndRender(componentCode, {});
      }

      window.addEventListener('openai:set_globals', function(e) {
        if (!e.detail) return;
        var output = e.detail.toolOutput || e.detail.structuredContent ||
                     (e.detail.globals && e.detail.globals.toolOutput);
        if (output) renderComponent(unwrap(output));
      });

      window.addEventListener('message', function(e) {
        if (!e.data) return;
        var d = e.data.structuredContent || e.data;
        if (d && (d.nodeId || d.registryName)) renderComponent(d);
      });

      // Wait for scripts to load then init
      if (document.readyState === 'complete') {
        setTimeout(initWidget, 100);
      } else {
        window.addEventListener('load', function() {
          setTimeout(initWidget, 100);
        });
      }
    })();
  </script>
</body>
</html>`;
  }
}
