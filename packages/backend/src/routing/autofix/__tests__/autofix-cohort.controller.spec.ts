import { AutofixCohortController } from '../autofix-cohort.controller';
import { AutofixService } from '../autofix.service';
import type { TenantContext } from '../../../common/decorators/tenant-context.decorator';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { Tenant } from '../../../entities/tenant.entity';
import type { DevAutofixSeederService } from '../dev-autofix-seeder.service';

describe('AutofixCohortController', () => {
  const ctx: TenantContext = { tenantId: 'tenant-1', userId: 'user-1' };
  let autofix: { hasAccess: jest.Mock; invalidateAccess: jest.Mock };
  let config: { get: jest.Mock };
  let tenantRepo: { update: jest.Mock };
  let devSeeder: { ensureSeeded: jest.Mock };
  let controller: AutofixCohortController;

  beforeEach(() => {
    autofix = { hasAccess: jest.fn(), invalidateAccess: jest.fn() };
    config = { get: jest.fn().mockReturnValue('development') };
    tenantRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    devSeeder = { ensureSeeded: jest.fn().mockResolvedValue(19) };
    controller = new AutofixCohortController(
      autofix as unknown as AutofixService,
      config as unknown as ConfigService,
      tenantRepo as unknown as Repository<Tenant>,
      devSeeder as unknown as DevAutofixSeederService,
    );
  });

  it('reports eligible for a tenant in the early-access cohort', async () => {
    autofix.hasAccess.mockResolvedValue(true);
    expect(await controller.getCohort(ctx)).toEqual({ eligible: true });
    // Eligibility is decided by the shared allowlist check, keyed by tenant only.
    expect(autofix.hasAccess).toHaveBeenCalledWith('tenant-1');
  });

  it('reports not eligible for a default tenant outside the cohort', async () => {
    autofix.hasAccess.mockResolvedValue(false);
    expect(await controller.getCohort(ctx)).toEqual({ eligible: false });
  });

  it('passes a null tenant through to the allowlist check (which denies)', async () => {
    autofix.hasAccess.mockResolvedValue(false);
    expect(await controller.getCohort({ tenantId: null, userId: null })).toEqual({
      eligible: false,
    });
    expect(autofix.hasAccess).toHaveBeenCalledWith(null);
  });

  it('grants and revokes cohort access in development', async () => {
    autofix.hasAccess.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(controller.setDevCohort(ctx, { enabled: true })).resolves.toEqual({
      eligible: true,
    });
    expect(tenantRepo.update).toHaveBeenNthCalledWith(1, 'tenant-1', {
      autofix_access_granted_at: expect.any(String),
    });
    expect(autofix.invalidateAccess).toHaveBeenNthCalledWith(1, 'tenant-1');
    expect(devSeeder.ensureSeeded).toHaveBeenCalledWith('tenant-1');

    await expect(controller.setDevCohort(ctx, { enabled: false })).resolves.toEqual({
      eligible: false,
    });
    expect(tenantRepo.update).toHaveBeenNthCalledWith(2, 'tenant-1', {
      autofix_access_granted_at: null,
    });
    expect(autofix.invalidateAccess).toHaveBeenNthCalledWith(2, 'tenant-1');
    expect(devSeeder.ensureSeeded).toHaveBeenCalledTimes(1);
  });

  it('does not expose the cohort mutation outside development', async () => {
    config.get.mockReturnValue('production');

    await expect(controller.setDevCohort(ctx, { enabled: true })).rejects.toMatchObject({
      status: 404,
    });
    expect(tenantRepo.update).not.toHaveBeenCalled();
    expect(devSeeder.ensureSeeded).not.toHaveBeenCalled();
  });

  it('rejects a development toggle when the session has no tenant', async () => {
    await expect(
      controller.setDevCohort({ tenantId: null, userId: 'user-1' }, { enabled: true }),
    ).rejects.toMatchObject({ status: 400 });
    expect(tenantRepo.update).not.toHaveBeenCalled();
  });
});
