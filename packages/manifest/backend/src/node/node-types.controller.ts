import { Controller, Get } from '@nestjs/common';
import { NodeService, NodeTypesResponse } from './node.service';

/**
 * Controller for Node Types API.
 * Provides metadata about available node types for the flow editor.
 */
@Controller('api/node-types')
export class NodeTypesController {
  constructor(private readonly nodeService: NodeService) {}

  /**
   * GET /api/node-types
   * Get all available node types with their metadata and categories.
   */
  @Get()
  getNodeTypes(): NodeTypesResponse {
    return this.nodeService.getNodeTypes();
  }
}
