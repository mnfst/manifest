import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { SchemaService } from './schema.service';
import type {
  NodeSchemaInfo,
  NodeTypeSchemaResponse,
  ValidateConnectionRequest,
  ValidateConnectionResponse,
  ResolveSchemaRequest,
  ResolveSchemaResponse,
  FlowValidationResponse,
  FlowSchemasResponse,
  TestApiCallRequest,
  TestApiCallResponse,
} from '@manifest/shared';

/**
 * Controller for Schema REST endpoints.
 * Provides endpoints for retrieving node schemas and validating connections.
 */
@Controller('api')
export class SchemaController {
  constructor(private readonly schemaService: SchemaService) {}

  // ==========================================================================
  // Node Schema Endpoints (T022, T023)
  // ==========================================================================

  /**
   * T022: GET /flows/:flowId/nodes/:nodeId/schema
   * Get schema information for a specific node instance.
   */
  @Get('flows/:flowId/nodes/:nodeId/schema')
  async getNodeSchema(
    @Param('flowId') flowId: string,
    @Param('nodeId') nodeId: string
  ): Promise<NodeSchemaInfo> {
    return this.schemaService.getNodeSchema(flowId, nodeId);
  }

  /**
   * T023: GET /node-types/:nodeType/schema
   * Get default schema information for a node type.
   */
  @Get('node-types/:nodeType/schema')
  getNodeTypeSchema(
    @Param('nodeType') nodeType: string
  ): NodeTypeSchemaResponse {
    const schemaInfo = this.schemaService.getNodeTypeSchema(nodeType);
    return {
      nodeType,
      ...schemaInfo,
    };
  }

  // ==========================================================================
  // Dynamic Schema Resolution Endpoints (T054)
  // ==========================================================================

  /**
   * T054: POST /flows/:flowId/nodes/:nodeId/schema/resolve
   * Resolve dynamic schema for a node by inferring from sample data.
   */
  @Post('flows/:flowId/nodes/:nodeId/schema/resolve')
  async resolveSchema(
    @Param('flowId') flowId: string,
    @Param('nodeId') nodeId: string,
    @Body() request: ResolveSchemaRequest
  ): Promise<ResolveSchemaResponse> {
    return this.schemaService.resolveSchema(flowId, nodeId, request);
  }

  /**
   * POST /flows/:flowId/nodes/:nodeId/test-request
   * Test an ApiCall node by executing the actual HTTP request.
   * Returns full response with inferred schema.
   */
  @Post('flows/:flowId/nodes/:nodeId/test-request')
  async testApiRequest(
    @Param('flowId') flowId: string,
    @Param('nodeId') nodeId: string,
    @Body() request: TestApiCallRequest
  ): Promise<TestApiCallResponse> {
    return this.schemaService.testApiRequest(flowId, nodeId, request);
  }

  // ==========================================================================
  // Flow-Level Validation Endpoints (T064, T065)
  // ==========================================================================

  /**
   * T064: GET /flows/:flowId/connections/validate
   * Validate all connections in a flow.
   */
  @Get('flows/:flowId/connections/validate')
  async validateFlowConnections(
    @Param('flowId') flowId: string
  ): Promise<FlowValidationResponse> {
    return this.schemaService.validateFlowConnections(flowId);
  }

  /**
   * T065: GET /flows/:flowId/schemas
   * Get schema information for all nodes in a flow.
   */
  @Get('flows/:flowId/schemas')
  async getFlowSchemas(
    @Param('flowId') flowId: string
  ): Promise<FlowSchemasResponse> {
    const schemas = await this.schemaService.getFlowSchemas(flowId);
    return {
      flowId,
      nodes: schemas,
    };
  }

  // ==========================================================================
  // Connection Validation Endpoints (T036, T040)
  // ==========================================================================

  /**
   * POST /flows/:flowId/connections/validate
   * Validate a single connection between two nodes.
   */
  @Post('flows/:flowId/connections/validate')
  async validateConnection(
    @Param('flowId') flowId: string,
    @Body() request: ValidateConnectionRequest
  ): Promise<ValidateConnectionResponse> {
    return this.schemaService.validateConnection(flowId, request);
  }
}
