import { BadRequestException } from '@nestjs/common';
import { SpecificityController } from './specificity.controller';
import { SpecificityService } from './routing-core/specificity.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import type { TenantContext } from '../common/decorators/tenant-context.decorator';

describe('SpecificityController.setResponseMode', () => {
  const ctx: TenantContext = { tenantId: 'tenant-1', userId: 'user-1' };
  const agent = { id: 'agent-1', tenant_id: 'tenant-1' };
  let specificityService: { setResponseMode: jest.Mock };
  let resolveAgentService: { resolve: jest.Mock };
  let controller: SpecificityController;

  beforeEach(() => {
    specificityService = {
      setResponseMode: jest
        .fn()
        .mockResolvedValue({ category: 'coding', response_mode: 'buffered' }),
    };
    resolveAgentService = { resolve: jest.fn().mockResolvedValue(agent) };
    controller = new SpecificityController(
      specificityService as unknown as SpecificityService,
      resolveAgentService as unknown as ResolveAgentService,
    );
  });

  it('sets the response mode for a valid category', async () => {
    const out = await controller.setResponseMode(ctx, 'demo', 'coding', {
      response_mode: 'buffered',
    });
    expect(out).toEqual({ category: 'coding', response_mode: 'buffered' });
    expect(specificityService.setResponseMode).toHaveBeenCalledWith(
      'agent-1',
      'coding',
      'buffered',
    );
  });

  it('rejects an unknown category', async () => {
    await expect(
      controller.setResponseMode(ctx, 'demo', 'not-a-category', { response_mode: 'buffered' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing response_mode', async () => {
    await expect(controller.setResponseMode(ctx, 'demo', 'coding', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
