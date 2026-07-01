import { WaitlistController } from './waitlist.controller';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';

describe('WaitlistController', () => {
  let controller: WaitlistController;
  let tenantRepo: jest.Mocked<Pick<Repository<Tenant>, 'findOne' | 'update'>>;

  beforeEach(() => {
    tenantRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    controller = new WaitlistController(tenantRepo as unknown as Repository<Tenant>);
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
    it('sets autofix_waitlist_at and returns joined status', async () => {
      const result = await controller.join({ tenantId: 't1', userId: 'u1' });
      expect(tenantRepo.update).toHaveBeenCalledWith('t1', {
        autofix_waitlist_at: expect.any(String),
      });
      expect(result.joined).toBe(true);
      expect(result.joinedAt).toBeTruthy();
    });

    it('returns not joined when tenantId is null', async () => {
      const result = await controller.join({ tenantId: null, userId: 'u1' });
      expect(tenantRepo.update).not.toHaveBeenCalled();
      expect(result.joined).toBe(false);
    });
  });
});
