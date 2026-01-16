/**
 * Unit tests for ChatController
 *
 * Tests HTTP endpoint behavior with mocked ChatService.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { of, Subject } from 'rxjs';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import type { ModelListResponse, ChatStreamEvent } from '@chatgpt-app-builder/shared';

describe('ChatController', () => {
  let controller: ChatController;
  let mockService: {
    getModels: jest.Mock;
    validateApiKey: jest.Mock;
    streamChat: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      getModels: jest.fn(),
      validateApiKey: jest.fn(),
      streamChat: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================================
  // Tests for GET /api/chat/models
  // ============================================================
  describe('getModels', () => {
    const mockModels: ModelListResponse = {
      models: [
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Most capable' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: 'Fast' },
      ],
    };

    it('should return list of models', async () => {
      mockService.getModels.mockResolvedValue(mockModels);

      const result = await controller.getModels();

      expect(result).toEqual(mockModels);
      expect(mockService.getModels).toHaveBeenCalled();
    });

    it('should call service getModels', async () => {
      mockService.getModels.mockResolvedValue(mockModels);

      await controller.getModels();

      expect(mockService.getModels).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // Tests for POST /api/chat/validate-key
  // ============================================================
  describe('validateKey', () => {
    it('should validate key and return response', async () => {
      mockService.validateApiKey.mockResolvedValue({ valid: true });

      const result = await controller.validateKey({ apiKey: 'sk-test' });

      expect(result).toEqual({ valid: true });
      expect(mockService.validateApiKey).toHaveBeenCalledWith('sk-test');
    });

    it('should throw BadRequest when apiKey is missing', async () => {
      await expect(controller.validateKey({ apiKey: '' })).rejects.toThrow(HttpException);

      try {
        await controller.validateKey({ apiKey: '' });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('should return invalid response for bad key', async () => {
      mockService.validateApiKey.mockResolvedValue({
        valid: false,
        error: 'Invalid format',
      });

      const result = await controller.validateKey({ apiKey: 'bad-key' });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid format');
    });
  });

  // ============================================================
  // Tests for POST /api/chat/stream
  // ============================================================
  describe('streamChat', () => {
    const validBody = {
      flowId: 'flow-1',
      model: 'gpt-4o',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    it('should throw Unauthorized when x-api-key header is missing', () => {
      expect(() => controller.streamChat(validBody, '')).toThrow(HttpException);

      try {
        controller.streamChat(validBody, '');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect((error as HttpException).message).toContain('x-api-key');
      }
    });

    it('should throw BadRequest when flowId is missing', () => {
      const body = { ...validBody, flowId: '' };

      expect(() => controller.streamChat(body, 'sk-key')).toThrow(HttpException);

      try {
        controller.streamChat(body, 'sk-key');
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect((error as HttpException).message).toContain('flowId');
      }
    });

    it('should throw BadRequest when model is missing', () => {
      const body = { ...validBody, model: '' };

      expect(() => controller.streamChat(body, 'sk-key')).toThrow(HttpException);

      try {
        controller.streamChat(body, 'sk-key');
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect((error as HttpException).message).toContain('model');
      }
    });

    it('should throw BadRequest when messages array is empty', () => {
      const body = { ...validBody, messages: [] };

      expect(() => controller.streamChat(body, 'sk-key')).toThrow(HttpException);

      try {
        controller.streamChat(body, 'sk-key');
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect((error as HttpException).message).toContain('messages');
      }
    });

    it('should throw BadRequest when messages is undefined', () => {
      const body = { flowId: 'flow-1', model: 'gpt-4o' } as typeof validBody;

      expect(() => controller.streamChat(body, 'sk-key')).toThrow(HttpException);
    });

    it('should return Observable that emits MessageEvent', (done) => {
      const events: ChatStreamEvent[] = [
        { type: 'start', messageId: 'msg-1' },
        { type: 'token', content: 'Hello' },
        { type: 'end', messageId: 'msg-1' },
      ];
      const subject = new Subject<ChatStreamEvent>();
      mockService.streamChat.mockReturnValue(subject.asObservable());

      const result = controller.streamChat(validBody, 'sk-api-key');
      const receivedEvents: { data: string }[] = [];

      result.subscribe({
        next: (event) => receivedEvents.push(event),
        complete: () => {
          expect(receivedEvents).toHaveLength(3);
          expect(JSON.parse(receivedEvents[0].data)).toEqual(events[0]);
          expect(JSON.parse(receivedEvents[1].data)).toEqual(events[1]);
          expect(JSON.parse(receivedEvents[2].data)).toEqual(events[2]);
          done();
        },
      });

      // Emit events
      events.forEach(e => subject.next(e));
      subject.complete();
    });

    it('should pass correct parameters to service', () => {
      mockService.streamChat.mockReturnValue(of({ type: 'end', messageId: 'msg' }));

      controller.streamChat(validBody, 'sk-my-key');

      expect(mockService.streamChat).toHaveBeenCalledWith(validBody, 'sk-my-key');
    });

    it('should stringify events as JSON in data field', (done) => {
      const event: ChatStreamEvent = { type: 'token', content: 'test content' };
      mockService.streamChat.mockReturnValue(of(event));

      controller.streamChat(validBody, 'sk-key').subscribe({
        next: (messageEvent) => {
          expect(messageEvent.data).toBe(JSON.stringify(event));
          done();
        },
      });
    });

    it('should handle tool_call events', (done) => {
      const toolCallEvent: ChatStreamEvent = {
        type: 'tool_call',
        toolCall: {
          id: 'call_1',
          name: 'search',
          arguments: { query: 'test' },
        },
      };
      mockService.streamChat.mockReturnValue(of(toolCallEvent));

      controller.streamChat(validBody, 'sk-key').subscribe({
        next: (messageEvent) => {
          const parsed = JSON.parse(messageEvent.data);
          expect(parsed.type).toBe('tool_call');
          expect(parsed.toolCall.name).toBe('search');
          done();
        },
      });
    });

    it('should handle error events', (done) => {
      const errorEvent: ChatStreamEvent = {
        type: 'error',
        error: 'Something went wrong',
      };
      mockService.streamChat.mockReturnValue(of(errorEvent));

      controller.streamChat(validBody, 'sk-key').subscribe({
        next: (messageEvent) => {
          const parsed = JSON.parse(messageEvent.data);
          expect(parsed.type).toBe('error');
          expect(parsed.error).toBe('Something went wrong');
          done();
        },
      });
    });
  });
});
