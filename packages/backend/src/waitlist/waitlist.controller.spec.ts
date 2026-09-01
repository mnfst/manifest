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

  it('stores a pivot claim with a normalized email', async () => {
    await expect(controller.receivePivotClaim({ email: '  Jane@Example.COM ' })).resolves.toEqual({
      ok: true,
    });

    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@example.com', source: 'pivot' }),
    );
    const row = chain.values.mock.calls[0][0] as { claimed_at: string };
    expect(Number.isNaN(Date.parse(row.claimed_at))).toBe(false);
  });

  it('only refreshes claimed_at on an email conflict, preserving the original source', async () => {
    await controller.receivePivotClaim({ email: 'jane@example.com' });
    expect(chain.orUpdate).toHaveBeenCalledWith(['claimed_at'], ['email']);
  });
});
