/**
 * Unit tests for SchemaController
 *
 * Tests HTTP endpoint behavior with mocked SchemaService.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SchemaController } from './schema.controller';
import { SchemaService } from './schema.service';
import type {
  NodeSchemaInfo,
  FlowValidationResponse,
  ResolveSchemaResponse,
  ValidateConnectionResponse,
} from '@chatgpt-app-builder/shared';

describe('SchemaController', () => {
  let controller: SchemaController;
  let mockService: {
    getNodeSchema: jest.Mock;
    getNodeTypeSchema: jest.Mock;
    resolveSchema: jest.Mock;
    validateFlowConnections: jest.Mock;
    getFlowSchemas: jest.Mock;
    validateConnection: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      getNodeSchema: jest.fn(),
      getNodeTypeSchema: jest.fn(),
      resolveSchema: jest.fn(),
      validateFlowConnections: jest.fn(),
      getFlowSchemas: jest.fn(),
      validateConnection: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchemaController],
      providers: [
        {
          provide: SchemaService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<SchemaController>(SchemaController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================================
  // Tests for GET /flows/:flowId/nodes/:nodeId/schema
  // ============================================================
  describe('getNodeSchema', () => {
    const mockSchemaInfo: NodeSchemaInfo = {
      nodeId: 'node-1',
      nodeType: 'ApiCall',
      inputState: 'defined',
      inputSchema: { type: 'object' },
      outputState: 'pending',
      outputSchema: null,
    };

    it('should return node schema info', async () => {
      mockService.getNodeSchema.mockResolvedValue(mockSchemaInfo);

      const result = await controller.getNodeSchema('flow-id', 'node-id');

      expect(result).toEqual(mockSchemaInfo);
      expect(mockService.getNodeSchema).toHaveBeenCalledWith('flow-id', 'node-id');
    });

    it('should pass correct parameters to service', async () => {
      mockService.getNodeSchema.mockResolvedValue(mockSchemaInfo);

      await controller.getNodeSchema('my-flow', 'my-node');

      expect(mockService.getNodeSchema).toHaveBeenCalledWith('my-flow', 'my-node');
    });
  });

  // ============================================================
  // Tests for GET /node-types/:nodeType/schema
  // ============================================================
  describe('getNodeTypeSchema', () => {
    const mockTypeSchema = {
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      hasDynamicInput: false,
      hasDynamicOutput: true,
    };

    it('should return node type schema with nodeType', () => {
      mockService.getNodeTypeSchema.mockReturnValue(mockTypeSchema);

      const result = controller.getNodeTypeSchema('ApiCall');

      expect(result).toEqual({
        nodeType: 'ApiCall',
        ...mockTypeSchema,
      });
      expect(mockService.getNodeTypeSchema).toHaveBeenCalledWith('ApiCall');
    });

    it('should pass correct nodeType to service', () => {
      mockService.getNodeTypeSchema.mockReturnValue(mockTypeSchema);

      controller.getNodeTypeSchema('UserIntent');

      expect(mockService.getNodeTypeSchema).toHaveBeenCalledWith('UserIntent');
    });
  });

  // ============================================================
  // Tests for POST /flows/:flowId/nodes/:nodeId/schema/resolve
  // ============================================================
  describe('resolveSchema', () => {
    const mockResolveResponse: ResolveSchemaResponse = {
      nodeId: 'node-1',
      resolved: true,
      outputSchema: { type: 'object', properties: { data: { type: 'string' } } },
    };

    it('should resolve schema and return response', async () => {
      mockService.resolveSchema.mockResolvedValue(mockResolveResponse);
      const request = { sampleResponse: { data: 'test' } };

      const result = await controller.resolveSchema('flow-id', 'node-id', request);

      expect(result).toEqual(mockResolveResponse);
      expect(mockService.resolveSchema).toHaveBeenCalledWith('flow-id', 'node-id', request);
    });

    it('should pass all parameters correctly', async () => {
      mockService.resolveSchema.mockResolvedValue(mockResolveResponse);
      const request = { sampleResponse: '{"key": "value"}' };

      await controller.resolveSchema('my-flow', 'my-node', request);

      expect(mockService.resolveSchema).toHaveBeenCalledWith('my-flow', 'my-node', request);
    });
  });

  // ============================================================
  // Tests for GET /flows/:flowId/connections/validate
  // ============================================================
  describe('validateFlowConnections', () => {
    const mockValidationResponse: FlowValidationResponse = {
      flowId: 'flow-id',
      status: 'valid',
      summary: {
        total: 2,
        compatible: 2,
        warnings: 0,
        errors: 0,
        unknown: 0,
      },
      connections: [],
    };

    it('should return flow validation response', async () => {
      mockService.validateFlowConnections.mockResolvedValue(mockValidationResponse);

      const result = await controller.validateFlowConnections('flow-id');

      expect(result).toEqual(mockValidationResponse);
      expect(mockService.validateFlowConnections).toHaveBeenCalledWith('flow-id');
    });

    it('should pass flowId to service', async () => {
      mockService.validateFlowConnections.mockResolvedValue(mockValidationResponse);

      await controller.validateFlowConnections('another-flow');

      expect(mockService.validateFlowConnections).toHaveBeenCalledWith('another-flow');
    });
  });

  // ============================================================
  // Tests for GET /flows/:flowId/schemas
  // ============================================================
  describe('getFlowSchemas', () => {
    const mockSchemas: NodeSchemaInfo[] = [
      {
        nodeId: 'node-1',
        nodeType: 'UserIntent',
        inputState: 'unknown',
        inputSchema: null,
        outputState: 'defined',
        outputSchema: { type: 'object' },
      },
      {
        nodeId: 'node-2',
        nodeType: 'ApiCall',
        inputState: 'defined',
        inputSchema: { type: 'object' },
        outputState: 'pending',
        outputSchema: null,
      },
    ];

    it('should return flow schemas response', async () => {
      mockService.getFlowSchemas.mockResolvedValue(mockSchemas);

      const result = await controller.getFlowSchemas('flow-id');

      expect(result).toEqual({
        flowId: 'flow-id',
        nodes: mockSchemas,
      });
      expect(mockService.getFlowSchemas).toHaveBeenCalledWith('flow-id');
    });

    it('should return empty nodes for flow with no nodes', async () => {
      mockService.getFlowSchemas.mockResolvedValue([]);

      const result = await controller.getFlowSchemas('empty-flow');

      expect(result).toEqual({
        flowId: 'empty-flow',
        nodes: [],
      });
    });
  });

  // ============================================================
  // Tests for POST /flows/:flowId/connections/validate
  // ============================================================
  describe('validateConnection', () => {
    const mockConnectionResponse: ValidateConnectionResponse = {
      status: 'compatible',
      issues: [],
      sourceSchema: { type: 'object' },
      targetSchema: { type: 'object' },
    };

    it('should validate connection and return response', async () => {
      mockService.validateConnection.mockResolvedValue(mockConnectionResponse);
      const request = { sourceNodeId: 'node-1', targetNodeId: 'node-2' };

      const result = await controller.validateConnection('flow-id', request);

      expect(result).toEqual(mockConnectionResponse);
      expect(mockService.validateConnection).toHaveBeenCalledWith('flow-id', request);
    });

    it('should pass all parameters to service', async () => {
      mockService.validateConnection.mockResolvedValue(mockConnectionResponse);
      const request = { sourceNodeId: 'source', targetNodeId: 'target' };

      await controller.validateConnection('my-flow', request);

      expect(mockService.validateConnection).toHaveBeenCalledWith('my-flow', request);
    });

    it('should return suggested transformers when present', async () => {
      const responseWithTransformers: ValidateConnectionResponse = {
        ...mockConnectionResponse,
        status: 'error',
        suggestedTransformers: [
          {
            nodeType: 'JavaScriptCodeTransform',
            displayName: 'JavaScript Transform',
            description: 'Transform data with JavaScript',
            confidence: 'high',
          },
        ],
      };
      mockService.validateConnection.mockResolvedValue(responseWithTransformers);

      const result = await controller.validateConnection('flow-id', {
        sourceNodeId: 'a',
        targetNodeId: 'b',
      });

      expect(result.suggestedTransformers).toBeDefined();
      expect(result.suggestedTransformers).toHaveLength(1);
    });
  });
});
