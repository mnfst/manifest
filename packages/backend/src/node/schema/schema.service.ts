import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlowEntity } from '../../flow/flow.entity';
import {
  builtInNodeList,
  type NodeTypeDefinition,
} from '@chatgpt-app-builder/nodes';
import {
  checkSchemaCompatibility,
  createUserIntentOutputSchema,
  type JSONSchema,
  type NodeSchemaInfo,
  type SchemaState,
  type ValidateConnectionRequest,
  type ValidateConnectionResponse,
  type NodeInstance,
  type UserIntentNodeParameters,
  type FlowParameter,
} from '@chatgpt-app-builder/shared';

/**
 * Service for schema-related operations.
 * Provides schema resolution for nodes and connection validation.
 */
@Injectable()
export class SchemaService {
  private readonly nodeTypeMap: Map<string, NodeTypeDefinition>;

  constructor(
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>
  ) {
    // Build lookup map for node types
    this.nodeTypeMap = new Map();
    for (const nodeDef of builtInNodeList) {
      this.nodeTypeMap.set(nodeDef.name, nodeDef);
    }
  }

  // ==========================================================================
  // Schema Resolution
  // ==========================================================================

  /**
   * Get schema information for a specific node instance.
   */
  async getNodeSchema(flowId: string, nodeId: string): Promise<NodeSchemaInfo> {
    const flow = await this.findFlow(flowId);
    const nodes = flow.nodes ?? [];
    const node = nodes.find((n) => n.id === nodeId);

    if (!node) {
      throw new NotFoundException(
        `Node with id ${nodeId} not found in flow ${flowId}`
      );
    }

    return this.resolveNodeSchema(node);
  }

  /**
   * Get schema information for all nodes in a flow.
   */
  async getFlowSchemas(flowId: string): Promise<NodeSchemaInfo[]> {
    const flow = await this.findFlow(flowId);
    const nodes = flow.nodes ?? [];

    return nodes.map((node) => this.resolveNodeSchema(node));
  }

  /**
   * Get schema information for a node type (without instance parameters).
   */
  getNodeTypeSchema(
    nodeType: string
  ): { inputSchema: JSONSchema | null; outputSchema: JSONSchema | null; hasDynamicInput: boolean; hasDynamicOutput: boolean } {
    const nodeDef = this.nodeTypeMap.get(nodeType);
    if (!nodeDef) {
      throw new NotFoundException(`Node type ${nodeType} not found`);
    }

    return {
      inputSchema: nodeDef.inputSchema ?? null,
      outputSchema: nodeDef.outputSchema ?? null,
      hasDynamicInput: !!nodeDef.getInputSchema,
      hasDynamicOutput: !!nodeDef.getOutputSchema,
    };
  }

  // ==========================================================================
  // Connection Validation
  // ==========================================================================

  /**
   * Validate a connection between two nodes.
   */
  async validateConnection(
    flowId: string,
    request: ValidateConnectionRequest
  ): Promise<ValidateConnectionResponse> {
    const flow = await this.findFlow(flowId);
    const nodes = flow.nodes ?? [];

    const sourceNode = nodes.find((n) => n.id === request.sourceNodeId);
    const targetNode = nodes.find((n) => n.id === request.targetNodeId);

    if (!sourceNode) {
      throw new NotFoundException(
        `Source node ${request.sourceNodeId} not found`
      );
    }
    if (!targetNode) {
      throw new NotFoundException(
        `Target node ${request.targetNodeId} not found`
      );
    }

    const sourceSchemaInfo = this.resolveNodeSchema(sourceNode);
    const targetSchemaInfo = this.resolveNodeSchema(targetNode);

    const result = checkSchemaCompatibility(
      sourceSchemaInfo.outputSchema,
      targetSchemaInfo.inputSchema
    );

    return {
      status: result.status,
      issues: result.issues,
      sourceSchema: result.sourceSchema,
      targetSchema: result.targetSchema,
    };
  }

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  /**
   * Resolve the input and output schemas for a node instance.
   * Uses dynamic schema functions when available, falling back to static schemas.
   */
  private resolveNodeSchema(node: NodeInstance): NodeSchemaInfo {
    const nodeDef = this.nodeTypeMap.get(node.type);

    if (!nodeDef) {
      return {
        nodeId: node.id,
        nodeType: node.type,
        inputState: 'unknown',
        inputSchema: null,
        outputState: 'unknown',
        outputSchema: null,
      };
    }

    // Resolve input schema
    let inputSchema: JSONSchema | null = null;
    let inputState: SchemaState = 'unknown';

    if (nodeDef.getInputSchema) {
      inputSchema = nodeDef.getInputSchema(node.parameters);
      inputState = inputSchema ? 'defined' : 'unknown';
    } else if (nodeDef.inputSchema !== undefined) {
      inputSchema = nodeDef.inputSchema;
      inputState = inputSchema ? 'defined' : 'unknown';
    }

    // Resolve output schema
    let outputSchema: JSONSchema | null = null;
    let outputState: SchemaState = 'unknown';

    if (nodeDef.getOutputSchema) {
      outputSchema = nodeDef.getOutputSchema(node.parameters);
      outputState = outputSchema ? 'defined' : 'unknown';
    } else if (nodeDef.outputSchema !== undefined) {
      outputSchema = nodeDef.outputSchema;
      outputState = outputSchema ? 'defined' : 'unknown';
    }

    // Special handling for UserIntent nodes
    if (node.type === 'UserIntent') {
      const params = node.parameters as UserIntentNodeParameters;
      const flowParams = (params.parameters ?? []) as FlowParameter[];
      outputSchema = createUserIntentOutputSchema(flowParams);
      outputState = 'defined';
    }

    return {
      nodeId: node.id,
      nodeType: node.type,
      inputState,
      inputSchema,
      outputState,
      outputSchema,
    };
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
