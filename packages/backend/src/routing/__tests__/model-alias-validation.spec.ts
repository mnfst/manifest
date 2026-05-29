import { BadRequestException } from '@nestjs/common';
import { assertAliasRouteConfigured, parseModelAliasFromBody } from '../model-alias-validation';

const headerTierService = {
  findByModelAlias: jest.fn(),
};

const routingAliasService = {
  listConfiguredAliases: jest.fn().mockResolvedValue(['auto', 'coding', 'super']),
};

describe('parseModelAliasFromBody', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    routingAliasService.listConfiguredAliases.mockResolvedValue(['auto', 'coding', 'super']);
    headerTierService.findByModelAlias.mockResolvedValue(null);
  });

  it('returns a classified alias for a valid built-in model', async () => {
    await expect(
      parseModelAliasFromBody({ model: 'coding', messages: [] }, 'agent-1', {
        headerTierService,
        routingAliasService,
      }),
    ).resolves.toEqual({ kind: 'specificity', category: 'coding' });
  });

  it('returns header_tier when a custom tier alias matches', async () => {
    headerTierService.findByModelAlias.mockResolvedValue({ id: 'ht-1', name: 'Super' });
    await expect(
      parseModelAliasFromBody({ model: 'super', messages: [] }, 'agent-1', {
        headerTierService,
        routingAliasService,
      }),
    ).resolves.toEqual({ kind: 'header_tier', id: 'ht-1' });
  });

  it('throws M410 when model is missing', async () => {
    await expect(
      parseModelAliasFromBody({ messages: [] }, 'agent-1', {
        headerTierService,
        routingAliasService,
      }),
    ).rejects.toThrow(BadRequestException);
    try {
      await parseModelAliasFromBody({ messages: [] }, 'agent-1', {
        headerTierService,
        routingAliasService,
      });
    } catch (err) {
      const msg = (err as BadRequestException).message;
      expect(msg).toContain('M410');
      expect(msg).toContain('super');
      expect(msg).toContain('auto');
    }
  });

  it('throws M410 for an unrecognized model', async () => {
    await expect(
      parseModelAliasFromBody({ model: 'banana' }, 'agent-1', {
        headerTierService,
        routingAliasService,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws M410 when a built-in alias is not configured for the agent', async () => {
    routingAliasService.listConfiguredAliases.mockResolvedValue(['auto', 'default']);
    await expect(
      parseModelAliasFromBody({ model: 'simple' }, 'agent-1', {
        headerTierService,
        routingAliasService,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('assertAliasRouteConfigured', () => {
  it('throws M411 when route is null', () => {
    expect(() =>
      assertAliasRouteConfigured('super', { route: null } as never, 'https://dash/routing'),
    ).toThrow(BadRequestException);
  });

  it('does not throw when route is set', () => {
    expect(() =>
      assertAliasRouteConfigured(
        'simple',
        { route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' } } as never,
        'https://dash/routing',
      ),
    ).not.toThrow();
  });
});
