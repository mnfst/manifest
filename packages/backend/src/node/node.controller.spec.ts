/**
 * Unit tests for NodeController
 *
 * Tests HTTP endpoint behavior with mocked NodeService.
 * No database connections are made - all service calls are mocked.
 *
 * Test organization:
 * - Each endpoint has its own describe block
 * - Tests verify proper delegation to service methods
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NodeController } from './node.controller';
import { NodeService } from './node.service';
import {
  createMockNodeInstance,
  createMockConnection,
  createMockCreateNodeRequest,
  createMockUpdateNodeRequest,
  createMockCreateConnectionRequest,
  createMockInsertTransformerRequest,
  createMockTestTransformRequest,
} from './test/fixtures';

describe('NodeController', () => {
  let controller: NodeController;
  let mockService: {
    getNodes: jest.Mock;
    addNode: jest.Mock;
    updateNode: jest.Mock;
    updateNodePosition: jest.Mock;
    deleteNode: jest.Mock;
    getConnections: jest.Mock;
    addConnection: jest.Mock;
    deleteConnection: jest.Mock;
    insertTransformer: jest.Mock;
    testTransform: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      getNodes: jest.fn(),
      addNode: jest.fn(),
      updateNode: jest.fn(),
      updateNodePosition: jest.fn(),
      deleteNode: jest.fn(),
      getConnections: jest.fn(),
      addConnection: jest.fn(),
      deleteConnection: jest.fn(),
      insertTransformer: jest.fn(),
      testTransform: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NodeController],
      providers: [
        {
          provide: NodeService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<NodeController>(NodeController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================================
  // Tests for GET /flows/:flowId/nodes
  // ============================================================
  describe('getNodes', () => {
    it('should return nodes from service', async () => {
      const nodes = [
        createMockNodeInstance({ id: '1' }),
        createMockNodeInstance({ id: '2' }),
      ];
      mockService.getNodes.mockResolvedValue(nodes);

      const result = await controller.getNodes('flow-id');

      expect(result).toEqual(nodes);
      expect(mockService.getNodes).toHaveBeenCalledWith('flow-id');
    });

    it('should return empty array when no nodes', async () => {
      mockService.getNodes.mockResolvedValue([]);

      const result = await controller.getNodes('flow-id');

      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // Tests for POST /flows/:flowId/nodes
  // ============================================================
  describe('createNode', () => {
    it('should create node via service', async () => {
      const request = createMockCreateNodeRequest();
      const createdNode = createMockNodeInstance({ name: request.name });
      mockService.addNode.mockResolvedValue(createdNode);

      const result = await controller.createNode('flow-id', request);

      expect(result).toEqual(createdNode);
      expect(mockService.addNode).toHaveBeenCalledWith('flow-id', request);
    });
  });

  // ============================================================
  // Tests for PATCH /flows/:flowId/nodes/:nodeId
  // ============================================================
  describe('updateNode', () => {
    it('should update node via service', async () => {
      const request = createMockUpdateNodeRequest({ name: 'Updated' });
      const updatedNode = createMockNodeInstance({ name: 'Updated' });
      mockService.updateNode.mockResolvedValue(updatedNode);

      const result = await controller.updateNode('flow-id', 'node-id', request);

      expect(result).toEqual(updatedNode);
      expect(mockService.updateNode).toHaveBeenCalledWith(
        'flow-id',
        'node-id',
        request,
      );
    });
  });

  // ============================================================
  // Tests for PATCH /flows/:flowId/nodes/:nodeId/position
  // ============================================================
  describe('updateNodePosition', () => {
    it('should update node position via service', async () => {
      const position = { x: 300, y: 400 };
      const updatedNode = createMockNodeInstance({ position });
      mockService.updateNodePosition.mockResolvedValue(updatedNode);

      const result = await controller.updateNodePosition(
        'flow-id',
        'node-id',
        position,
      );

      expect(result).toEqual(updatedNode);
      expect(mockService.updateNodePosition).toHaveBeenCalledWith(
        'flow-id',
        'node-id',
        position,
      );
    });
  });

  // ============================================================
  // Tests for DELETE /flows/:flowId/nodes/:nodeId
  // ============================================================
  describe('deleteNode', () => {
    it('should delete node via service', async () => {
      mockService.deleteNode.mockResolvedValue(undefined);

      await controller.deleteNode('flow-id', 'node-id');

      expect(mockService.deleteNode).toHaveBeenCalledWith('flow-id', 'node-id');
    });
  });

  // ============================================================
  // Tests for GET /flows/:flowId/connections
  // ============================================================
  describe('getConnections', () => {
    it('should return connections from service', async () => {
      const connections = [
        createMockConnection({ id: 'c1' }),
        createMockConnection({ id: 'c2' }),
      ];
      mockService.getConnections.mockResolvedValue(connections);

      const result = await controller.getConnections('flow-id');

      expect(result).toEqual(connections);
      expect(mockService.getConnections).toHaveBeenCalledWith('flow-id');
    });
  });

  // ============================================================
  // Tests for POST /flows/:flowId/connections
  // ============================================================
  describe('createConnection', () => {
    it('should create connection via service', async () => {
      const request = createMockCreateConnectionRequest();
      const createdConnection = createMockConnection({
        sourceNodeId: request.sourceNodeId,
        targetNodeId: request.targetNodeId,
      });
      mockService.addConnection.mockResolvedValue(createdConnection);

      const result = await controller.createConnection('flow-id', request);

      expect(result).toEqual(createdConnection);
      expect(mockService.addConnection).toHaveBeenCalledWith(
        'flow-id',
        request,
      );
    });
  });

  // ============================================================
  // Tests for DELETE /flows/:flowId/connections/:connectionId
  // ============================================================
  describe('deleteConnection', () => {
    it('should delete connection via service', async () => {
      mockService.deleteConnection.mockResolvedValue(undefined);

      await controller.deleteConnection('flow-id', 'conn-id');

      expect(mockService.deleteConnection).toHaveBeenCalledWith(
        'flow-id',
        'conn-id',
      );
    });
  });

  // ============================================================
  // Tests for POST /flows/:flowId/transformers/insert
  // ============================================================
  describe('insertTransformer', () => {
    it('should insert transformer via service', async () => {
      const request = createMockInsertTransformerRequest();
      const response = {
        transformerNode: createMockNodeInstance({ type: 'JsTransform' }),
        sourceConnection: createMockConnection({ id: 'src-conn' }),
        targetConnection: createMockConnection({ id: 'tgt-conn' }),
      };
      mockService.insertTransformer.mockResolvedValue(response);

      const result = await controller.insertTransformer('flow-id', request);

      expect(result).toEqual(response);
      expect(mockService.insertTransformer).toHaveBeenCalledWith(
        'flow-id',
        request,
      );
    });
  });

  // ============================================================
  // Tests for POST /flows/:flowId/transformers/test
  // ============================================================
  describe('testTransform', () => {
    it('should test transform via service', () => {
      const request = createMockTestTransformRequest();
      const response = {
        success: true,
        output: { result: 10 },
        outputSchema: { type: 'object' },
        executionTimeMs: 5,
      };
      mockService.testTransform.mockReturnValue(response);

      const result = controller.testTransform(request);

      expect(result).toEqual(response);
      expect(mockService.testTransform).toHaveBeenCalledWith(request);
    });

    it('should return error response for failed transform', () => {
      const request = createMockTestTransformRequest({ code: 'invalid' });
      const response = {
        success: false,
        error: 'Syntax error',
        executionTimeMs: 1,
      };
      mockService.testTransform.mockReturnValue(response);

      const result = controller.testTransform(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Syntax error');
    });
  });
});
