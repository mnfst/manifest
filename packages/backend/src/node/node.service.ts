import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlowEntity } from '../flow/flow.entity';
import type {
  NodeInstance,
  Connection,
  CreateNodeRequest,
  UpdateNodeRequest,
  UpdateNodePositionRequest,
  CreateConnectionRequest,
  NodeTypeCategory,
  UserIntentNodeParameters,
} from '@chatgpt-app-builder/shared';
import { v4 as uuidv4 } from 'uuid';
import { builtInNodeList, toNodeTypeInfo, type NodeTypeInfo } from '@chatgpt-app-builder/nodes';
import { generateUniqueToolName } from '../utils/tool-name';

/**
 * Category info for grouping nodes in the UI
 */
interface CategoryInfo {
  id: NodeTypeCategory;
  displayName: string;
  order: number;
}

/**
 * Response for GET /api/node-types
 */
export interface NodeTypesResponse {
  nodeTypes: NodeTypeInfo[];
  categories: CategoryInfo[];
}

/**
 * Service for Node and Connection CRUD operations.
 * Nodes and connections are stored as JSON arrays in the Flow entity.
 */
@Injectable()
export class NodeService {
  constructor(
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>
  ) {}

  // ==========================================================================
  // Node Types API
  // ==========================================================================

  /**
   * Get all available node types with their metadata and categories.
   * Used by the frontend to populate the add-step modal.
   */
  getNodeTypes(): NodeTypesResponse {
    const nodeTypes = builtInNodeList.map(toNodeTypeInfo);

    const categories: CategoryInfo[] = [
      { id: 'trigger', displayName: 'Triggers', order: 1 },
      { id: 'interface', displayName: 'Agentic Interfaces', order: 2 },
      { id: 'action', displayName: 'Actions', order: 3 },
      { id: 'return', displayName: 'Return Values', order: 4 },
    ];

    return { nodeTypes, categories };
  }

  // ==========================================================================
  // Node CRUD Operations (T026-T030)
  // ==========================================================================

  /**
   * T030: Get all nodes in a flow
   */
  async getNodes(flowId: string): Promise<NodeInstance[]> {
    const flow = await this.findFlow(flowId);
    return flow.nodes ?? [];
  }

  /**
   * T026: Add a new node to a flow.
   * Validates unique name within the flow.
   * For UserIntent nodes, auto-generates a unique toolName.
   */
  async addNode(flowId: string, request: CreateNodeRequest): Promise<NodeInstance> {
    const flow = await this.findFlow(flowId);
    const nodes = flow.nodes ?? [];

    // Validate unique name within flow
    if (nodes.some((n) => n.name === request.name)) {
      throw new BadRequestException(`Node with name "${request.name}" already exists in this flow`);
    }

    const newNode: NodeInstance = {
      id: uuidv4(),
      type: request.type,
      name: request.name,
      position: request.position,
      parameters: request.parameters ?? {},
    };

    // For UserIntent nodes, auto-generate a unique toolName
    if (request.type === 'UserIntent') {
      const toolName = await generateUniqueToolName(
        flow.appId,
        request.name,
        this.flowRepository
      );
      const params = newNode.parameters as UserIntentNodeParameters;
      params.toolName = toolName;
      params.isActive = params.isActive ?? true;
      params.toolDescription = params.toolDescription ?? '';
      params.parameters = params.parameters ?? [];
    }

    nodes.push(newNode);
    flow.nodes = nodes;
    await this.flowRepository.save(flow);

    return newNode;
  }

  /**
   * T027: Update a node (name, parameters).
   * Finds by id and merges updates.
   * For UserIntent nodes, regenerates toolName when name changes.
   */
  async updateNode(flowId: string, nodeId: string, request: UpdateNodeRequest): Promise<NodeInstance> {
    const flow = await this.findFlow(flowId);
    const nodes = flow.nodes ?? [];
    const nodeIndex = nodes.findIndex((n) => n.id === nodeId);

    if (nodeIndex === -1) {
      throw new NotFoundException(`Node with id ${nodeId} not found in flow ${flowId}`);
    }

    const node = nodes[nodeIndex];
    let nameChanged = false;

    // Validate unique name if changing
    if (request.name !== undefined && request.name !== node.name) {
      if (nodes.some((n) => n.name === request.name && n.id !== nodeId)) {
        throw new BadRequestException(`Node with name "${request.name}" already exists in this flow`);
      }
      node.name = request.name;
      nameChanged = true;
    }

    // Update position if provided
    if (request.position !== undefined) {
      node.position = request.position;
    }

    // Merge parameters if provided
    if (request.parameters !== undefined) {
      node.parameters = { ...node.parameters, ...request.parameters };
    }

    // For UserIntent nodes, regenerate toolName when name changes
    if (node.type === 'UserIntent' && nameChanged) {
      const toolName = await generateUniqueToolName(
        flow.appId,
        node.name,
        this.flowRepository,
        node.id // Exclude this node from uniqueness check
      );
      (node.parameters as UserIntentNodeParameters).toolName = toolName;
    }

    nodes[nodeIndex] = node;
    flow.nodes = nodes;
    await this.flowRepository.save(flow);

    return node;
  }

