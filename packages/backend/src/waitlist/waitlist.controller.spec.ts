import { WaitlistController } from './waitlist.controller';
import { WaitlistSyncService } from './waitlist-sync.service';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { Tenant } from '../entities/tenant.entity';
import { WaitlistClaim } from '../entities/waitlist-claim.entity';
import type { AutofixService } from '../routing/autofix/autofix.service';

type ReqWithUser = Request & { user?: { email?: string } };

function fakeReq(email?: string): ReqWithUser {
  return { user: email !== undefined ? { email } : undefined } as ReqWithUser;
}

describe('WaitlistController', () => {
  let controller: WaitlistController;
  let tenantRepo: jest.Mocked<Pick<Repository<Tenant>, 'findOne' | 'update'>>;
  let claimRepo: jest.Mocked<Pick<Repository<WaitlistClaim>, 'upsert'>>;
  let waitlistSync: jest.Mocked<WaitlistSyncService>;
  let autofixService: { invalidateAccess: jest.Mock };

  beforeEach(() => {
    tenantRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    claimRepo = {
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    waitlistSync = {
      syncClaim: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<WaitlistSyncService>;
    autofixService = { invalidateAccess: jest.fn() };
    controller = new WaitlistController(
      tenantRepo as unknown as Repository<Tenant>,
      claimRepo as unknown as Repository<WaitlistClaim>,
      waitlistSync,
      autofixService as unknown as AutofixService,
    );
  });

  describe('getStatus', () => {
    it('returns not joined when tenant has no waitlist timestamp', async () => {
      tenantRepo.findOne.mockResolvedValue({ autofix_waitlist_at: null } as Tenant);
      const result = await controller.getStatus({ tenantId: 't1', userId: 'u1' });
      expect(result).toEqual({ joined: false, joinedAt: null });
    });

    it('returns joined when tenant has a waitlist timestamp', async () => {
      const ts = '2026-06-25T10:00:00.000Z';
      tenantRepo.findOne.mockResolvedValue({ autofix_waitlist_at: ts } as Tenant);
      const result = await controller.getStatus({ tenantId: 't1', userId: 'u1' });
      expect(result).toEqual({ joined: true, joinedAt: ts });
    });

    it('returns not joined when tenantId is null', async () => {
      const result = await controller.getStatus({ tenantId: null, userId: 'u1' });
      expect(result).toEqual({ joined: false, joinedAt: null });
      expect(tenantRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns not joined when tenant is not found', async () => {
      tenantRepo.findOne.mockResolvedValue(null);
      const result = await controller.getStatus({ tenantId: 't1', userId: 'u1' });
      expect(result).toEqual({ joined: false, joinedAt: null });
    });
  });

  describe('join', () => {
    it('sets autofix_waitlist_at, grants early access, and returns joined status', async () => {
      const result = await controller.join(
        { tenantId: 't1', userId: 'u1' },
        fakeReq('user@example.com'),
      );
      expect(tenantRepo.update).toHaveBeenCalledWith('t1', {
        autofix_waitlist_at: expect.any(String),
      });
      // Joining drops the cached access decision so the toggle shows immediately.
      expect(autofixService.invalidateAccess).toHaveBeenCalledWith('t1');
      expect(result.joined).toBe(true);
      expect(result.joinedAt).toBeTruthy();
    });

    it('calls waitlistSync.syncClaim with the user email from session', async () => {
      await controller.join({ tenantId: 't1', userId: 'u1' }, fakeReq('user@example.com'));
      expect(waitlistSync.syncClaim).toHaveBeenCalledWith('user@example.com');
    });

    it('calls waitlistSync.syncClaim with empty string when user has no email', async () => {
      await controller.join({ tenantId: 't1', userId: 'u1' }, fakeReq());
      expect(waitlistSync.syncClaim).toHaveBeenCalledWith('');
    });

    it('returns not joined (and grants nothing) when tenantId is null', async () => {
      const result = await controller.join(
        { tenantId: null, userId: 'u1' },
        fakeReq('user@example.com'),
      );
      expect(tenantRepo.update).not.toHaveBeenCalled();
      expect(autofixService.invalidateAccess).not.toHaveBeenCalled();
      expect(result.joined).toBe(false);
    });

    it('does not fail when waitlistSync.syncClaim rejects', async () => {
      waitlistSync.syncClaim.mockRejectedValue(new Error('boom'));
      const result = await controller.join(
        { tenantId: 't1', userId: 'u1' },
        fakeReq('user@example.com'),
      );
      expect(result.joined).toBe(true);
    });
  });

  describe('receiveClaim', () => {
    it('upserts the email and returns ok', async () => {
      const result = await controller.receiveClaim({ email: 'user@example.com' });
      expect(claimRepo.upsert).toHaveBeenCalledWith(
        {
          email: 'user@example.com',
          source: 'self-hosted',
          claimed_at: expect.any(String),
        },
        { conflictPaths: ['email'] },
      );
      expect(result).toEqual({ ok: true });
    });

    it('handles duplicate emails via upsert', async () => {
      claimRepo.upsert.mockResolvedValue(undefined as never);
      const result = await controller.receiveClaim({ email: 'dup@example.com' });
      expect(result).toEqual({ ok: true });
    });
  });
});
