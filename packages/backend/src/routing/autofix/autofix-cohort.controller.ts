import { Controller, Get } from '@nestjs/common';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { AutofixService } from './autofix.service';

/**
 * Tenant-level Auto-fix beta cohort gate.
 *
 * Returns whether the current tenant is in the Auto-fix early-access allowlist —
 * the same hand-picked cohort (`AutofixService.hasAccess`, driven by
 * `AUTOFIX_ROLLOUT` + `autofix_access_granted_at` / `autofix_waitlist_at`) that
 * gates the Auto-fix feature itself. The dashboard reads this to decide whether
 * to render the redesigned Auto-fix beta UI; every other tenant keeps the
 * existing UI.
 *
 * Reusing `hasAccess` keeps a single source of truth for "who is in the beta"
 * and keeps the allowlist entirely backend-driven — the frontend never names a
 * tenant, user, or email. This endpoint sits under the global guard chain, so an
 * unauthenticated caller is rejected before it runs.
 */
@Controller('api/v1/autofix')
export class AutofixCohortController {
  constructor(private readonly autofix: AutofixService) {}

  @Get('cohort')
  async getCohort(@TenantCtx() ctx: TenantContext): Promise<{ eligible: boolean }> {
    // `hasAccess` already denies a null tenant (no tenant → no agent to heal),
    // so a fresh account with no tenant yet simply reports not eligible.
    return { eligible: await this.autofix.hasAccess(ctx.tenantId) };
  }
}
