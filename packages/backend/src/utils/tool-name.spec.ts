/**
 * Unit tests for utils/tool-name.ts
 *
 * Tests the utility functions for generating and checking unique tool names
 * for UserIntent nodes within an app.
 *
 * Test organization:
 * - Each exported function has its own describe block
 * - Success paths tested first, then edge cases
 */

import type { Repository } from 'typeorm';
import type { FlowEntity } from '../flow/flow.entity';
import type { NodeInstance } from '@manifest/shared';
import { generateUniqueToolName, toolNameExists } from './tool-name';

// ============================================================
// Mock Factories
// ============================================================

/**
 * Creates a mock FlowEntity repository
 */
function createMockFlowRepository(): jest.Mocked<Pick<Repository<FlowEntity>, 'find'>> {
  return {
    find: jest.fn(),
  };
}

/**
 * Creates a mock UserIntent node with the specified tool name
 */
function createUserIntentNode(
  toolName: string,
  nodeId: string = `node-${toolName}`,
): NodeInstance {
  return {
    id: nodeId,
    type: 'UserIntent',
    name: 'Test Intent',
    position: { x: 0, y: 0 },
    parameters: {
      toolName,
      toolDescription: 'Test description',
    },
  } as NodeInstance;
}

/**
 * Creates a mock non-UserIntent node
 */
function createOtherNode(nodeId: string = 'other-node'): NodeInstance {
  return {
    id: nodeId,
    type: 'TextOutput',
    name: 'Output',
    position: { x: 100, y: 100 },
    parameters: {
      template: 'Hello',
    },
  } as NodeInstance;
}

/**
 * Creates a mock FlowEntity with the given nodes
 */
function createMockFlow(
  nodes: NodeInstance[] = [],
  flowId: string = 'flow-1',
): Partial<FlowEntity> {
  return {
    id: flowId,
    appId: 'test-app-id',
    name: 'Test Flow',
    nodes,
    connections: [],
  };
}

