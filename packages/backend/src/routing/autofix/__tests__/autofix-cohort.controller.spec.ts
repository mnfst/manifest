import { AutofixCohortController } from '../autofix-cohort.controller';
import { AutofixService } from '../autofix.service';
import type { TenantContext } from '../../../common/decorators/tenant-context.decorator';

describe('AutofixCohortController', () => {
  const ctx: TenantContext = { tenantId: 'tenant-1', userId: 'user-1' };
  let autofix: { hasAccess: jest.Mock };
  let controller: AutofixCohortController;

  beforeEach(() => {
    autofix = { hasAccess: jest.fn() };
    controller = new AutofixCohortController(autofix as unknown as AutofixService);
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
});
