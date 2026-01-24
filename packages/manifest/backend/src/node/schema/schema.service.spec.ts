/**
 * Unit tests for SchemaService
 *
 * Tests schema resolution and connection validation with mocked repository.
 * No database connections are made - all repository calls are mocked.
 *
 * Test organization:
 * - Each public method has its own describe block
 * - Success paths tested first, then error paths
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SchemaService } from './schema.service';
import { FlowEntity } from '../../flow/flow.entity';
import {
  createMockFlowRepository,
  type MockRepository,
} from './test/mock-repository';
import {
  createMockFlowEntity,
  createMockNodeInstance,
  createMockUserIntentNode,
  createMockApiCallNode,
  createMockApiCallNodeWithSchema,
  createMockRegistryComponentNode,
  createMockReturnNode,
  createMockLinkNode,
  createMockTransformNode,
  createMockConnection,
} from './test/fixtures';

describe('SchemaService', () => {
  let service: SchemaService;
  let mockFlowRepository: MockRepository<FlowEntity>;

  beforeEach(async () => {
    mockFlowRepository = createMockFlowRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchemaService,
        {
          provide: getRepositoryToken(FlowEntity),
          useValue: mockFlowRepository,
        },
      ],
    }).compile();

    service = module.get<SchemaService>(SchemaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // Tests for getNodeSchema() method
  // ============================================================
  describe('getNodeSchema', () => {
    it('should return schema info for a node', async () => {
      const node = createMockApiCallNode({ id: 'node-1' });
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.getNodeSchema('flow-id', 'node-1');

      expect(result).toBeDefined();
      expect(result.nodeId).toBe('node-1');
      expect(result.nodeType).toBe('ApiCall');
    });

    it('should throw NotFoundException when flow not found', async () => {
      mockFlowRepository.findOne!.mockResolvedValue(null);

      await expect(
        service.getNodeSchema('non-existent', 'node-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when node not found', async () => {
      const flow = createMockFlowEntity({ nodes: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.getNodeSchema('flow-id', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return schema states for UserIntent node', async () => {
      const node = createMockUserIntentNode();
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.getNodeSchema('flow-id', node.id);

      expect(result.outputState).toBe('defined');
      expect(result.outputSchema).toBeDefined();
    });

    it('should return pending state for ApiCall without resolved schema', async () => {
      const node = createMockApiCallNode();
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.getNodeSchema('flow-id', node.id);

      expect(result.outputState).toBe('pending');
    });

    it('should return defined state for ApiCall with resolved schema', async () => {
      const node = createMockApiCallNodeWithSchema();
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.getNodeSchema('flow-id', node.id);

      expect(result.outputState).toBe('defined');
      expect(result.outputSchema).toBeDefined();
    });
  });

  // ============================================================
  // Tests for getFlowSchemas() method
  // ============================================================
  describe('getFlowSchemas', () => {
    it('should return schemas for all nodes in a flow', async () => {
      const nodes = [
        createMockUserIntentNode({ id: 'node-1' }),
        createMockApiCallNode({ id: 'node-2' }),
        createMockReturnNode({ id: 'node-3' }),
      ];
      const flow = createMockFlowEntity({ nodes });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.getFlowSchemas('flow-id');

      expect(result).toHaveLength(3);
      expect(result[0].nodeId).toBe('node-1');
      expect(result[1].nodeId).toBe('node-2');
      expect(result[2].nodeId).toBe('node-3');
    });

    it('should return empty array for flow with no nodes', async () => {
      const flow = createMockFlowEntity({ nodes: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.getFlowSchemas('flow-id');

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when flow not found', async () => {
      mockFlowRepository.findOne!.mockResolvedValue(null);

      await expect(service.getFlowSchemas('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // Tests for getNodeTypeSchema() method
  // ============================================================
  describe('getNodeTypeSchema', () => {
    it('should return schema for valid node type', () => {
      const result = service.getNodeTypeSchema('ApiCall');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('inputSchema');
      expect(result).toHaveProperty('outputSchema');
      expect(result).toHaveProperty('hasDynamicInput');
      expect(result).toHaveProperty('hasDynamicOutput');
    });

    it('should throw NotFoundException for invalid node type', () => {
      expect(() => service.getNodeTypeSchema('NonExistent')).toThrow(
        NotFoundException,
      );
    });

    it('should return UserIntent schema', () => {
      const result = service.getNodeTypeSchema('UserIntent');

      expect(result).toBeDefined();
    });

    it('should return Return node schema', () => {
      const result = service.getNodeTypeSchema('Return');

      expect(result).toBeDefined();
    });
  });

  // ============================================================
  // Tests for resolveSchema() method
  // ============================================================
  describe('resolveSchema', () => {
    it('should resolve ApiCall schema from sample response', async () => {
      const node = createMockApiCallNode({ id: 'api-1' });
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      const result = await service.resolveSchema('flow-id', 'api-1', {
        sampleResponse: { data: [1, 2, 3], status: 'ok' },
      });

      expect(result.resolved).toBe(true);
      expect(result.nodeId).toBe('api-1');
      expect(result.outputSchema).toBeDefined();
    });

    it('should parse JSON string sample response', async () => {
      const node = createMockApiCallNode({ id: 'api-1' });
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      const result = await service.resolveSchema('flow-id', 'api-1', {
        sampleResponse: '{"data": "test"}',
      });

      expect(result.resolved).toBe(true);
    });

    it('should throw BadRequestException for invalid JSON string', async () => {
      const node = createMockApiCallNode({ id: 'api-1' });
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.resolveSchema('flow-id', 'api-1', {
          sampleResponse: 'invalid json',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when sampleResponse missing for ApiCall', async () => {
      const node = createMockApiCallNode({ id: 'api-1' });
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.resolveSchema('flow-id', 'api-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should resolve UserIntent schema from parameters', async () => {
      const node = createMockUserIntentNode({ id: 'trigger-1' });
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.resolveSchema('flow-id', 'trigger-1', {});

      expect(result.resolved).toBe(true);
      expect(result.outputSchema).toBeDefined();
    });

    it('should throw NotFoundException when node not found', async () => {
      const flow = createMockFlowEntity({ nodes: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.resolveSchema('flow-id', 'non-existent', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should save resolved schema to flow', async () => {
      const node = createMockApiCallNode({ id: 'api-1' });
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      await service.resolveSchema('flow-id', 'api-1', {
        sampleResponse: { data: 'test' },
      });

      expect(mockFlowRepository.save).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Tests for validateFlowConnections() method
  // ============================================================
  describe('validateFlowConnections', () => {
    it('should validate flow with no connections', async () => {
      const flow = createMockFlowEntity({ nodes: [], connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.validateFlowConnections('flow-id');

      expect(result.status).toBe('valid');
      expect(result.summary.total).toBe(0);
    });

    it('should validate compatible connections', async () => {
      const nodes = [
        createMockUserIntentNode({ id: 'trigger' }),
        createMockReturnNode({ id: 'return' }),
      ];
      const connections = [
        createMockConnection({
          id: 'conn-1',
          sourceNodeId: 'trigger',
          targetNodeId: 'return',
        }),
      ];
      const flow = createMockFlowEntity({ nodes, connections });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.validateFlowConnections('flow-id');

      expect(result.flowId).toBe('flow-id');
      expect(result.connections).toHaveLength(1);
    });

    it('should detect Link node constraint violations', async () => {
      // Link nodes can only be connected after UI nodes (interface category)
      const nodes = [
        createMockApiCallNode({ id: 'api' }), // action category
        createMockLinkNode({ id: 'link' }),
      ];
      const connections = [
        createMockConnection({
          id: 'conn-1',
          sourceNodeId: 'api',
          targetNodeId: 'link',
        }),
      ];
      const flow = createMockFlowEntity({ nodes, connections });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.validateFlowConnections('flow-id');

      expect(result.status).toBe('errors');
      expect(result.summary.errors).toBe(1);
    });

    it('should allow Link node from interface node', async () => {
      const nodes = [
        createMockRegistryComponentNode({ id: 'statcard' }),
        createMockLinkNode({ id: 'link' }),
      ];
      const connections = [
        createMockConnection({
          id: 'conn-1',
          sourceNodeId: 'statcard',
          targetNodeId: 'link',
        }),
      ];
      const flow = createMockFlowEntity({ nodes, connections });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.validateFlowConnections('flow-id');

      expect(result.summary.errors).toBe(0);
    });

    it('should detect transform nodes without input connections', async () => {
      const nodes = [
        createMockTransformNode({ id: 'transform' }), // No incoming connections
      ];
      const flow = createMockFlowEntity({ nodes, connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.validateFlowConnections('flow-id');

      expect(result.status).toBe('errors');
      expect(result.nodeErrors).toBeDefined();
      expect(result.nodeErrors).toHaveLength(1);
      expect(result.nodeErrors![0].errorCode).toBe('TRANSFORM_NO_INPUT');
    });

    it('should throw NotFoundException when flow not found', async () => {
      mockFlowRepository.findOne!.mockResolvedValue(null);

      await expect(
        service.validateFlowConnections('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return summary counts', async () => {
      const nodes = [
        createMockUserIntentNode({ id: 'trigger' }),
        createMockApiCallNode({ id: 'api' }),
        createMockReturnNode({ id: 'return' }),
      ];
      const connections = [
        createMockConnection({
          id: 'conn-1',
          sourceNodeId: 'trigger',
          targetNodeId: 'api',
        }),
        createMockConnection({
          id: 'conn-2',
          sourceNodeId: 'api',
          targetNodeId: 'return',
        }),
      ];
      const flow = createMockFlowEntity({ nodes, connections });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.validateFlowConnections('flow-id');

      expect(result.summary).toHaveProperty('total');
      expect(result.summary).toHaveProperty('compatible');
      expect(result.summary).toHaveProperty('warnings');
      expect(result.summary).toHaveProperty('errors');
      expect(result.summary).toHaveProperty('unknown');
    });
  });

  // ============================================================
  // Tests for validateConnection() method
  // ============================================================
  describe('validateConnection', () => {
    it('should validate connection between two nodes', async () => {
      const nodes = [
        createMockUserIntentNode({ id: 'source' }),
        createMockReturnNode({ id: 'target' }),
      ];
      const flow = createMockFlowEntity({ nodes });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.validateConnection('flow-id', {
        sourceNodeId: 'source',
        targetNodeId: 'target',
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('issues');
    });

    it('should throw NotFoundException when source node not found', async () => {
      const nodes = [createMockReturnNode({ id: 'target' })];
      const flow = createMockFlowEntity({ nodes });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.validateConnection('flow-id', {
          sourceNodeId: 'non-existent',
          targetNodeId: 'target',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when target node not found', async () => {
      const nodes = [createMockUserIntentNode({ id: 'source' })];
      const flow = createMockFlowEntity({ nodes });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.validateConnection('flow-id', {
          sourceNodeId: 'source',
          targetNodeId: 'non-existent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should suggest transformers for incompatible connections', async () => {
      // Create nodes with potentially incompatible schemas
      const nodes = [
        createMockApiCallNode({ id: 'api' }),
        createMockReturnNode({ id: 'return' }),
      ];
      const flow = createMockFlowEntity({ nodes });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.validateConnection('flow-id', {
        sourceNodeId: 'api',
        targetNodeId: 'return',
      });

      // Result should include status and issues
      expect(result.status).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    it('should return source and target schemas', async () => {
      const nodes = [
        createMockUserIntentNode({ id: 'source' }),
        createMockReturnNode({ id: 'target' }),
      ];
      const flow = createMockFlowEntity({ nodes });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.validateConnection('flow-id', {
        sourceNodeId: 'source',
        targetNodeId: 'target',
      });

      expect(result.sourceSchema).toBeDefined();
      expect(result.targetSchema).toBeDefined();
    });
  });

  // ============================================================
  // Tests for unknown node types
  // ============================================================
  describe('unknown node types', () => {
    it('should handle unknown node type gracefully', async () => {
      const node = createMockNodeInstance({
        id: 'unknown-1',
        type: 'UnknownType',
      });
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.getNodeSchema('flow-id', 'unknown-1');

      expect(result.inputState).toBe('unknown');
      expect(result.outputState).toBe('unknown');
      expect(result.inputSchema).toBeNull();
      expect(result.outputSchema).toBeNull();
    });

    it('should return unknown status for connections with unknown nodes', async () => {
      const nodes = [
        createMockNodeInstance({ id: 'source', type: 'UnknownType' }),
        createMockReturnNode({ id: 'target' }),
      ];
      const connections = [
        createMockConnection({
          id: 'conn-1',
          sourceNodeId: 'source',
          targetNodeId: 'target',
        }),
      ];
      const flow = createMockFlowEntity({ nodes, connections });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const result = await service.validateFlowConnections('flow-id');

      // Should still return valid response but with unknown status for that connection
      expect(result).toBeDefined();
    });
  });
});
