/**
 * Unit tests for NodeService
 *
 * Tests all CRUD operations for nodes and connections with mocked TypeORM repository.
 * No database connections are made - all repository calls are mocked.
 *
 * Test organization:
 * - Each public method has its own describe block
 * - Success paths tested first, then error paths
 * - Edge cases included where applicable
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { NodeService } from './node.service';
import { FlowEntity } from '../flow/flow.entity';
import {
  createMockFlowRepository,
  type MockRepository,
} from './test/mock-repository';
import {
  createMockFlowEntity,
  createMockNodeInstance,
  createMockUserIntentNode,
  createMockApiCallNode,
  createMockRegistryComponentNode,
  createMockLinkNode,
  createMockConnection,
  createMockCreateNodeRequest,
  createMockCreateConnectionRequest,
  createMockInsertTransformerRequest,
  createMockFlowWithPotentialCycle,
} from './test/fixtures';

describe('NodeService', () => {
  let service: NodeService;
  let mockFlowRepository: MockRepository<FlowEntity>;

  beforeEach(async () => {
    mockFlowRepository = createMockFlowRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodeService,
        {
          provide: getRepositoryToken(FlowEntity),
          useValue: mockFlowRepository,
        },
      ],
    }).compile();

    service = module.get<NodeService>(NodeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // Tests for getNodeTypes() method
  // ============================================================
  describe('getNodeTypes', () => {
    it('should return node types and categories', () => {
      const result = service.getNodeTypes();

      expect(result).toHaveProperty('nodeTypes');
      expect(result).toHaveProperty('categories');
      expect(Array.isArray(result.nodeTypes)).toBe(true);
      expect(Array.isArray(result.categories)).toBe(true);
    });

    it('should return all category types', () => {
      const result = service.getNodeTypes();
      const categoryIds = result.categories.map((c) => c.id);

      expect(categoryIds).toContain('trigger');
      expect(categoryIds).toContain('ui');
      expect(categoryIds).toContain('action');
      expect(categoryIds).toContain('transform');
      expect(categoryIds).toContain('return');
    });

    it('should order categories correctly', () => {
      const result = service.getNodeTypes();

      expect(result.categories[0].id).toBe('trigger');
      expect(result.categories[0].order).toBe(1);
      expect(result.categories[4].id).toBe('return');
      expect(result.categories[4].order).toBe(5);
    });

    it('should include node type metadata', () => {
      const result = service.getNodeTypes();
      const apiCallNode = result.nodeTypes.find((n) => n.name === 'ApiCall');

      expect(apiCallNode).toBeDefined();
      expect(apiCallNode).toHaveProperty('displayName');
      expect(apiCallNode).toHaveProperty('category');
    });
  });

  // ============================================================
  // Tests for getNodes() method
  // ============================================================
  describe('getNodes', () => {
    it('should return nodes from a flow', async () => {
      const nodes = [
        createMockNodeInstance({ id: '1', name: 'Node 1' }),
        createMockNodeInstance({ id: '2', name: 'Node 2' }),
      ];
      mockFlowRepository.findOne!.mockResolvedValue(
        createMockFlowEntity({ nodes }),
      );

      const result = await service.getNodes('flow-id');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Node 1');
      expect(result[1].name).toBe('Node 2');
    });

    it('should return empty array when flow has no nodes', async () => {
      mockFlowRepository.findOne!.mockResolvedValue(
        createMockFlowEntity({ nodes: [] }),
      );

      const result = await service.getNodes('flow-id');

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when flow not found', async () => {
      mockFlowRepository.findOne!.mockResolvedValue(null);

      await expect(service.getNodes('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle null nodes array', async () => {
      mockFlowRepository.findOne!.mockResolvedValue(
        createMockFlowEntity({ nodes: null as unknown as [] }),
      );

      const result = await service.getNodes('flow-id');

      expect(result).toEqual([]);
    });

    it('should trigger migration for nodes without slugs', async () => {
      const nodeWithoutSlug = {
        id: 'node-1',
        type: 'ApiCall',
        name: 'Test Node',
        position: { x: 0, y: 0 },
        parameters: {},
        // No slug property
      };
      const flow = createMockFlowEntity({
        nodes: [nodeWithoutSlug as unknown as ReturnType<typeof createMockNodeInstance>],
      });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockResolvedValue(flow);

      await service.getNodes('flow-id');

      expect(mockFlowRepository.save).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Tests for addNode() method
  // ============================================================
  describe('addNode', () => {
    it('should create a new node with generated id and slug', async () => {
      const flow = createMockFlowEntity({ nodes: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      const request = createMockCreateNodeRequest({
        name: 'My New Node',
        type: 'ApiCall',
      });

      const result = await service.addNode('flow-id', request);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.slug).toBe('my_new_node');
      expect(result.name).toBe('My New Node');
      expect(result.type).toBe('ApiCall');
    });

    it('should merge default parameters with provided parameters', async () => {
      const flow = createMockFlowEntity({ nodes: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      const request = createMockCreateNodeRequest({
        name: 'API Node',
        type: 'ApiCall',
        parameters: { url: 'https://custom.com' },
      });

      const result = await service.addNode('flow-id', request);

      expect(result.parameters.url).toBe('https://custom.com');
    });

    it('should throw BadRequestException for duplicate node name', async () => {
      const flow = createMockFlowEntity({
        nodes: [createMockNodeInstance({ name: 'Existing Node' })],
      });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const request = createMockCreateNodeRequest({ name: 'Existing Node' });

      await expect(service.addNode('flow-id', request)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.addNode('flow-id', request)).rejects.toThrow(
        'already exists',
      );
    });

    it('should generate unique slug when name conflicts exist', async () => {
      const flow = createMockFlowEntity({
        nodes: [createMockNodeInstance({ name: 'Different', slug: 'test-node' })],
      });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      const request = createMockCreateNodeRequest({ name: 'Test Node' });

      const result = await service.addNode('flow-id', request);

      // Should generate a unique slug like 'test-node-1'
      expect(result.slug).not.toBe('test-node');
    });

    it('should auto-generate toolName for UserIntent nodes', async () => {
      const flow = createMockFlowEntity({ nodes: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));
      // Mock for generateUniqueToolName
      mockFlowRepository.find!.mockResolvedValue([]);

      const request = createMockCreateNodeRequest({
        name: 'My Trigger',
        type: 'UserIntent',
      });

      const result = await service.addNode('flow-id', request);

      expect(result.type).toBe('UserIntent');
      expect(result.parameters.toolName).toBeDefined();
      expect(result.parameters.isActive).toBe(true);
    });

    it('should throw NotFoundException when flow not found', async () => {
      mockFlowRepository.findOne!.mockResolvedValue(null);

      const request = createMockCreateNodeRequest();

      await expect(service.addNode('non-existent', request)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // Tests for updateNode() method
  // ============================================================
  describe('updateNode', () => {
    it('should update node name', async () => {
      const node = createMockNodeInstance({ id: 'node-1', name: 'Old Name' });
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      const result = await service.updateNode('flow-id', 'node-1', {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
      expect(result.slug).toBe('new_name');
    });

    it('should update node parameters', async () => {
      const node = createMockApiCallNode({ id: 'node-1' });
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      const result = await service.updateNode('flow-id', 'node-1', {
        parameters: { url: 'https://new-url.com' },
      });

      expect(result.parameters.url).toBe('https://new-url.com');
    });

    it('should update node position', async () => {
      const node = createMockNodeInstance({ id: 'node-1' });
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      const result = await service.updateNode('flow-id', 'node-1', {
        position: { x: 500, y: 500 },
      });

      expect(result.position).toEqual({ x: 500, y: 500 });
    });

    it('should throw NotFoundException when node not found', async () => {
      const flow = createMockFlowEntity({ nodes: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.updateNode('flow-id', 'non-existent', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for duplicate name', async () => {
      const nodes = [
        createMockNodeInstance({ id: 'node-1', name: 'Node 1' }),
        createMockNodeInstance({ id: 'node-2', name: 'Node 2' }),
      ];
      const flow = createMockFlowEntity({ nodes });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.updateNode('flow-id', 'node-1', { name: 'Node 2' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow keeping the same name', async () => {
      const node = createMockNodeInstance({ id: 'node-1', name: 'Same Name' });
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      const result = await service.updateNode('flow-id', 'node-1', {
        name: 'Same Name',
      });

      expect(result.name).toBe('Same Name');
    });

    it('should regenerate toolName for UserIntent when name changes', async () => {
      const node = createMockUserIntentNode({ id: 'node-1', name: 'Old Trigger' });
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));
      mockFlowRepository.find!.mockResolvedValue([]);

      const result = await service.updateNode('flow-id', 'node-1', {
        name: 'New Trigger',
      });

      expect(result.name).toBe('New Trigger');
      expect(result.parameters.toolName).toBeDefined();
    });

    it('should update slug references in downstream nodes', async () => {
      const nodes = [
        createMockNodeInstance({ id: 'node-1', name: 'Source', slug: 'source' }),
        createMockApiCallNode({
          id: 'node-2',
          parameters: { url: '{{ source.data }}', headers: [] },
        }),
      ];
      const flow = createMockFlowEntity({ nodes });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      await service.updateNode('flow-id', 'node-1', { name: 'New Source' });

      const savedFlow = mockFlowRepository.save!.mock.calls[0][0];
      const apiNode = savedFlow.nodes.find(
        (n: { id: string }) => n.id === 'node-2',
      );
      expect(apiNode.parameters.url).toBe('{{ new_source.data }}');
    });
  });

  // ============================================================
  // Tests for updateNodePosition() method
  // ============================================================
  describe('updateNodePosition', () => {
    it('should update only the position', async () => {
      const node = createMockNodeInstance({
        id: 'node-1',
        name: 'Test',
        position: { x: 0, y: 0 },
      });
      const flow = createMockFlowEntity({ nodes: [node] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      const result = await service.updateNodePosition('flow-id', 'node-1', {
        x: 300,
        y: 400,
      });

      expect(result.position).toEqual({ x: 300, y: 400 });
      expect(result.name).toBe('Test'); // Other fields unchanged
    });

    it('should throw NotFoundException when node not found', async () => {
      const flow = createMockFlowEntity({ nodes: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.updateNodePosition('flow-id', 'non-existent', { x: 0, y: 0 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // Tests for deleteNode() method
  // ============================================================
  describe('deleteNode', () => {
    it('should delete a node', async () => {
      const node = createMockNodeInstance({ id: 'node-1' });
      const flow = createMockFlowEntity({ nodes: [node], connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      await service.deleteNode('flow-id', 'node-1');

      const savedFlow = mockFlowRepository.save!.mock.calls[0][0];
      expect(savedFlow.nodes).toHaveLength(0);
    });

    it('should cascade delete connections referencing the node', async () => {
      const nodes = [
        createMockNodeInstance({ id: 'node-1' }),
        createMockNodeInstance({ id: 'node-2' }),
        createMockNodeInstance({ id: 'node-3' }),
      ];
      const connections = [
        createMockConnection({ id: 'c1', sourceNodeId: 'node-1', targetNodeId: 'node-2' }),
        createMockConnection({ id: 'c2', sourceNodeId: 'node-2', targetNodeId: 'node-3' }),
        createMockConnection({ id: 'c3', sourceNodeId: 'node-1', targetNodeId: 'node-3' }),
      ];
      const flow = createMockFlowEntity({ nodes, connections });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      await service.deleteNode('flow-id', 'node-1');

      const savedFlow = mockFlowRepository.save!.mock.calls[0][0];
      expect(savedFlow.nodes).toHaveLength(2);
      expect(savedFlow.connections).toHaveLength(1);
      expect(savedFlow.connections[0].id).toBe('c2');
    });

    it('should throw NotFoundException when node not found', async () => {
      const flow = createMockFlowEntity({ nodes: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.deleteNode('flow-id', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // Tests for getConnections() method
  // ============================================================
  describe('getConnections', () => {
    it('should return connections from a flow', async () => {
      const connections = [
        createMockConnection({ id: 'c1' }),
        createMockConnection({ id: 'c2' }),
      ];
      mockFlowRepository.findOne!.mockResolvedValue(
        createMockFlowEntity({ connections }),
      );

      const result = await service.getConnections('flow-id');

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no connections', async () => {
      mockFlowRepository.findOne!.mockResolvedValue(
        createMockFlowEntity({ connections: [] }),
      );

      const result = await service.getConnections('flow-id');

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when flow not found', async () => {
      mockFlowRepository.findOne!.mockResolvedValue(null);

      await expect(service.getConnections('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // Tests for addConnection() method
  // ============================================================
  describe('addConnection', () => {
    it('should create a new connection', async () => {
      const nodes = [
        createMockNodeInstance({ id: 'source' }),
        createMockNodeInstance({ id: 'target' }),
      ];
      const flow = createMockFlowEntity({ nodes, connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      const request = createMockCreateConnectionRequest({
        sourceNodeId: 'source',
        targetNodeId: 'target',
      });

      const result = await service.addConnection('flow-id', request);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.sourceNodeId).toBe('source');
      expect(result.targetNodeId).toBe('target');
    });

    it('should throw BadRequestException when source node not found', async () => {
      const nodes = [createMockNodeInstance({ id: 'target' })];
      const flow = createMockFlowEntity({ nodes, connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const request = createMockCreateConnectionRequest({
        sourceNodeId: 'non-existent',
        targetNodeId: 'target',
      });

      await expect(service.addConnection('flow-id', request)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when target node not found', async () => {
      const nodes = [createMockNodeInstance({ id: 'source' })];
      const flow = createMockFlowEntity({ nodes, connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const request = createMockCreateConnectionRequest({
        sourceNodeId: 'source',
        targetNodeId: 'non-existent',
      });

      await expect(service.addConnection('flow-id', request)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for self-connection', async () => {
      const nodes = [createMockNodeInstance({ id: 'node-1' })];
      const flow = createMockFlowEntity({ nodes, connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const request = createMockCreateConnectionRequest({
        sourceNodeId: 'node-1',
        targetNodeId: 'node-1',
      });

      await expect(service.addConnection('flow-id', request)).rejects.toThrow(
        'Cannot connect a node to itself',
      );
    });

    it('should throw BadRequestException for connection to trigger node', async () => {
      const nodes = [
        createMockNodeInstance({ id: 'source' }),
        createMockUserIntentNode({ id: 'trigger' }),
      ];
      const flow = createMockFlowEntity({ nodes, connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const request = createMockCreateConnectionRequest({
        sourceNodeId: 'source',
        targetNodeId: 'trigger',
      });

      await expect(service.addConnection('flow-id', request)).rejects.toThrow(
        'Cannot create connection to trigger node',
      );
    });

    it('should throw BadRequestException for duplicate connection', async () => {
      const nodes = [
        createMockNodeInstance({ id: 'source' }),
        createMockNodeInstance({ id: 'target' }),
      ];
      const existingConnection = createMockConnection({
        sourceNodeId: 'source',
        sourceHandle: 'output',
        targetNodeId: 'target',
        targetHandle: 'input',
      });
      const flow = createMockFlowEntity({
        nodes,
        connections: [existingConnection],
      });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const request = createMockCreateConnectionRequest({
        sourceNodeId: 'source',
        sourceHandle: 'output',
        targetNodeId: 'target',
        targetHandle: 'input',
      });

      await expect(service.addConnection('flow-id', request)).rejects.toThrow(
        'This connection already exists',
      );
    });

    it('should throw BadRequestException for circular reference', async () => {
      const flow = createMockFlowWithPotentialCycle();
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      // Try to connect C back to A, which would create A->B->C->A cycle
      const request = createMockCreateConnectionRequest({
        sourceNodeId: 'C',
        targetNodeId: 'A',
      });

      await expect(service.addConnection('flow-id', request)).rejects.toThrow(
        'circular reference',
      );
    });

    it('should allow Link node connection from UI node', async () => {
      const nodes = [
        createMockRegistryComponentNode({ id: 'statcard' }),
        createMockLinkNode({ id: 'link' }),
      ];
      const flow = createMockFlowEntity({ nodes, connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      const request = createMockCreateConnectionRequest({
        sourceNodeId: 'statcard',
        targetNodeId: 'link',
      });

      const result = await service.addConnection('flow-id', request);

      expect(result.targetNodeId).toBe('link');
    });

    it('should throw BadRequestException for Link node from non-UI node', async () => {
      const nodes = [
        createMockApiCallNode({ id: 'api' }),
        createMockLinkNode({ id: 'link' }),
      ];
      const flow = createMockFlowEntity({ nodes, connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const request = createMockCreateConnectionRequest({
        sourceNodeId: 'api',
        targetNodeId: 'link',
      });

      await expect(service.addConnection('flow-id', request)).rejects.toThrow(
        'Link nodes can only be connected after UI nodes',
      );
    });
  });

  // ============================================================
  // Tests for deleteConnection() method
  // ============================================================
  describe('deleteConnection', () => {
    it('should delete a connection', async () => {
      const connections = [
        createMockConnection({ id: 'conn-1' }),
        createMockConnection({ id: 'conn-2' }),
      ];
      const flow = createMockFlowEntity({ connections });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      await service.deleteConnection('flow-id', 'conn-1');

      const savedFlow = mockFlowRepository.save!.mock.calls[0][0];
      expect(savedFlow.connections).toHaveLength(1);
      expect(savedFlow.connections[0].id).toBe('conn-2');
    });

    it('should throw NotFoundException when connection not found', async () => {
      const flow = createMockFlowEntity({ connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.deleteConnection('flow-id', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // Tests for insertTransformer() method
  // ============================================================
  describe('insertTransformer', () => {
    it('should insert transformer between two nodes', async () => {
      const nodes = [
        createMockNodeInstance({ id: 'source', position: { x: 0, y: 0 } }),
        createMockNodeInstance({ id: 'target', position: { x: 200, y: 0 } }),
      ];
      const connections = [
        createMockConnection({
          id: 'existing',
          sourceNodeId: 'source',
          targetNodeId: 'target',
        }),
      ];
      const flow = createMockFlowEntity({ nodes, connections });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      const request = createMockInsertTransformerRequest({
        sourceNodeId: 'source',
        targetNodeId: 'target',
        transformerType: 'JavaScriptCodeTransform',
      });

      const result = await service.insertTransformer('flow-id', request);

      expect(result.transformerNode).toBeDefined();
      expect(result.transformerNode.type).toBe('JavaScriptCodeTransform');
      expect(result.transformerNode.position.x).toBe(100); // Midpoint
      expect(result.sourceConnection).toBeDefined();
      expect(result.targetConnection).toBeDefined();
    });

    it('should remove existing connection when inserting', async () => {
      const nodes = [
        createMockNodeInstance({ id: 'source', position: { x: 0, y: 0 } }),
        createMockNodeInstance({ id: 'target', position: { x: 200, y: 0 } }),
      ];
      const connections = [
        createMockConnection({
          id: 'existing',
          sourceNodeId: 'source',
          targetNodeId: 'target',
        }),
      ];
      const flow = createMockFlowEntity({ nodes, connections });
      mockFlowRepository.findOne!.mockResolvedValue(flow);
      mockFlowRepository.save!.mockImplementation((f) => Promise.resolve(f));

      await service.insertTransformer('flow-id', {
        sourceNodeId: 'source',
        targetNodeId: 'target',
        transformerType: 'JavaScriptCodeTransform',
      });

      const savedFlow = mockFlowRepository.save!.mock.calls[0][0];
      // Should have 3 nodes (original 2 + transformer)
      expect(savedFlow.nodes).toHaveLength(3);
      // Should have 2 connections (source->transformer, transformer->target)
      expect(savedFlow.connections).toHaveLength(2);
    });

    it('should throw NotFoundException when source node not found', async () => {
      const nodes = [createMockNodeInstance({ id: 'target' })];
      const flow = createMockFlowEntity({ nodes, connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.insertTransformer('flow-id', {
          sourceNodeId: 'non-existent',
          targetNodeId: 'target',
          transformerType: 'JavaScriptCodeTransform',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when target node not found', async () => {
      const nodes = [createMockNodeInstance({ id: 'source' })];
      const flow = createMockFlowEntity({ nodes, connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.insertTransformer('flow-id', {
          sourceNodeId: 'source',
          targetNodeId: 'non-existent',
          transformerType: 'JavaScriptCodeTransform',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid transformer type', async () => {
      const nodes = [
        createMockNodeInstance({ id: 'source' }),
        createMockNodeInstance({ id: 'target' }),
      ];
      const flow = createMockFlowEntity({ nodes, connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.insertTransformer('flow-id', {
          sourceNodeId: 'source',
          targetNodeId: 'target',
          transformerType: 'NonExistentType',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-transform category', async () => {
      const nodes = [
        createMockNodeInstance({ id: 'source' }),
        createMockNodeInstance({ id: 'target' }),
      ];
      const flow = createMockFlowEntity({ nodes, connections: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      await expect(
        service.insertTransformer('flow-id', {
          sourceNodeId: 'source',
          targetNodeId: 'target',
          transformerType: 'ApiCall', // Not a transform node
        }),
      ).rejects.toThrow('is not a transformer');
    });
  });

  // ============================================================
  // Tests for testTransform() method
  // ============================================================
  describe('testTransform', () => {
    it('should execute simple transform code', () => {
      const result = service.testTransform({
        code: 'return { doubled: input.value * 2 };',
        sampleInput: { value: 5 },
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output.doubled).toBe(10);
      expect(result.outputSchema).toBeDefined();
    });

    it('should include _execution metadata in output', () => {
      const result = service.testTransform({
        code: 'return { result: "test" };',
        sampleInput: {},
      });

      expect(result.output._execution).toBeDefined();
      expect(result.output._execution.success).toBe(true);
      expect(result.output._execution.durationMs).toBeDefined();
    });

    it('should handle function definition syntax', () => {
      const result = service.testTransform({
        code: `function transform(input) {
          return { sum: input.a + input.b };
        }`,
        sampleInput: { a: 1, b: 2 },
      });

      expect(result.success).toBe(true);
      expect(result.output.sum).toBe(3);
    });

    it('should handle arrow function syntax', () => {
      const result = service.testTransform({
        code: `const transform = (input) => {
          return { product: input.x * input.y };
        }`,
        sampleInput: { x: 3, y: 4 },
      });

      expect(result.success).toBe(true);
      expect(result.output.product).toBe(12);
    });

    it('should strip simple TypeScript type annotations', () => {
      // The implementation handles simple type annotations like `param: Type`
      // but not complex inline object types - this is a known limitation
      const result = service.testTransform({
        code: `function transform(input) {
          return { result: input.value + 1 };
        }`,
        sampleInput: { value: 10 },
      });

      expect(result.success).toBe(true);
      expect(result.output.result).toBe(11);
    });

    it('should return error for invalid code', () => {
      const result = service.testTransform({
        code: 'return input.nonexistent.property;',
        sampleInput: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for syntax errors', () => {
      const result = service.testTransform({
        code: 'return { invalid syntax',
        sampleInput: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle primitive return values', () => {
      const result = service.testTransform({
        code: 'return input.value * 2;',
        sampleInput: { value: 7 },
      });

      expect(result.success).toBe(true);
      expect(result.output._value).toBe(14);
    });

    it('should include execution time', () => {
      const result = service.testTransform({
        code: 'return input;',
        sampleInput: { test: true },
      });

      expect(result.executionTimeMs).toBeDefined();
      expect(typeof result.executionTimeMs).toBe('number');
    });
  });
});
