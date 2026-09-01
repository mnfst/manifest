import { Repository } from 'typeorm';
import { WaitlistClaim } from '../entities/waitlist-claim.entity';
import { WaitlistController } from './waitlist.controller';

describe('WaitlistController', () => {
  let upsert: jest.Mock;
  let controller: WaitlistController;

  beforeEach(() => {
    upsert = jest.fn().mockResolvedValue(undefined);
    controller = new WaitlistController({ upsert } as unknown as Repository<WaitlistClaim>);
  });

  it('keeps the legacy self-hosted claim endpoint as a no-op success', () => {
    expect(controller.receiveClaim()).toEqual({ ok: true });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('stores a pivot claim with a normalized email, deduped by email', async () => {
    await expect(controller.receivePivotClaim({ email: '  Jane@Example.COM ' })).resolves.toEqual({
      ok: true,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@example.com', source: 'pivot' }),
      { conflictPaths: ['email'] },
    );
    const row = upsert.mock.calls[0][0] as { claimed_at: string };
    expect(Number.isNaN(Date.parse(row.claimed_at))).toBe(false);
  });
});
