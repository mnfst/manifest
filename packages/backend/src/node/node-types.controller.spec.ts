/**
 * Unit tests for NodeTypesController
 *
 * Tests HTTP endpoint behavior with mocked NodeService.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NodeTypesController } from './node-types.controller';
import { NodeService } from './node.service';

describe('NodeTypesController', () => {
  let controller: NodeTypesController;
  let mockService: {
    getNodeTypes: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      getNodeTypes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NodeTypesController],
      providers: [
        {
          provide: NodeService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<NodeTypesController>(NodeTypesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================================
  // Tests for GET /api/node-types
  // ============================================================
  describe('getNodeTypes', () => {
    it('should return node types and categories from service', () => {
      const mockResponse = {
        nodeTypes: [
          { name: 'ApiCall', displayName: 'API Call', category: 'action' },
          { name: 'UserIntent', displayName: 'Trigger', category: 'trigger' },
        ],
        categories: [
          { id: 'trigger', displayName: 'Triggers', order: 1 },
          { id: 'action', displayName: 'Actions', order: 3 },
        ],
      };
      mockService.getNodeTypes.mockReturnValue(mockResponse);

      const result = controller.getNodeTypes();

      expect(result).toEqual(mockResponse);
      expect(mockService.getNodeTypes).toHaveBeenCalled();
    });

    it('should return all node types', () => {
      const mockResponse = {
        nodeTypes: [
          { name: 'ApiCall', displayName: 'API Call', category: 'action' },
        ],
        categories: [],
      };
      mockService.getNodeTypes.mockReturnValue(mockResponse);

      const result = controller.getNodeTypes();

      expect(result.nodeTypes).toHaveLength(1);
      expect(result.nodeTypes[0].name).toBe('ApiCall');
    });
  });
});
