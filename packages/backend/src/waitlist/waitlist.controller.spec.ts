import { Repository } from 'typeorm';
import { WaitlistClaim } from '../entities/waitlist-claim.entity';
import { WaitlistController } from './waitlist.controller';

describe('WaitlistController', () => {
  let chain: {
    insert: jest.Mock;
    into: jest.Mock;
    values: jest.Mock;
    orUpdate: jest.Mock;
    execute: jest.Mock;
  };
  let controller: WaitlistController;

  beforeEach(() => {
    chain = {
      insert: jest.fn(),
      into: jest.fn(),
      values: jest.fn(),
      orUpdate: jest.fn(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    chain.insert.mockReturnValue(chain);
    chain.into.mockReturnValue(chain);
    chain.values.mockReturnValue(chain);
    chain.orUpdate.mockReturnValue(chain);
    controller = new WaitlistController({
      createQueryBuilder: () => chain,
    } as unknown as Repository<WaitlistClaim>);
  });

  it('keeps the legacy self-hosted claim endpoint as a no-op success', () => {
    expect(controller.receiveClaim()).toEqual({ ok: true });
    expect(chain.execute).not.toHaveBeenCalled();
  });

  it('stores a claim with a normalized email and the declared source', async () => {
    await expect(
      controller.receivePivotClaim({ email: '  Jane@Example.COM ', source: 'cloud' }),
    ).resolves.toEqual({ ok: true });

    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@example.com', source: 'cloud' }),
    );
    const row = chain.values.mock.calls[0][0] as { claimed_at: string };
    expect(Number.isNaN(Date.parse(row.claimed_at))).toBe(false);
  });

  it('defaults a missing source to self-hosted', async () => {
    await controller.receivePivotClaim({ email: 'jane@example.com' });
    expect(chain.values).toHaveBeenCalledWith(expect.objectContaining({ source: 'self-hosted' }));
  });

  it('lets the latest claim win on an email conflict, source included', async () => {
    await controller.receivePivotClaim({ email: 'jane@example.com', source: 'self-hosted' });
    expect(chain.orUpdate).toHaveBeenCalledWith(['source', 'claimed_at'], ['email']);
  });
});
