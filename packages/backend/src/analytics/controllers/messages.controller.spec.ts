import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { AggregationService } from '../services/aggregation.service';

describe('MessagesController', () => {
  let controller: MessagesController;
  let mockGetMessages: jest.Mock;

  beforeEach(async () => {
    mockGetMessages = jest.fn().mockResolvedValue({
      items: [],
      next_cursor: null,
      total_count: 0,
      models: [],
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: AggregationService,
          useValue: { getMessages: mockGetMessages },
        },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
  });

  it('delegates to aggregation service with default values', async () => {
    const user = { id: 'u1' };
    await controller.getMessages({} as never, user as never);

    expect(mockGetMessages).toHaveBeenCalledWith({
      range: '24h',
      userId: 'u1',
      status: undefined,
      service_type: undefined,
      model: undefined,
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
      status: 'error',
      service_type: 'agent',
      model: 'claude-opus-4-6',
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
      status: 'error',
      service_type: 'agent',
      model: 'claude-opus-4-6',
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
      models: ['claude-opus-4-6'],
    };
    mockGetMessages.mockResolvedValue(expected);

    const user = { id: 'u1' };
    const result = await controller.getMessages({} as never, user as never);

    expect(result).toEqual(expected);
  });
});