// ============================================================
// Tests for generateUniqueToolName()
// ============================================================
describe('generateUniqueToolName', () => {
  let mockRepository: jest.Mocked<Pick<Repository<FlowEntity>, 'find'>>;

  beforeEach(() => {
    mockRepository = createMockFlowRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basic conversion', () => {
    it('should convert node name to snake_case when no existing names', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await generateUniqueToolName(
        'app-id',
        'My Tool Name',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe('my_tool_name');
      expect(mockRepository.find).toHaveBeenCalledWith({ where: { appId: 'app-id' } });
    });

    it('should handle names with special characters', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await generateUniqueToolName(
        'app-id',
        'My Tool! @#$ Name',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe('my_tool_name');
    });

    it('should handle names with multiple spaces', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await generateUniqueToolName(
        'app-id',
        'My    Spaced   Name',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe('my_spaced_name');
    });

    it('should handle single word names', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await generateUniqueToolName(
        'app-id',
        'Search',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe('search');
    });
  });

  describe('uniqueness with suffix', () => {
    it('should add suffix _2 when base name exists', async () => {
      const existingNode = createUserIntentNode('my_tool');
      mockRepository.find.mockResolvedValue([createMockFlow([existingNode]) as FlowEntity]);

      const result = await generateUniqueToolName(
        'app-id',
        'My Tool',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe('my_tool_2');
    });

    it('should increment suffix until unique', async () => {
      const existingNodes = [
        createUserIntentNode('search'),
        createUserIntentNode('search_2'),
        createUserIntentNode('search_3'),
      ];
      mockRepository.find.mockResolvedValue([createMockFlow(existingNodes) as FlowEntity]);

      const result = await generateUniqueToolName(
        'app-id',
        'Search',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe('search_4');
    });

    it('should check across multiple flows', async () => {
      const flow1 = createMockFlow([createUserIntentNode('process')], 'flow-1');
      const flow2 = createMockFlow([createUserIntentNode('process_2')], 'flow-2');
      mockRepository.find.mockResolvedValue([flow1 as FlowEntity, flow2 as FlowEntity]);

      const result = await generateUniqueToolName(
        'app-id',
        'Process',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe('process_3');
    });
  });

  describe('excludeNodeId parameter', () => {
    it('should exclude specified node from uniqueness check', async () => {
      const existingNode = createUserIntentNode('update_user', 'node-to-update');
      mockRepository.find.mockResolvedValue([createMockFlow([existingNode]) as FlowEntity]);

      // When updating a node, exclude it from the check
      const result = await generateUniqueToolName(
        'app-id',
        'Update User',
        mockRepository as unknown as Repository<FlowEntity>,
        'node-to-update',
      );

      // Should return the base name since the only match is excluded
      expect(result).toBe('update_user');
    });

    it('should still add suffix if other nodes have the same name', async () => {
      const nodes = [
        createUserIntentNode('update_user', 'node-1'),
        createUserIntentNode('update_user_2', 'node-to-update'),
      ];
      mockRepository.find.mockResolvedValue([createMockFlow(nodes) as FlowEntity]);

      // Exclude node-to-update, but node-1 still has 'update_user'
      const result = await generateUniqueToolName(
        'app-id',
        'Update User',
        mockRepository as unknown as Repository<FlowEntity>,
        'node-to-update',
      );

      expect(result).toBe('update_user_2');
    });
  });

  describe('edge cases', () => {
    it('should handle empty flows array', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await generateUniqueToolName(
        'app-id',
        'New Tool',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe('new_tool');
    });

    it('should handle flows with no nodes', async () => {
      mockRepository.find.mockResolvedValue([createMockFlow([]) as FlowEntity]);

      const result = await generateUniqueToolName(
        'app-id',
        'My Tool',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe('my_tool');
    });

    it('should handle flows with only non-UserIntent nodes', async () => {
      const otherNode = createOtherNode();
      mockRepository.find.mockResolvedValue([createMockFlow([otherNode]) as FlowEntity]);

      const result = await generateUniqueToolName(
        'app-id',
        'My Tool',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe('my_tool');
    });

    it('should handle UserIntent nodes without toolName', async () => {
      const nodeWithoutToolName: NodeInstance = {
        id: 'node-1',
        type: 'UserIntent',
        name: 'Test',
        position: { x: 0, y: 0 },
        parameters: {
          toolDescription: 'Description only',
        },
      } as NodeInstance;
      mockRepository.find.mockResolvedValue([createMockFlow([nodeWithoutToolName]) as FlowEntity]);

      const result = await generateUniqueToolName(
        'app-id',
        'Test',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      // Should use base name since the existing node has no toolName
      expect(result).toBe('test');
    });

    it('should handle flows with null nodes array', async () => {
      const flowWithNullNodes = {
        id: 'flow-1',
        appId: 'test-app-id',
        name: 'Test Flow',
        nodes: null as unknown as NodeInstance[],
        connections: [],
      };
      mockRepository.find.mockResolvedValue([flowWithNullNodes as FlowEntity]);

      const result = await generateUniqueToolName(
        'app-id',
        'My Tool',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe('my_tool');
    });
  });
});

// ============================================================
// Tests for toolNameExists()
// ============================================================
describe('toolNameExists', () => {
  let mockRepository: jest.Mocked<Pick<Repository<FlowEntity>, 'find'>>;

  beforeEach(() => {
    mockRepository = createMockFlowRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basic existence check', () => {
    it('should return false when no flows exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await toolNameExists(
        'app-id',
        'my_tool',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe(false);
      expect(mockRepository.find).toHaveBeenCalledWith({ where: { appId: 'app-id' } });
    });

    it('should return true when tool name exists', async () => {
      const existingNode = createUserIntentNode('search_data');
      mockRepository.find.mockResolvedValue([createMockFlow([existingNode]) as FlowEntity]);

      const result = await toolNameExists(
        'app-id',
        'search_data',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe(true);
    });

    it('should return false when tool name does not exist', async () => {
      const existingNode = createUserIntentNode('process_data');
      mockRepository.find.mockResolvedValue([createMockFlow([existingNode]) as FlowEntity]);

      const result = await toolNameExists(
        'app-id',
        'search_data',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe(false);
    });
  });

  describe('multiple flows', () => {
    it('should find tool name in second flow', async () => {
      const flow1 = createMockFlow([createUserIntentNode('tool_a')], 'flow-1');
      const flow2 = createMockFlow([createUserIntentNode('tool_b')], 'flow-2');
      mockRepository.find.mockResolvedValue([flow1 as FlowEntity, flow2 as FlowEntity]);

      const result = await toolNameExists(
        'app-id',
        'tool_b',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe(true);
    });

    it('should check all flows when tool name not found', async () => {
      const flow1 = createMockFlow([createUserIntentNode('tool_a')], 'flow-1');
      const flow2 = createMockFlow([createUserIntentNode('tool_b')], 'flow-2');
      mockRepository.find.mockResolvedValue([flow1 as FlowEntity, flow2 as FlowEntity]);

      const result = await toolNameExists(
        'app-id',
        'tool_c',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe(false);
    });
  });

  describe('excludeNodeId parameter', () => {
    it('should exclude specified node from existence check', async () => {
      const existingNode = createUserIntentNode('unique_tool', 'node-to-exclude');
      mockRepository.find.mockResolvedValue([createMockFlow([existingNode]) as FlowEntity]);

      const result = await toolNameExists(
        'app-id',
        'unique_tool',
        mockRepository as unknown as Repository<FlowEntity>,
        'node-to-exclude',
      );

      expect(result).toBe(false);
    });

    it('should return true if another node has the same tool name', async () => {
      const nodes = [
        createUserIntentNode('shared_tool', 'node-1'),
        createUserIntentNode('shared_tool', 'node-2'),
      ];
      mockRepository.find.mockResolvedValue([createMockFlow(nodes) as FlowEntity]);

      // Exclude node-1, but node-2 still has the same tool name
      const result = await toolNameExists(
        'app-id',
        'shared_tool',
        mockRepository as unknown as Repository<FlowEntity>,
        'node-1',
      );

      expect(result).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle flows with no nodes', async () => {
      mockRepository.find.mockResolvedValue([createMockFlow([]) as FlowEntity]);

      const result = await toolNameExists(
        'app-id',
        'my_tool',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe(false);
    });

    it('should handle flows with only non-UserIntent nodes', async () => {
      const otherNode = createOtherNode();
      mockRepository.find.mockResolvedValue([createMockFlow([otherNode]) as FlowEntity]);

      const result = await toolNameExists(
        'app-id',
        'my_tool',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe(false);
    });

    it('should handle UserIntent nodes without toolName', async () => {
      const nodeWithoutToolName: NodeInstance = {
        id: 'node-1',
        type: 'UserIntent',
        name: 'Test',
        position: { x: 0, y: 0 },
        parameters: {
          toolDescription: 'Description only',
        },
      } as NodeInstance;
      mockRepository.find.mockResolvedValue([createMockFlow([nodeWithoutToolName]) as FlowEntity]);

      const result = await toolNameExists(
        'app-id',
        'test',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe(false);
    });

    it('should handle flows with null nodes array', async () => {
      const flowWithNullNodes = {
        id: 'flow-1',
        appId: 'test-app-id',
        name: 'Test Flow',
        nodes: null as unknown as NodeInstance[],
        connections: [],
      };
      mockRepository.find.mockResolvedValue([flowWithNullNodes as FlowEntity]);

      const result = await toolNameExists(
        'app-id',
        'my_tool',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe(false);
    });

    it('should be case-sensitive', async () => {
      const existingNode = createUserIntentNode('My_Tool');
      mockRepository.find.mockResolvedValue([createMockFlow([existingNode]) as FlowEntity]);

      // Checking for lowercase should not match uppercase
      const result = await toolNameExists(
        'app-id',
        'my_tool',
        mockRepository as unknown as Repository<FlowEntity>,
      );

      expect(result).toBe(false);
    });
  });
});
