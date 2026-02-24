import { ResolveController } from './resolve.controller';
import { ResolveService } from './resolve.service';
import { ResolveResponse } from './dto/resolve-response';

describe('ResolveController', () => {
  let controller: ResolveController;
  let mockResolveService: { resolve: jest.Mock };

  const mockResponse: ResolveResponse = {
    tier: 'simple',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
    confidence: 0.9,
    score: -0.3,
    reason: 'short_message',
  };

  beforeEach(() => {
    mockResolveService = {
      resolve: jest.fn().mockResolvedValue(mockResponse),
    };
    controller = new ResolveController(
      mockResolveService as unknown as ResolveService,
    );
  });

  it('should pass userId from ingestionContext to service', async () => {
    const req = {
      ingestionContext: {
        userId: 'user-42',
        tenantId: 't1',
        agentId: 'a1',
        agentName: 'test',
      },
    } as never;

    await controller.resolve(
      { messages: [{ role: 'user', content: 'hi' }] } as never,
      req,
    );

    expect(mockResolveService.resolve).toHaveBeenCalledWith(
      'user-42',
      [{ role: 'user', content: 'hi' }],
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('should pass all optional fields to service', async () => {
    const req = {
      ingestionContext: { userId: 'user-1', tenantId: 't', agentId: 'a', agentName: 'n' },
    } as never;
    const body = {
      messages: [{ role: 'user', content: 'test' }],
      tools: [{ name: 'search' }],
      tool_choice: 'auto',
      max_tokens: 1000,
      recentTiers: ['simple', 'standard'] as const,
    };

    await controller.resolve(body as never, req);

    expect(mockResolveService.resolve).toHaveBeenCalledWith(
      'user-1',
      body.messages,
      body.tools,
      'auto',
      1000,
      ['simple', 'standard'],
    );
  });

  it('should return the resolve response directly', async () => {
    const req = {
      ingestionContext: { userId: 'u', tenantId: 't', agentId: 'a', agentName: 'n' },
    } as never;

    const result = await controller.resolve(
      { messages: [{ role: 'user', content: 'hi' }] } as never,
      req,
    );

    expect(result).toBe(mockResponse);
  });
});
