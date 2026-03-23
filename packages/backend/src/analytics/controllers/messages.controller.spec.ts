import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagesQueryService } from '../services/messages-query.service';
import { MessageDetailsService } from '../services/message-details.service';

describe('MessagesController', () => {
  let controller: MessagesController;
  let mockGetMessages: jest.Mock;
  let mockGetDetails: jest.Mock;

  beforeEach(async () => {
    mockGetMessages = jest.fn().mockResolvedValue({
      items: [],
      next_cursor: null,
      total_count: 0,
      providers: [],
    });

    mockGetDetails = jest.fn().mockResolvedValue({
      message: { id: 'msg-1', status: 'ok' },
      llm_calls: [],
      tool_executions: [],
      agent_logs: [],
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesQueryService,
          useValue: { getMessages: mockGetMessages },
        },
        {
          provide: MessageDetailsService,
          useValue: { getDetails: mockGetDetails },
        },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
  });

  it('delegates to messages query service with default values', async () => {
    const user = { id: 'u1' };
    await controller.getMessages({} as never, user as never);

    expect(mockGetMessages).toHaveBeenCalledWith({
      range: undefined,
      userId: 'u1',
      provider: undefined,
      service_type: undefined,
      cost_min: undefined,
      cost_max: undefined,
      limit: 50,
      cursor: undefined,
      agent_name: undefined,
    });
  });

  it('passes all filter parameters', async () => {
    const user = { id: 'u1' };
    const query = {
      range: '7d',
      provider: 'openai',
      service_type: 'agent',
      cost_min: 0.01,
      cost_max: 10.0,
      limit: 25,
      cursor: 'ts|id',
      agent_name: 'bot-1',
    };
    await controller.getMessages(query as never, user as never);

    expect(mockGetMessages).toHaveBeenCalledWith({
      range: '7d',
      userId: 'u1',
      provider: 'openai',
      service_type: 'agent',
      cost_min: 0.01,
      cost_max: 10.0,
      limit: 25,
      cursor: 'ts|id',
      agent_name: 'bot-1',
    });
  });

  it('caps limit at 200', async () => {
    const user = { id: 'u1' };
    await controller.getMessages({ limit: 500 } as never, user as never);

    const call = mockGetMessages.mock.calls[0][0];
    expect(call.limit).toBe(200);
  });

  it('returns the service result', async () => {
    const expected = {
      items: [{ id: '1' }],
      next_cursor: 'ts|id',
      total_count: 100,
      providers: ['anthropic', 'openai'],
    };
    mockGetMessages.mockResolvedValue(expected);

    const user = { id: 'u1' };
    const result = await controller.getMessages({} as never, user as never);

    expect(result).toEqual(expected);
  });

  it('delegates getMessageDetails to message details service', async () => {
    const user = { id: 'u1' };
    await controller.getMessageDetails('msg-123', user as never);

    expect(mockGetDetails).toHaveBeenCalledWith('msg-123', 'u1');
  });

  it('returns message details result', async () => {
    const expected = {
      message: { id: 'msg-1', status: 'ok' },
      llm_calls: [{ id: 'lc-1' }],
      tool_executions: [],
      agent_logs: [],
    };
    mockGetDetails.mockResolvedValue(expected);

    const user = { id: 'u1' };
    const result = await controller.getMessageDetails('msg-1', user as never);

    expect(result).toEqual(expected);
  });
});
