import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
  inferSchemaFromSample,
  type JSONSchema,
  type NodeSchemaInfo,
  type SchemaState,
  type ValidateConnectionRequest,
  type ValidateConnectionResponse,
  type ResolveSchemaRequest,
  type ResolveSchemaResponse,
  type FlowValidationResponse,
  type ConnectionValidationResult,
  type NodeValidationError,
  type NodeInstance,
  type UserIntentNodeParameters,
  type ApiCallNodeParameters,
  type RegistryNodeParameters,
  type FlowParameter,
  type SuggestedTransformer,
  type CompatibilityStatus,
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
  // Dynamic Schema Resolution
  // ==========================================================================

  /**
   * Resolve dynamic schema for a node by inferring from sample data.
   * For ApiCall nodes: infers output schema from a sample API response.
   * For UserIntent nodes: computes output schema from parameters (already handled in resolveNodeSchema).
   */
  async resolveSchema(
    flowId: string,
    nodeId: string,
    request: ResolveSchemaRequest
  ): Promise<ResolveSchemaResponse> {
    const flow = await this.findFlow(flowId);
    const nodes = flow.nodes ?? [];
    const nodeIndex = nodes.findIndex((n) => n.id === nodeId);

    if (nodeIndex === -1) {
      throw new NotFoundException(
        `Node with id ${nodeId} not found in flow ${flowId}`
      );
    }

    const node = nodes[nodeIndex];

    // Handle ApiCall nodes - infer schema from sample response
    if (node.type === 'ApiCall') {
      if (!request.sampleResponse) {
        throw new BadRequestException(
          'sampleResponse is required for ApiCall schema resolution'
        );
      }

      try {
        // Parse sample response if it's a string
        let sampleData: unknown;
        if (typeof request.sampleResponse === 'string') {
          try {
            sampleData = JSON.parse(request.sampleResponse);
          } catch {
            throw new BadRequestException(
              'sampleResponse must be valid JSON'
            );
          }
        } else {
          sampleData = request.sampleResponse;
        }

        // Infer schema from sample
        const outputSchema = inferSchemaFromSample(sampleData);

        // Store resolved schema in node parameters
        const params = (node.parameters ?? {}) as ApiCallNodeParameters;
        params.resolvedOutputSchema = outputSchema;
        node.parameters = params;

        // Save updated flow
        flow.nodes = nodes;
        await this.flowRepository.save(flow);

        return {
          nodeId,
          resolved: true,
          outputSchema,
        };
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        return {
          nodeId,
          resolved: false,
          outputSchema: null,
          error: error instanceof Error ? error.message : 'Failed to resolve schema',
        };
      }
    }

    // Handle UserIntent nodes - compute from parameters
    if (node.type === 'UserIntent') {
      const params = node.parameters as UserIntentNodeParameters;
      const flowParams = (params.parameters ?? []) as FlowParameter[];
      const outputSchema = createUserIntentOutputSchema(flowParams);

      return {
        nodeId,
        resolved: true,
        outputSchema,
      };
    }

    // For other node types, return the static schema
    const schemaInfo = this.resolveNodeSchema(node);
    return {
      nodeId,
      resolved: schemaInfo.outputState === 'defined',
      outputSchema: schemaInfo.outputSchema,
    };
  }

  // ==========================================================================
  // Connection Validation
  // ==========================================================================

  /**
   * Validate all connections in a flow.
   * Returns summary and individual connection results.
   */
  async validateFlowConnections(flowId: string): Promise<FlowValidationResponse> {
    const flow = await this.findFlow(flowId);
    const nodes = flow.nodes ?? [];
    const connections = flow.connections ?? [];

    // Build node map for efficient lookup
    const nodeMap = new Map<string, NodeInstance>();
    nodes.forEach((node) => nodeMap.set(node.id, node));

    // Build schema map for all nodes
    const schemaMap = new Map<string, NodeSchemaInfo>();
    nodes.forEach((node) => {
      schemaMap.set(node.id, this.resolveNodeSchema(node));
    });

    // Validate each connection
    const results: ConnectionValidationResult[] = [];
    let compatibleCount = 0;
    let warningsCount = 0;
    let errorsCount = 0;
    let unknownCount = 0;

    // Build set of nodes that have incoming connections
    const nodesWithIncomingConnections = new Set<string>();
    for (const connection of connections) {
      nodesWithIncomingConnections.add(connection.targetNodeId);
    }

    for (const connection of connections) {
      const sourceSchema = schemaMap.get(connection.sourceNodeId);
      const targetSchema = schemaMap.get(connection.targetNodeId);

      if (!sourceSchema || !targetSchema) {
        results.push({
          connectionId: connection.id,
          sourceNodeId: connection.sourceNodeId,
          targetNodeId: connection.targetNodeId,
          status: 'unknown',
          issues: [],
        });
        unknownCount++;
        continue;
      }

      const result = checkSchemaCompatibility(
        sourceSchema.outputSchema,
        targetSchema.inputSchema
      );

      // Check Link node source constraint: Link nodes can only follow interface category nodes
      const targetNode = nodeMap.get(connection.targetNodeId);
      const sourceNode = nodeMap.get(connection.sourceNodeId);
      let linkConstraintError = false;

      if (targetNode?.type === 'Link') {
        const sourceNodeDef = this.nodeTypeMap.get(sourceNode?.type ?? '');
        if (sourceNodeDef && sourceNodeDef.category !== 'interface') {
          results.push({
            connectionId: connection.id,
            sourceNodeId: connection.sourceNodeId,
            targetNodeId: connection.targetNodeId,
            status: 'error',
            issues: [{
              type: 'type-mismatch',
              message: `Link nodes can only be connected after UI nodes (interface category). "${sourceNodeDef.displayName}" is a ${sourceNodeDef.category} node.`,
              sourcePath: '',
              targetPath: '',
            }],
          });
          errorsCount++;
          linkConstraintError = true;
        }
      }

      if (!linkConstraintError) {
        results.push({
          connectionId: connection.id,
          sourceNodeId: connection.sourceNodeId,
          targetNodeId: connection.targetNodeId,
          status: result.status,
          issues: result.issues,
        });
      }

      switch (linkConstraintError ? 'error' : result.status) {
        case 'compatible':
          compatibleCount++;
          break;
        case 'warning':
          warningsCount++;
          break;
        case 'error':
          errorsCount++;
          break;
        case 'unknown':
          unknownCount++;
          break;
      }
    }

    // Validate transform nodes have input connections
    const nodeErrors: NodeValidationError[] = [];
    for (const node of nodes) {
      const nodeDef = this.nodeTypeMap.get(node.type);
      if (nodeDef?.category === 'transform' && !nodesWithIncomingConnections.has(node.id)) {
        nodeErrors.push({
          nodeId: node.id,
          nodeType: node.type,
          errorCode: 'TRANSFORM_NO_INPUT',
          message: `Transform node "${nodeDef.displayName}" requires an input connection`,
        });
      }
    }

    // Determine overall status
    let overallStatus: 'valid' | 'warnings' | 'errors' = 'valid';
    if (errorsCount > 0 || nodeErrors.length > 0) {
      overallStatus = 'errors';
    } else if (warningsCount > 0) {
      overallStatus = 'warnings';
    }

    return {
      flowId,
      status: overallStatus,
      summary: {
        total: connections.length,
        compatible: compatibleCount,
        warnings: warningsCount,
        errors: errorsCount,
        unknown: unknownCount,
      },
      connections: results,
      nodeErrors: nodeErrors.length > 0 ? nodeErrors : undefined,
    };
  }

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

    // Get suggested transformers if there are compatibility issues
    const suggestedTransformers = this.getSuggestedTransformers(result.status);

    return {
      status: result.status,
      issues: result.issues,
      sourceSchema: result.sourceSchema,
      targetSchema: result.targetSchema,
      suggestedTransformers,
    };
  }

  /**
   * Get suggested transformers based on compatibility status.
   * Returns transform nodes that could potentially resolve incompatibility issues.
   */
  private getSuggestedTransformers(
    status: CompatibilityStatus
  ): SuggestedTransformer[] | undefined {
    // Only suggest transformers for error or warning status
    if (status !== 'error' && status !== 'warning') {
      return undefined;
    }

    // Find all transform category nodes
    const transformers: SuggestedTransformer[] = [];

    for (const nodeDef of builtInNodeList) {
      if (nodeDef.category === 'transform') {
        transformers.push({
          nodeType: nodeDef.name,
          displayName: nodeDef.displayName,
          description: nodeDef.description,
          // JavaScript Code Transform is highly flexible and can handle most transformations
          confidence: nodeDef.name === 'JavaScriptCodeTransform' ? 'high' : 'medium',
        });
      }
    }

    return transformers.length > 0 ? transformers : undefined;
  }

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  /**
   * Resolve the input and output schemas for a node instance.
   * Uses dynamic schema functions when available, falling back to static schemas.
   */
  private resolveNodeSchema(node: NodeInstance): NodeSchemaInfo {
    // Special handling for RegistryComponent nodes - use stored inputSchema from demo data
    // Handle this BEFORE the nodeDef check since RegistryComponent is not in the built-in node map
    if (node.type === 'RegistryComponent') {
      const params = node.parameters as RegistryNodeParameters;
      return {
        nodeId: node.id,
        nodeType: node.type,
        inputState: params.inputSchema ? 'defined' : 'unknown',
        inputSchema: params.inputSchema ?? null,
        // RegistryComponent outputs are typically the same as inputs (pass-through with UI rendering)
        outputState: 'defined',
        outputSchema: { type: 'object', additionalProperties: true },
      };
    }

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

    // Special handling for ApiCall nodes with resolved schema
    if (node.type === 'ApiCall') {
      const params = node.parameters as ApiCallNodeParameters;
      if (params.resolvedOutputSchema) {
        outputSchema = params.resolvedOutputSchema;
        outputState = 'defined';
      } else {
        // No resolved schema yet - mark as pending (can be discovered)
        outputState = 'pending';
      }
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
