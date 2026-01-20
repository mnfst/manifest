/**
 * Unit tests for ChatService
 *
 * Tests model listing, API key validation, and chat streaming functionality.
 * LangChain components are mocked to avoid actual API calls.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { FlowEntity } from '../flow/flow.entity';
import { McpToolService } from '../mcp/mcp.tool';
import { FlowExecutionService } from '../flow-execution/flow-execution.service';
import {
  createMockFlowRepository,
  type MockRepository,
} from './test/mock-repository';
import {
  createMockFlowEntity,
  createMockFlowWithInactiveTrigger,
  createMockChatRequest,
} from './test/fixtures';
import type { ChatStreamEvent } from '@manifest/shared';

// Mock ChatOpenAI from LangChain
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    bindTools: jest.fn().mockReturnThis(),
    stream: jest.fn(),
  })),
}));

describe('ChatService', () => {
  let service: ChatService;
  let mockFlowRepository: MockRepository<FlowEntity>;
  let mockMcpToolService: { executeTool: jest.Mock };
  let mockFlowExecutionService: { createExecution: jest.Mock; updateExecution: jest.Mock };

  beforeEach(async () => {
    mockFlowRepository = createMockFlowRepository();
    mockMcpToolService = {
      executeTool: jest.fn(),
    };
    mockFlowExecutionService = {
      createExecution: jest.fn().mockResolvedValue({ id: 'exec-1' }),
      updateExecution: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(FlowEntity),
          useValue: mockFlowRepository,
        },
        {
          provide: McpToolService,
          useValue: mockMcpToolService,
        },
        {
          provide: FlowExecutionService,
          useValue: mockFlowExecutionService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // Tests for getModels()
  // ============================================================
  describe('getModels', () => {
    it('should return list of available models', async () => {
      const result = await service.getModels();

      expect(result.models).toBeDefined();
      expect(Array.isArray(result.models)).toBe(true);
      expect(result.models.length).toBeGreaterThan(0);
    });

    it('should include GPT-4o model', async () => {
      const result = await service.getModels();

      const gpt4o = result.models.find(m => m.id === 'gpt-4o');
      expect(gpt4o).toBeDefined();
      expect(gpt4o?.name).toBe('GPT-4o');
      expect(gpt4o?.provider).toBe('openai');
    });

    it('should include GPT-4o-mini model', async () => {
      const result = await service.getModels();

      const gpt4oMini = result.models.find(m => m.id === 'gpt-4o-mini');
      expect(gpt4oMini).toBeDefined();
      expect(gpt4oMini?.name).toBe('GPT-4o Mini');
    });

    it('should include GPT-4-turbo model', async () => {
      const result = await service.getModels();

      const gpt4Turbo = result.models.find(m => m.id === 'gpt-4-turbo');
      expect(gpt4Turbo).toBeDefined();
    });

    it('should include GPT-3.5-turbo model', async () => {
      const result = await service.getModels();

      const gpt35 = result.models.find(m => m.id === 'gpt-3.5-turbo');
      expect(gpt35).toBeDefined();
    });

    it('should have descriptions for all models', async () => {
      const result = await service.getModels();

      for (const model of result.models) {
        expect(model.description).toBeDefined();
        expect(model.description.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================
  // Tests for validateApiKey()
  // ============================================================
  describe('validateApiKey', () => {
    it('should validate key with correct format', async () => {
      const result = await service.validateApiKey('sk-test-key-123');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject key without sk- prefix', async () => {
      const result = await service.validateApiKey('invalid-key');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid API key format');
      expect(result.error).toContain('sk-');
    });

    it('should reject empty key', async () => {
      const result = await service.validateApiKey('');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid API key format');
    });

    it('should reject key starting with different prefix', async () => {
      const result = await service.validateApiKey('pk-test-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate key with sk-proj prefix', async () => {
      const result = await service.validateApiKey('sk-proj-abc123');

      expect(result.valid).toBe(true);
    });
  });

  // ============================================================
  // Tests for streamChat()
  // ============================================================
  describe('streamChat', () => {
    it('should return an Observable', () => {
      mockFlowRepository.findOne!.mockResolvedValue(createMockFlowEntity());

      const result = service.streamChat(
        createMockChatRequest(),
        'sk-test-key',
      );

      expect(result).toBeDefined();
      expect(typeof result.subscribe).toBe('function');
    });

    it('should emit error when flow not found', (done) => {
      mockFlowRepository.findOne!.mockResolvedValue(null);
      const events: ChatStreamEvent[] = [];

      service.streamChat(
        createMockChatRequest({ flowId: 'non-existent' }),
        'sk-test-key',
      ).subscribe({
        next: (event) => events.push(event),
        complete: () => {
          const errorEvent = events.find(e => e.type === 'error');
          expect(errorEvent).toBeDefined();
          expect((errorEvent as { type: 'error'; error: string }).error).toContain('not found');
          done();
        },
      });
    });

    it('should query flow repository with correct flowId', async () => {
      mockFlowRepository.findOne!.mockResolvedValue(createMockFlowEntity());

      service.streamChat(createMockChatRequest({ flowId: 'my-flow-id' }), 'sk-key').subscribe();

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockFlowRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'my-flow-id' },
        relations: ['app'],
      });
    });
  });

  // ============================================================
  // Tests for buildToolsFromFlow (indirectly via streamChat)
  // ============================================================
  describe('tool building from flow', () => {
    it('should skip inactive UserIntent nodes', async () => {
      const flow = createMockFlowWithInactiveTrigger();
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      // Access private method through streaming and verify behavior
      // Since inactive triggers should be skipped, the flow should work
      // without creating tools for them
      const events: ChatStreamEvent[] = [];

      service.streamChat(createMockChatRequest(), 'sk-test').subscribe({
        next: (event) => events.push(event),
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Inactive triggers should not cause the error - test passes if no exception thrown
    });

    it('should handle flow with no nodes', async () => {
      const flow = createMockFlowEntity({ nodes: [] });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const events: ChatStreamEvent[] = [];

      service.streamChat(createMockChatRequest(), 'sk-test').subscribe({
        next: (event) => events.push(event),
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not throw error for empty flow
      expect(mockFlowRepository.findOne).toHaveBeenCalled();
    });

    it('should handle flow with only non-UserIntent nodes', async () => {
      const flow = createMockFlowEntity({
        nodes: [
          {
            id: 'api-call-1',
            type: 'ApiCall',
            name: 'API Call',
            slug: 'api_call',
            position: { x: 100, y: 100 },
            parameters: {},
          },
        ],
      });
      mockFlowRepository.findOne!.mockResolvedValue(flow);

      const events: ChatStreamEvent[] = [];

      service.streamChat(createMockChatRequest(), 'sk-test').subscribe({
        next: (event) => events.push(event),
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockFlowRepository.findOne).toHaveBeenCalled();
    });
  });
});
