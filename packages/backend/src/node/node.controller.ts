import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NodeService } from './node.service';
import type {
  NodeInstance,
  Connection,
  CreateNodeRequest,
  UpdateNodeRequest,
  UpdateNodePositionRequest,
  CreateConnectionRequest,
  InsertTransformerRequest,
  InsertTransformerResponse,
  TestTransformRequest,
  TestTransformResponse,
} from '@chatgpt-app-builder/shared';

/**
 * Controller for Node and Connection REST endpoints.
 * All routes are nested under /api/flows/:flowId/
 */
@Controller('api/flows/:flowId')
export class NodeController {
  constructor(private readonly nodeService: NodeService) {}

  // ==========================================================================
  // Node Endpoints (T035-T039)
  // ==========================================================================

  /**
   * T035: GET /flows/:flowId/nodes
   * Get all nodes in a flow.
   */
  @Get('nodes')
  async getNodes(@Param('flowId') flowId: string): Promise<NodeInstance[]> {
    return this.nodeService.getNodes(flowId);
  }

  /**
   * T036: POST /flows/:flowId/nodes
   * Create a new node in a flow.
   */
  @Post('nodes')
  async createNode(
    @Param('flowId') flowId: string,
    @Body() request: CreateNodeRequest
  ): Promise<NodeInstance> {
    return this.nodeService.addNode(flowId, request);
  }

  /**
   * T037: PATCH /flows/:flowId/nodes/:nodeId
   * Update a node (name, parameters).
   */
  @Patch('nodes/:nodeId')
  async updateNode(
    @Param('flowId') flowId: string,
    @Param('nodeId') nodeId: string,
    @Body() request: UpdateNodeRequest
  ): Promise<NodeInstance> {
    return this.nodeService.updateNode(flowId, nodeId, request);
  }

  /**
   * T038: PATCH /flows/:flowId/nodes/:nodeId/position
   * Update only the position of a node (optimized endpoint).
   */
  @Patch('nodes/:nodeId/position')
  async updateNodePosition(
    @Param('flowId') flowId: string,
    @Param('nodeId') nodeId: string,
    @Body() position: UpdateNodePositionRequest
  ): Promise<NodeInstance> {
    return this.nodeService.updateNodePosition(flowId, nodeId, position);
  }

  /**
   * T039: DELETE /flows/:flowId/nodes/:nodeId
   * Delete a node and its connections.
   */
  @Delete('nodes/:nodeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNode(
    @Param('flowId') flowId: string,
    @Param('nodeId') nodeId: string
  ): Promise<void> {
    return this.nodeService.deleteNode(flowId, nodeId);
  }

  // ==========================================================================
  // Connection Endpoints (T040-T042)
  // ==========================================================================

  /**
   * T040: GET /flows/:flowId/connections
   * Get all connections in a flow.
   */
  @Get('connections')
  async getConnections(@Param('flowId') flowId: string): Promise<Connection[]> {
    return this.nodeService.getConnections(flowId);
  }

  /**
   * T041: POST /flows/:flowId/connections
   * Create a new connection between nodes.
   */
  @Post('connections')
  async createConnection(
    @Param('flowId') flowId: string,
    @Body() request: CreateConnectionRequest
  ): Promise<Connection> {
    return this.nodeService.addConnection(flowId, request);
  }

  /**
   * T042: DELETE /flows/:flowId/connections/:connectionId
   * Delete a connection.
   */
  @Delete('connections/:connectionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConnection(
    @Param('flowId') flowId: string,
    @Param('connectionId') connectionId: string
  ): Promise<void> {
    return this.nodeService.deleteConnection(flowId, connectionId);
  }

  // ==========================================================================
  // Transformer Endpoints (T011)
  // ==========================================================================

  /**
   * T011: POST /flows/:flowId/transformers/insert
   * Insert a transformer node between two connected nodes.
   * - Removes the existing connection between source and target
   * - Creates transformer node at midpoint position
   * - Creates two new connections (source→transformer, transformer→target)
   */
  @Post('transformers/insert')
  async insertTransformer(
    @Param('flowId') flowId: string,
    @Body() request: InsertTransformerRequest
  ): Promise<InsertTransformerResponse> {
    return this.nodeService.insertTransformer(flowId, request);
  }

  /**
   * T020: POST /flows/:flowId/transformers/test
   * Test a JavaScript transform with sample input.
   * - Executes code using Function constructor
   * - Returns output and inferred schema
   * - Handles errors gracefully
   */
  @Post('transformers/test')
  testTransform(
    @Body() request: TestTransformRequest
  ): TestTransformResponse {
    return this.nodeService.testTransform(request);
  }
}
