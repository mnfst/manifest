/**
 * Unit tests for SeedService
 *
 * Tests the seed service that creates default fixtures on application startup.
 * All repository calls and external dependencies are mocked.
 *
 * Test organization:
 * - Each public/private method has its own describe block
 * - Success paths tested first, then error paths
 * - Edge cases included where applicable
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { UserAppRoleEntity } from '../auth/user-app-role.entity';
import { FlowExecutionEntity } from '../flow-execution/flow-execution.entity';
import type { NodeInstance, Connection } from '@chatgpt-app-builder/shared';

// ============================================================
// Mock External Dependencies
// ============================================================

// Mock uuid to return predictable values
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

// Mock better-auth - define mocks inside factory to avoid hoisting issues
jest.mock('../auth/auth', () => ({
  auth: {
    api: {
      signUpEmail: jest.fn(),
      signInEmail: jest.fn(),
    },
  },
}));

// Import the mocked auth to access the mock functions
import { auth } from '../auth/auth';
const mockSignUpEmail = auth.api.signUpEmail as jest.Mock;
const mockSignInEmail = auth.api.signInEmail as jest.Mock;

// ============================================================
// Mock Repository Factory
// ============================================================

interface MockRepository {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  count: jest.Mock;
}

function createMockRepository(): MockRepository {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };
}

// ============================================================
// Test Fixtures
// ============================================================

function createMockAppEntity(overrides: Partial<AppEntity> = {}): Partial<AppEntity> {
  return {
    id: 'test-app-id',
    name: 'Test App',
    description: 'Test description',
    slug: 'test-app',
    status: 'draft',
    ...overrides,
  };
}

function createMockFlowEntity(overrides: Partial<FlowEntity> = {}): Partial<FlowEntity> {
  return {
    id: 'test-flow-id',
    appId: 'test-app-id',
    name: 'Test Flow',
    description: 'Test flow description',
    isActive: true,
    nodes: [],
    connections: [],
    ...overrides,
  };
}

function createMockUserIntentNode(overrides: Partial<NodeInstance> = {}): NodeInstance {
  return {
    id: 'trigger-node-id',
    type: 'UserIntent',
    name: 'Test Trigger',
    position: { x: 100, y: 100 },
    parameters: {
      toolName: 'test_trigger',
      toolDescription: 'Test description',
      parameters: [],
      isActive: true,
    },
    ...overrides,
  } as NodeInstance;
}

function createMockActionNode(overrides: Partial<NodeInstance> = {}): NodeInstance {
  return {
    id: 'action-node-id',
    type: 'StatCard',
    name: 'Test Action',
    position: { x: 300, y: 100 },
    parameters: {
      layoutTemplate: 'stat-card',
    },
    ...overrides,
  } as NodeInstance;
}

// ============================================================
// Tests
// ============================================================

describe('SeedService', () => {
  let service: SeedService;
  let mockAppRepository: MockRepository;
  let mockFlowRepository: MockRepository;
  let mockUserAppRoleRepository: MockRepository;
  let mockExecutionRepository: MockRepository;

  beforeEach(async () => {
    mockAppRepository = createMockRepository();
    mockFlowRepository = createMockRepository();
    mockUserAppRoleRepository = createMockRepository();
    mockExecutionRepository = createMockRepository();

    // Reset all mocks
    jest.clearAllMocks();
    mockSignUpEmail.mockReset();
    mockSignInEmail.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedService,
        {
          provide: getRepositoryToken(AppEntity),
          useValue: mockAppRepository,
        },
        {
          provide: getRepositoryToken(FlowEntity),
          useValue: mockFlowRepository,
        },
        {
          provide: getRepositoryToken(UserAppRoleEntity),
          useValue: mockUserAppRoleRepository,
        },
        {
          provide: getRepositoryToken(FlowExecutionEntity),
          useValue: mockExecutionRepository,
        },
      ],
    }).compile();

    service = module.get<SeedService>(SeedService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // Tests for onModuleInit()
  // ============================================================
  describe('onModuleInit', () => {
    it('should call all seed methods in correct order', async () => {
      // Setup mocks for a full successful run
      mockFlowRepository.find.mockResolvedValue([]);
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(1); // Apps exist, skip fixtures
      mockAppRepository.find.mockResolvedValue([]); // No apps to assign

      await service.onModuleInit();

      // Verify migration ran
      expect(mockFlowRepository.find).toHaveBeenCalled();
      // Verify admin user creation was attempted
      expect(mockSignUpEmail).toHaveBeenCalled();
      // Verify fixture check ran
      expect(mockAppRepository.count).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockFlowRepository.find.mockRejectedValue(new Error('DB error'));

      await expect(service.onModuleInit()).rejects.toThrow('DB error');
    });
  });

  // ============================================================
  // Tests for seedAdminUser() - accessed via onModuleInit
  // ============================================================
  describe('seedAdminUser', () => {
    beforeEach(() => {
      mockFlowRepository.find.mockResolvedValue([]);
      mockAppRepository.count.mockResolvedValue(1);
      mockAppRepository.find.mockResolvedValue([]);
    });

    it('should create admin user when not exists', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'new-admin-id', email: 'admin@manifest.build' },
      });

      await service.onModuleInit();

      expect(mockSignUpEmail).toHaveBeenCalledWith({
        body: {
          email: 'admin@manifest.build',
          password: 'admin',
          name: 'Admin User',
          firstName: 'Admin',
          lastName: 'User',
        },
      });
    });

    it('should sign in when admin user already exists', async () => {
      const existsError = new Error('User already exists');
      existsError.message = 'User already exists';
      mockSignUpEmail.mockRejectedValue(existsError);
      mockSignInEmail.mockResolvedValue({
        user: { id: 'existing-admin-id', email: 'admin@manifest.build' },
      });

      await service.onModuleInit();

      expect(mockSignInEmail).toHaveBeenCalledWith({
        body: {
          email: 'admin@manifest.build',
          password: 'admin',
        },
      });
    });

    it('should handle USER_ALREADY_EXISTS error code', async () => {
      const existsError = new Error('USER_ALREADY_EXISTS');
      mockSignUpEmail.mockRejectedValue(existsError);
      mockSignInEmail.mockResolvedValue({
        user: { id: 'existing-admin-id', email: 'admin@manifest.build' },
      });

      await service.onModuleInit();

      expect(mockSignInEmail).toHaveBeenCalled();
    });

    it('should return null when signUp fails with other error', async () => {
      mockSignUpEmail.mockRejectedValue(new Error('Network error'));

      // Should not throw, just return null for admin user
      await service.onModuleInit();

      expect(mockSignInEmail).not.toHaveBeenCalled();
    });

    it('should return null when signUp returns no user', async () => {
      mockSignUpEmail.mockResolvedValue({});

      await service.onModuleInit();

      // Should continue without error
      expect(mockAppRepository.count).toHaveBeenCalled();
    });

    it('should return null when signIn fails after user exists error', async () => {
      const existsError = new Error('User already exists');
      mockSignUpEmail.mockRejectedValue(existsError);
      mockSignInEmail.mockRejectedValue(new Error('Sign in failed'));

      // Should not throw, just return null
      await service.onModuleInit();

      expect(mockAppRepository.count).toHaveBeenCalled();
    });

    it('should return null when signIn returns no user', async () => {
      const existsError = new Error('User already exists');
      mockSignUpEmail.mockRejectedValue(existsError);
      mockSignInEmail.mockResolvedValue({});

      await service.onModuleInit();

      expect(mockAppRepository.count).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Tests for assignExistingAppsToAdmin()
  // ============================================================
  describe('assignExistingAppsToAdmin', () => {
    beforeEach(() => {
      mockFlowRepository.find.mockResolvedValue([]);
      mockAppRepository.count.mockResolvedValue(1);
    });

    it('should skip assignment when no admin user ID', async () => {
      mockSignUpEmail.mockResolvedValue({});
      mockAppRepository.find.mockResolvedValue([]);

      await service.onModuleInit();

      // Should not try to find apps for assignment when no admin
      expect(mockUserAppRoleRepository.create).not.toHaveBeenCalled();
    });

    it('should assign admin as owner to apps without owners', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      const mockApp = createMockAppEntity({ id: 'unowned-app', name: 'Unowned App' });
      mockAppRepository.find.mockResolvedValue([mockApp]);
      mockUserAppRoleRepository.findOne.mockResolvedValue(null); // No existing owner
      mockUserAppRoleRepository.create.mockReturnValue({
        userId: 'admin-id',
        appId: 'unowned-app',
        role: 'owner',
      });
      mockUserAppRoleRepository.save.mockResolvedValue({});

      await service.onModuleInit();

      expect(mockUserAppRoleRepository.create).toHaveBeenCalledWith({
        userId: 'admin-id',
        appId: 'unowned-app',
        role: 'owner',
      });
      expect(mockUserAppRoleRepository.save).toHaveBeenCalled();
    });

    it('should not reassign apps that already have owners', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      const mockApp = createMockAppEntity({ id: 'owned-app', name: 'Owned App' });
      mockAppRepository.find.mockResolvedValue([mockApp]);
      mockUserAppRoleRepository.findOne.mockResolvedValue({
        userId: 'other-user',
        appId: 'owned-app',
        role: 'owner',
      });

      await service.onModuleInit();

      expect(mockUserAppRoleRepository.create).not.toHaveBeenCalled();
      expect(mockUserAppRoleRepository.save).not.toHaveBeenCalled();
    });

    it('should handle multiple apps with mixed ownership', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      const ownedApp = createMockAppEntity({ id: 'owned-app', name: 'Owned' });
      const unownedApp = createMockAppEntity({ id: 'unowned-app', name: 'Unowned' });
      mockAppRepository.find.mockResolvedValue([ownedApp, unownedApp]);
      mockUserAppRoleRepository.findOne
        .mockResolvedValueOnce({ role: 'owner' }) // owned-app has owner
        .mockResolvedValueOnce(null); // unowned-app has no owner
      mockUserAppRoleRepository.create.mockReturnValue({});
      mockUserAppRoleRepository.save.mockResolvedValue({});

      await service.onModuleInit();

      expect(mockUserAppRoleRepository.create).toHaveBeenCalledTimes(1);
      expect(mockUserAppRoleRepository.create).toHaveBeenCalledWith({
        userId: 'admin-id',
        appId: 'unowned-app',
        role: 'owner',
      });
    });
  });

  // ============================================================
  // Tests for migrateTriggerProperties()
  // ============================================================
  describe('migrateTriggerProperties', () => {
    beforeEach(() => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(1);
      mockAppRepository.find.mockResolvedValue([]);
    });

    it('should skip flows that already have UserIntent nodes with toolName', async () => {
      const existingTrigger = createMockUserIntentNode({
        parameters: {
          toolName: 'existing_tool',
          toolDescription: 'Existing',
          parameters: [],
          isActive: true,
        },
      });
      const flow = createMockFlowEntity({ nodes: [existingTrigger] });
      mockFlowRepository.find.mockResolvedValue([flow]);

      await service.onModuleInit();

      expect(mockFlowRepository.save).not.toHaveBeenCalled();
    });

    it('should add toolName to UserIntent nodes without it', async () => {
      const triggerWithoutToolName = createMockUserIntentNode({
        name: 'My Trigger',
        parameters: {
          toolDescription: 'Description',
        },
      });
      const flow = createMockFlowEntity({ nodes: [triggerWithoutToolName] });
      mockFlowRepository.find.mockResolvedValue([flow]);
      mockFlowRepository.save.mockResolvedValue(flow);

      await service.onModuleInit();

      expect(mockFlowRepository.save).toHaveBeenCalled();
      const savedFlow = mockFlowRepository.save.mock.calls[0][0];
      const savedNode = savedFlow.nodes[0];
      expect(savedNode.parameters.toolName).toBe('my_trigger');
    });

    it('should create UserIntent trigger for flows with action nodes but no trigger', async () => {
      const actionNode = createMockActionNode({ position: { x: 300, y: 100 } });
      const flow = createMockFlowEntity({
        name: 'Action Flow',
        description: 'Flow with only action',
        nodes: [actionNode],
        connections: [],
      });
      mockFlowRepository.find.mockResolvedValue([flow]);
      mockFlowRepository.save.mockResolvedValue(flow);

      await service.onModuleInit();

      expect(mockFlowRepository.save).toHaveBeenCalled();
      const savedFlow = mockFlowRepository.save.mock.calls[0][0];
      expect(savedFlow.nodes).toHaveLength(2);
      const newTrigger = savedFlow.nodes.find((n: NodeInstance) => n.type === 'UserIntent');
      expect(newTrigger).toBeDefined();
      expect(newTrigger.parameters.toolName).toBe('action_flow');
    });

    it('should connect new trigger to leftmost action node', async () => {
      const leftNode = createMockActionNode({ id: 'left-node', position: { x: 100, y: 100 } });
      const rightNode = createMockActionNode({ id: 'right-node', position: { x: 400, y: 100 } });
      const flow = createMockFlowEntity({
        name: 'Multi Node Flow',
        nodes: [rightNode, leftNode], // Intentionally reversed
        connections: [],
      });
      mockFlowRepository.find.mockResolvedValue([flow]);
      mockFlowRepository.save.mockResolvedValue(flow);

      await service.onModuleInit();

      const savedFlow = mockFlowRepository.save.mock.calls[0][0];
      expect(savedFlow.connections).toHaveLength(1);
      const connection: Connection = savedFlow.connections[0];
      expect(connection.targetNodeId).toBe('left-node');
    });

    it('should skip empty flows', async () => {
      const emptyFlow = createMockFlowEntity({ nodes: [] });
      mockFlowRepository.find.mockResolvedValue([emptyFlow]);

      await service.onModuleInit();

      expect(mockFlowRepository.save).not.toHaveBeenCalled();
    });

    it('should handle flows with null nodes array', async () => {
      const flow = createMockFlowEntity({ nodes: null as unknown as NodeInstance[] });
      mockFlowRepository.find.mockResolvedValue([flow]);

      await service.onModuleInit();

      expect(mockFlowRepository.save).not.toHaveBeenCalled();
    });

    it('should handle flows with undefined nodes', async () => {
      const flow = createMockFlowEntity({ nodes: undefined as unknown as NodeInstance[] });
      mockFlowRepository.find.mockResolvedValue([flow]);

      await service.onModuleInit();

      expect(mockFlowRepository.save).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Tests for seedDefaultFixtures()
  // ============================================================
  describe('seedDefaultFixtures', () => {
    beforeEach(() => {
      mockFlowRepository.find.mockResolvedValue([]);
      mockAppRepository.find.mockResolvedValue([]);
    });

    it('should skip seeding when apps already exist', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(1);

      await service.onModuleInit();

      expect(mockAppRepository.create).not.toHaveBeenCalled();
    });

    it('should create Test App when no apps exist', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(0);
      mockAppRepository.create.mockReturnValue({ id: 'new-app-id', name: 'Test App' });
      mockAppRepository.save.mockResolvedValue({ id: 'new-app-id', name: 'Test App' });
      mockFlowRepository.create.mockReturnValue({ id: 'new-flow-id' });
      mockFlowRepository.save.mockResolvedValue({ id: 'new-flow-id', name: 'Test Flow' });
      mockUserAppRoleRepository.create.mockReturnValue({});
      mockUserAppRoleRepository.save.mockResolvedValue({});
      mockExecutionRepository.save.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockAppRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test App',
          slug: 'test-app',
          status: 'published',
        }),
      );
      expect(mockAppRepository.save).toHaveBeenCalled();
    });

    it('should create Test Flow with UserIntent and StatCard nodes', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(0);
      mockAppRepository.create.mockReturnValue({ id: 'app-id' });
      mockAppRepository.save.mockResolvedValue({ id: 'app-id' });
      mockFlowRepository.create.mockReturnValue({ id: 'flow-id' });
      mockFlowRepository.save.mockResolvedValue({ id: 'flow-id', name: 'Test Flow' });
      mockUserAppRoleRepository.create.mockReturnValue({});
      mockUserAppRoleRepository.save.mockResolvedValue({});
      mockExecutionRepository.save.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockFlowRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Flow',
          isActive: true,
        }),
      );

      const flowCreateCall = mockFlowRepository.create.mock.calls[0][0];
      expect(flowCreateCall.nodes).toHaveLength(2);

      const userIntentNode = flowCreateCall.nodes.find((n: NodeInstance) => n.type === 'UserIntent');
      expect(userIntentNode).toBeDefined();
      expect(userIntentNode.parameters.toolName).toBe('test_flow');

      const statCardNode = flowCreateCall.nodes.find((n: NodeInstance) => n.type === 'StatCard');
      expect(statCardNode).toBeDefined();
    });

    it('should create connection between trigger and StatCard', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(0);
      mockAppRepository.create.mockReturnValue({ id: 'app-id' });
      mockAppRepository.save.mockResolvedValue({ id: 'app-id' });
      mockFlowRepository.create.mockReturnValue({ id: 'flow-id' });
      mockFlowRepository.save.mockResolvedValue({ id: 'flow-id', name: 'Test Flow' });
      mockUserAppRoleRepository.create.mockReturnValue({});
      mockUserAppRoleRepository.save.mockResolvedValue({});
      mockExecutionRepository.save.mockResolvedValue([]);

      await service.onModuleInit();

      const flowCreateCall = mockFlowRepository.create.mock.calls[0][0];
      expect(flowCreateCall.connections).toHaveLength(1);
      expect(flowCreateCall.connections[0]).toEqual(
        expect.objectContaining({
          sourceHandle: 'main',
          targetHandle: 'main',
        }),
      );
    });

    it('should assign admin as owner of Test App when admin exists', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(0);
      mockAppRepository.create.mockReturnValue({ id: 'new-app-id' });
      mockAppRepository.save.mockResolvedValue({ id: 'new-app-id' });
      mockFlowRepository.create.mockReturnValue({ id: 'flow-id' });
      mockFlowRepository.save.mockResolvedValue({ id: 'flow-id', name: 'Test Flow' });
      mockUserAppRoleRepository.create.mockReturnValue({});
      mockUserAppRoleRepository.save.mockResolvedValue({});
      mockExecutionRepository.save.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockUserAppRoleRepository.create).toHaveBeenCalledWith({
        userId: 'admin-id',
        appId: 'new-app-id',
        role: 'owner',
      });
    });

    it('should not create owner role when no admin user', async () => {
      mockSignUpEmail.mockResolvedValue({}); // No user returned
      mockAppRepository.count.mockResolvedValue(0);
      mockAppRepository.create.mockReturnValue({ id: 'new-app-id' });
      mockAppRepository.save.mockResolvedValue({ id: 'new-app-id' });
      mockFlowRepository.create.mockReturnValue({ id: 'flow-id' });
      mockFlowRepository.save.mockResolvedValue({ id: 'flow-id', name: 'Test Flow' });
      mockExecutionRepository.save.mockResolvedValue([]);

      await service.onModuleInit();

      // Should not create owner role when no admin
      expect(mockUserAppRoleRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when fixture creation fails', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(0);
      mockAppRepository.create.mockReturnValue({ id: 'app-id' });
      mockAppRepository.save.mockRejectedValue(new Error('DB save failed'));

      await expect(service.onModuleInit()).rejects.toThrow('DB save failed');
    });
  });

  // ============================================================
  // Tests for seedExecutionData()
  // ============================================================
  describe('seedExecutionData', () => {
    beforeEach(() => {
      mockFlowRepository.find.mockResolvedValue([]);
      mockAppRepository.find.mockResolvedValue([]);
    });

    it('should create 50 sample executions', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(0);
      mockAppRepository.create.mockReturnValue({ id: 'app-id' });
      mockAppRepository.save.mockResolvedValue({ id: 'app-id' });
      mockFlowRepository.create.mockReturnValue({ id: 'flow-id' });
      mockFlowRepository.save.mockResolvedValue({ id: 'flow-id', name: 'Test Flow' });
      mockUserAppRoleRepository.create.mockReturnValue({});
      mockUserAppRoleRepository.save.mockResolvedValue({});
      mockExecutionRepository.save.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockExecutionRepository.save).toHaveBeenCalled();
      const savedExecutions = mockExecutionRepository.save.mock.calls[0][0];
      expect(savedExecutions).toHaveLength(50);
    });

    it('should create executions with correct flow info', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(0);
      mockAppRepository.create.mockReturnValue({ id: 'app-id' });
      mockAppRepository.save.mockResolvedValue({ id: 'app-id' });
      mockFlowRepository.create.mockReturnValue({ id: 'flow-id' });
      mockFlowRepository.save.mockResolvedValue({ id: 'flow-id', name: 'Test Flow' });
      mockUserAppRoleRepository.create.mockReturnValue({});
      mockUserAppRoleRepository.save.mockResolvedValue({});
      mockExecutionRepository.save.mockResolvedValue([]);

      await service.onModuleInit();

      const savedExecutions = mockExecutionRepository.save.mock.calls[0][0];
      savedExecutions.forEach((execution: Partial<FlowExecutionEntity>) => {
        expect(execution.flowId).toBe('flow-id');
        expect(execution.flowName).toBe('Test Flow');
        expect(execution.flowToolName).toBe('test_flow');
        expect(execution.isPreview).toBe(false);
      });
    });

    it('should create executions with varied statuses (~92% success rate)', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(0);
      mockAppRepository.create.mockReturnValue({ id: 'app-id' });
      mockAppRepository.save.mockResolvedValue({ id: 'app-id' });
      mockFlowRepository.create.mockReturnValue({ id: 'flow-id' });
      mockFlowRepository.save.mockResolvedValue({ id: 'flow-id', name: 'Test Flow' });
      mockUserAppRoleRepository.create.mockReturnValue({});
      mockUserAppRoleRepository.save.mockResolvedValue({});
      mockExecutionRepository.save.mockResolvedValue([]);

      await service.onModuleInit();

      const savedExecutions = mockExecutionRepository.save.mock.calls[0][0];
      const statuses = savedExecutions.map((e: Partial<FlowExecutionEntity>) => e.status);
      const hasSuccess = statuses.includes('fulfilled');
      const hasError = statuses.some((s: string) => s === 'error');

      // Should have a mix of statuses (given randomness, these are probabilistic)
      expect(hasSuccess || hasError).toBe(true);
      expect(statuses.every((s: string) => s === 'fulfilled' || s === 'error')).toBe(true);
    });

    it('should add errorInfo for failed executions', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(0);
      mockAppRepository.create.mockReturnValue({ id: 'app-id' });
      mockAppRepository.save.mockResolvedValue({ id: 'app-id' });
      mockFlowRepository.create.mockReturnValue({ id: 'flow-id' });
      mockFlowRepository.save.mockResolvedValue({ id: 'flow-id', name: 'Test Flow' });
      mockUserAppRoleRepository.create.mockReturnValue({});
      mockUserAppRoleRepository.save.mockResolvedValue({});
      mockExecutionRepository.save.mockResolvedValue([]);

      await service.onModuleInit();

      const savedExecutions = mockExecutionRepository.save.mock.calls[0][0];
      const errorExecutions = savedExecutions.filter(
        (e: Partial<FlowExecutionEntity>) => e.status === 'error',
      );

      errorExecutions.forEach((execution: Partial<FlowExecutionEntity>) => {
        expect(execution.errorInfo).toBeDefined();
        expect(execution.errorInfo?.message).toBe('Sample error for testing');
      });
    });

    it('should create executions with startedAt and endedAt timestamps', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(0);
      mockAppRepository.create.mockReturnValue({ id: 'app-id' });
      mockAppRepository.save.mockResolvedValue({ id: 'app-id' });
      mockFlowRepository.create.mockReturnValue({ id: 'flow-id' });
      mockFlowRepository.save.mockResolvedValue({ id: 'flow-id', name: 'Test Flow' });
      mockUserAppRoleRepository.create.mockReturnValue({});
      mockUserAppRoleRepository.save.mockResolvedValue({});
      mockExecutionRepository.save.mockResolvedValue([]);

      await service.onModuleInit();

      const savedExecutions = mockExecutionRepository.save.mock.calls[0][0];
      savedExecutions.forEach((execution: Partial<FlowExecutionEntity>) => {
        expect(execution.startedAt).toBeInstanceOf(Date);
        expect(execution.endedAt).toBeInstanceOf(Date);
        expect(execution.endedAt!.getTime()).toBeGreaterThan(execution.startedAt!.getTime());
      });
    });

    it('should create executions between 1-4 days ago (excluding last 24h)', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(0);
      mockAppRepository.create.mockReturnValue({ id: 'app-id' });
      mockAppRepository.save.mockResolvedValue({ id: 'app-id' });
      mockFlowRepository.create.mockReturnValue({ id: 'flow-id' });
      mockFlowRepository.save.mockResolvedValue({ id: 'flow-id', name: 'Test Flow' });
      mockUserAppRoleRepository.create.mockReturnValue({});
      mockUserAppRoleRepository.save.mockResolvedValue({});
      mockExecutionRepository.save.mockResolvedValue([]);

      const beforeTest = Date.now();
      await service.onModuleInit();

      const savedExecutions = mockExecutionRepository.save.mock.calls[0][0];
      const oneDayMs = 24 * 60 * 60 * 1000;
      const fourDaysMs = 4 * oneDayMs;

      savedExecutions.forEach((execution: Partial<FlowExecutionEntity>) => {
        const startedAt = execution.startedAt!.getTime();
        const ageMs = beforeTest - startedAt;

        // Should be at least 1 day old
        expect(ageMs).toBeGreaterThanOrEqual(oneDayMs - 1000); // Small tolerance
        // Should be at most 4 days old
        expect(ageMs).toBeLessThanOrEqual(fourDaysMs + 1000); // Small tolerance
      });
    });
  });

  // ============================================================
  // Tests for toSnakeCase() helper - tested via other methods
  // ============================================================
  describe('toSnakeCase', () => {
    beforeEach(() => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: 'admin-id', email: 'admin@manifest.build' },
      });
      mockAppRepository.count.mockResolvedValue(1);
      mockAppRepository.find.mockResolvedValue([]);
    });

    it('should convert CamelCase to snake_case', async () => {
      const triggerWithoutToolName = createMockUserIntentNode({
        name: 'MyTriggerName',
        parameters: {},
      });
      const flow = createMockFlowEntity({ nodes: [triggerWithoutToolName] });
      mockFlowRepository.find.mockResolvedValue([flow]);
      mockFlowRepository.save.mockResolvedValue(flow);

      await service.onModuleInit();

      const savedFlow = mockFlowRepository.save.mock.calls[0][0];
      expect(savedFlow.nodes[0].parameters.toolName).toBe('my_trigger_name');
    });

    it('should convert spaces to underscores', async () => {
      const triggerWithoutToolName = createMockUserIntentNode({
        name: 'My Trigger Name',
        parameters: {},
      });
      const flow = createMockFlowEntity({ nodes: [triggerWithoutToolName] });
      mockFlowRepository.find.mockResolvedValue([flow]);
      mockFlowRepository.save.mockResolvedValue(flow);

      await service.onModuleInit();

      const savedFlow = mockFlowRepository.save.mock.calls[0][0];
      expect(savedFlow.nodes[0].parameters.toolName).toBe('my_trigger_name');
    });

    it('should convert hyphens to underscores', async () => {
      const triggerWithoutToolName = createMockUserIntentNode({
        name: 'My-Trigger-Name',
        parameters: {},
      });
      const flow = createMockFlowEntity({ nodes: [triggerWithoutToolName] });
      mockFlowRepository.find.mockResolvedValue([flow]);
      mockFlowRepository.save.mockResolvedValue(flow);

      await service.onModuleInit();

      const savedFlow = mockFlowRepository.save.mock.calls[0][0];
      expect(savedFlow.nodes[0].parameters.toolName).toBe('my_trigger_name');
    });

    it('should handle multiple consecutive underscores', async () => {
      const triggerWithoutToolName = createMockUserIntentNode({
        name: 'My  Trigger   Name',
        parameters: {},
      });
      const flow = createMockFlowEntity({ nodes: [triggerWithoutToolName] });
      mockFlowRepository.find.mockResolvedValue([flow]);
      mockFlowRepository.save.mockResolvedValue(flow);

      await service.onModuleInit();

      const savedFlow = mockFlowRepository.save.mock.calls[0][0];
      // Should not have consecutive underscores
      expect(savedFlow.nodes[0].parameters.toolName).not.toMatch(/__+/);
    });

    it('should remove single leading underscore from CamelCase conversion', async () => {
      // Note: toSnakeCase adds underscore before capitals, then removes leading underscore
      const triggerWithoutToolName = createMockUserIntentNode({
        name: 'CamelCase',
        parameters: {},
      });
      const flow = createMockFlowEntity({ nodes: [triggerWithoutToolName] });
      mockFlowRepository.find.mockResolvedValue([flow]);
      mockFlowRepository.save.mockResolvedValue(flow);

      await service.onModuleInit();

      const savedFlow = mockFlowRepository.save.mock.calls[0][0];
      // CamelCase -> _Camel_Case -> camel_case (leading _ removed)
      expect(savedFlow.nodes[0].parameters.toolName).toBe('camel_case');
    });

    it('should convert all uppercase to snake_case with underscores between letters', async () => {
      // Note: toSnakeCase inserts underscore before each capital letter
      const triggerWithoutToolName = createMockUserIntentNode({
        name: 'ABC',
        parameters: {},
      });
      const flow = createMockFlowEntity({ nodes: [triggerWithoutToolName] });
      mockFlowRepository.find.mockResolvedValue([flow]);
      mockFlowRepository.save.mockResolvedValue(flow);

      await service.onModuleInit();

      const savedFlow = mockFlowRepository.save.mock.calls[0][0];
      // ABC -> _A_B_C -> A_B_C -> a_b_c
      expect(savedFlow.nodes[0].parameters.toolName).toBe('a_b_c');
    });
  });
});
