import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlowEntity } from '../../flow/flow.entity';
import {
  builtInNodeList,
  type NodeTypeDefinition,
} from '@manifest/nodes';
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
  type HeaderEntry,
  type RegistryNodeParameters,
  type FlowParameter,
  type SuggestedTransformer,
  type CompatibilityStatus,
  type TestApiCallRequest,
  type TestApiCallResponse,
} from '@manifest/shared';

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
        const params = (node.parameters ?? {}) as unknown as ApiCallNodeParameters;
        params.resolvedOutputSchema = outputSchema;
        node.parameters = params as unknown as Record<string, unknown>;

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

  /**
   * Test an ApiCall node by executing the actual HTTP request.
   * Returns full response with inferred schema.
   */
  async testApiRequest(
    flowId: string,
    nodeId: string,
    request: TestApiCallRequest
  ): Promise<TestApiCallResponse> {
    const flow = await this.findFlow(flowId);
    const nodes = flow.nodes ?? [];
    const node = nodes.find((n) => n.id === nodeId);

    if (!node) {
      throw new NotFoundException(
        `Node with id ${nodeId} not found in flow ${flowId}`
      );
    }

    if (node.type !== 'ApiCall') {
      throw new BadRequestException(
        `Node ${nodeId} is not an ApiCall node (type: ${node.type})`
      );
    }

    const params = node.parameters as unknown as ApiCallNodeParameters;
    const method = params.method || 'GET';
    const rawUrl = params.url || '';
    const rawHeaders = (params.headers as HeaderEntry[]) || [];
    const timeout = params.timeout || 30000;

    // Validate URL
    if (!rawUrl || !rawUrl.trim()) {
      return {
        success: false,
        error: 'URL is required. Configure the URL in the node settings.',
      };
    }

    // Resolve template variables in URL
    const { resolved: resolvedUrl, unresolvedVars: urlVars } =
      this.resolveTemplateVariables(rawUrl, request.mockValues);

    // Resolve template variables in headers
    const resolvedHeaders: Record<string, string> = {};
    const headerUnresolvedVars: string[] = [];

    for (const header of rawHeaders) {
      if (header.key && header.value) {
        const { resolved, unresolvedVars } =
          this.resolveTemplateVariables(header.value, request.mockValues);
        resolvedHeaders[header.key] = resolved;
        headerUnresolvedVars.push(...unresolvedVars);
      }
    }

    // Check for unresolved variables
    const allUnresolvedVars = [...urlVars, ...headerUnresolvedVars];
    if (allUnresolvedVars.length > 0) {
      const uniqueVars = [...new Set(allUnresolvedVars)];
      return {
        success: false,
        error: `Unresolved template variables: ${uniqueVars.join(', ')}. Provide mock values or configure upstream nodes.`,
      };
    }

    // Validate URL format
    try {
      new URL(resolvedUrl);
    } catch {
      return {
        success: false,
        error: `Invalid URL: ${resolvedUrl}`,
        requestUrl: resolvedUrl,
      };
    }

    // Add warning for mutating methods
    const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    const warning = mutatingMethods.includes(method.toUpperCase())
      ? `This is a ${method} request and may modify data on the external server.`
      : undefined;

    const startTime = Date.now();

    try {
      // Setup timeout with AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Execute the HTTP request
      const response = await fetch(resolvedUrl, {
        method,
        headers: resolvedHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Parse response body
      let body: unknown;
      const contentType = response.headers.get('content-type') || '';
      const responseText = await response.text();

      if (contentType.includes('application/json') && responseText) {
        try {
          body = JSON.parse(responseText);
        } catch {
          body = responseText;
        }
      } else {
        body = responseText;
      }

      // Build output structure with dynamic fields only
      // (type, status, statusText are static and already defined in ApiCallNode schema)
      const dynamicOutput = {
        headers: responseHeaders,
        body,
      };

      // Infer schema from the dynamic fields
      const outputSchema = inferSchemaFromSample(dynamicOutput);

      // Optionally save schema to node
      let schemaSaved = false;
      if (request.saveSchema) {
        params.resolvedOutputSchema = outputSchema;
        node.parameters = params as unknown as Record<string, unknown>;
        flow.nodes = nodes;
        await this.flowRepository.save(flow);
        schemaSaved = true;
      }

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body,
        outputSchema,
        executionTimeMs: Date.now() - startTime,
        warning,
        schemaSaved,
        requestUrl: resolvedUrl,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: `Request timed out after ${timeout}ms`,
            executionTimeMs,
            warning,
            requestUrl: resolvedUrl,
          };
        }
        return {
          success: false,
          error: `Network error: ${error.message}`,
          executionTimeMs,
          warning,
          requestUrl: resolvedUrl,
        };
      }

      return {
        success: false,
        error: 'An unknown error occurred',
        executionTimeMs,
        warning,
        requestUrl: resolvedUrl,
      };
    }
  }

  /**
   * Resolve template variables in a string using mock values.
   * Returns the resolved string and list of unresolved variable names.
   */
  private resolveTemplateVariables(
    template: string,
    mockValues?: Record<string, unknown>
  ): { resolved: string; unresolvedVars: string[] } {
    const unresolvedVars: string[] = [];

    // Match {{nodeSlug.path.to.field}} or {{nodeSlug}}
    const resolved = template.replace(/\{\{([^}]+)\}\}/g, (match, varPath) => {
      const parts = varPath.trim().split('.');
      const rootKey = parts[0];

      if (!mockValues || !(rootKey in mockValues)) {
        unresolvedVars.push(varPath);
        return match; // Keep original placeholder
      }

      // Navigate the path
      let value: unknown = mockValues[rootKey];
      for (let i = 1; i < parts.length && value != null; i++) {
        if (typeof value === 'object' && value !== null) {
          value = (value as Record<string, unknown>)[parts[i]];
        } else {
          value = undefined;
        }
      }

      if (value === undefined || value === null) {
        unresolvedVars.push(varPath);
        return match;
      }

      return String(value);
    });

    return { resolved, unresolvedVars };
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

        switch (result.status) {
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
      const params = node.parameters as unknown as ApiCallNodeParameters;
      if (params.resolvedOutputSchema) {
        // Merge resolved schema (headers, body) with base ApiCall schema (static fields)
        const baseSchema = nodeDef?.getOutputSchema?.() ?? { type: 'object', properties: {} };
        const resolvedProps = (params.resolvedOutputSchema as JSONSchema).properties ?? {};
        outputSchema = {
          ...baseSchema,
          properties: {
            ...((baseSchema as { properties?: Record<string, unknown> }).properties ?? {}),
            ...resolvedProps,
          },
        } as JSONSchema;
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