  /**
   * T028: Optimized position-only update for a node.
   */
  async updateNodePosition(flowId: string, nodeId: string, position: UpdateNodePositionRequest): Promise<NodeInstance> {
    const flow = await this.findFlow(flowId);
    const nodes = flow.nodes ?? [];
    const nodeIndex = nodes.findIndex((n) => n.id === nodeId);

    if (nodeIndex === -1) {
      throw new NotFoundException(`Node with id ${nodeId} not found in flow ${flowId}`);
    }

    nodes[nodeIndex].position = { x: position.x, y: position.y };
    flow.nodes = nodes;
    await this.flowRepository.save(flow);

    return nodes[nodeIndex];
  }

  /**
   * T029: Delete a node and cascade remove its connections.
   */
  async deleteNode(flowId: string, nodeId: string): Promise<void> {
    const flow = await this.findFlow(flowId);
    const nodes = flow.nodes ?? [];
    const nodeIndex = nodes.findIndex((n) => n.id === nodeId);

    if (nodeIndex === -1) {
      throw new NotFoundException(`Node with id ${nodeId} not found in flow ${flowId}`);
    }

    // Remove the node
    nodes.splice(nodeIndex, 1);
    flow.nodes = nodes;

    // Cascade: remove connections that reference this node
    const connections = flow.connections ?? [];
    flow.connections = connections.filter(
      (c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
    );

    await this.flowRepository.save(flow);
  }

  // ==========================================================================
  // Connection CRUD Operations (T031-T033)
  // ==========================================================================

  /**
   * T033: Get all connections in a flow
   */
  async getConnections(flowId: string): Promise<Connection[]> {
    const flow = await this.findFlow(flowId);
    return flow.connections ?? [];
  }

  /**
   * T031: Add a new connection between nodes.
   * Validates that source and target nodes exist.
   * Validates that target node is not a trigger node (trigger nodes only have outputs).
   */
  async addConnection(flowId: string, request: CreateConnectionRequest): Promise<Connection> {
    const flow = await this.findFlow(flowId);
    const nodes = flow.nodes ?? [];
    const connections = flow.connections ?? [];

    // Validate source node exists
    if (!nodes.some((n) => n.id === request.sourceNodeId)) {
      throw new BadRequestException(`Source node ${request.sourceNodeId} not found in flow`);
    }

    // Validate target node exists
    const targetNode = nodes.find((n) => n.id === request.targetNodeId);
    if (!targetNode) {
      throw new BadRequestException(`Target node ${request.targetNodeId} not found in flow`);
    }

    // Validate target node is not a trigger node (trigger nodes don't accept incoming connections)
    if (targetNode.type === 'UserIntent') {
      throw new BadRequestException('Cannot create connection to trigger node. Trigger nodes do not accept incoming connections.');
    }

    // Prevent self-connections
    if (request.sourceNodeId === request.targetNodeId) {
      throw new BadRequestException('Cannot connect a node to itself');
    }

    // Check for circular reference
    if (this.wouldCreateCycle(request.sourceNodeId, request.targetNodeId, connections)) {
      throw new BadRequestException('This connection would create a circular reference');
    }

    // Check for duplicate connection (same source/target with same handles)
    const isDuplicate = connections.some(
      (c) =>
        c.sourceNodeId === request.sourceNodeId &&
        c.sourceHandle === request.sourceHandle &&
        c.targetNodeId === request.targetNodeId &&
        c.targetHandle === request.targetHandle
    );
    if (isDuplicate) {
      throw new BadRequestException('This connection already exists');
    }

    const newConnection: Connection = {
      id: uuidv4(),
      sourceNodeId: request.sourceNodeId,
      sourceHandle: request.sourceHandle,
      targetNodeId: request.targetNodeId,
      targetHandle: request.targetHandle,
    };

    connections.push(newConnection);
    flow.connections = connections;
    await this.flowRepository.save(flow);

    return newConnection;
  }

  /**
   * T032: Delete a connection by ID.
   */
  async deleteConnection(flowId: string, connectionId: string): Promise<void> {
    const flow = await this.findFlow(flowId);
    const connections = flow.connections ?? [];
    const connectionIndex = connections.findIndex((c) => c.id === connectionId);

    if (connectionIndex === -1) {
      throw new NotFoundException(`Connection with id ${connectionId} not found in flow ${flowId}`);
    }

    connections.splice(connectionIndex, 1);
    flow.connections = connections;
    await this.flowRepository.save(flow);
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Check if adding a connection would create a cycle in the graph.
   * Uses DFS to detect if there's a path from targetNodeId back to sourceNodeId.
   */
  private wouldCreateCycle(
    sourceNodeId: string,
    targetNodeId: string,
    connections: Connection[]
  ): boolean {
    // Check if there's already a path from target back to source
    const visited = new Set<string>();
    const stack = [targetNodeId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === sourceNodeId) {
        return true; // Found a cycle
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      // Find all nodes this one connects to
      for (const conn of connections) {
        if (conn.sourceNodeId === current) {
          stack.push(conn.targetNodeId);
        }
      }
    }
    return false;
  }

  /**
   * Find a flow by ID or throw NotFoundException.
   */
  private async findFlow(flowId: string): Promise<FlowEntity> {
    const flow = await this.flowRepository.findOne({ where: { id: flowId } });
    if (!flow) {
      throw new NotFoundException(`Flow with id ${flowId} not found`);
    }
    return flow;
  }
}
