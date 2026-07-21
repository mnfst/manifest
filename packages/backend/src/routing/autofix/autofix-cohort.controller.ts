import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsBoolean } from 'class-validator';
import { Repository } from 'typeorm';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { Tenant } from '../../entities/tenant.entity';
import { AutofixService } from './autofix.service';
import { DevAutofixSeederService } from './dev-autofix-seeder.service';

class SetDevAutofixCohortDto {
  @IsBoolean()
  enabled!: boolean;
}

/**
 * Tenant-level Auto-fix beta cohort gate.
 *
 * Returns whether the current tenant is in the Auto-fix access cohort — resolved
 * by `AutofixService.hasAccess` (driven by `AUTOFIX_ROLLOUT` +
 * `autofix_access_granted_at` / `autofix_waitlist_at`), the same gate as the
 * Auto-fix feature itself. This endpoint provides eligibility infrastructure
 * for Auto-fix-specific dashboard pieces.
 *
 * Reusing `hasAccess` keeps a single source of truth for "who is in the beta"
 * and keeps the allowlist entirely backend-driven — the frontend never names a
 * tenant, user, or email. This endpoint sits under the global guard chain, so an
 * unauthenticated caller is rejected before it runs.
 */
@Controller('api/v1/autofix')
export class AutofixCohortController {
  constructor(
    private readonly autofix: AutofixService,
    private readonly config: ConfigService,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly devSeeder: DevAutofixSeederService,
  ) {}

  @Get('cohort')
  async getCohort(@TenantCtx() ctx: TenantContext): Promise<{ eligible: boolean }> {
    // `hasAccess` already denies a null tenant (no tenant → no agent to heal),
    // so a fresh account with no tenant yet simply reports not eligible.
    return { eligible: await this.autofix.hasAccess(ctx.tenantId) };
  }

  /** Development-only switch for exercising both cohort-gated dashboard states. */
  @Patch('cohort')
  async setDevCohort(
    @TenantCtx() ctx: TenantContext,
    @Body() body: SetDevAutofixCohortDto,
  ): Promise<{ eligible: boolean }> {
    if (this.config.get<string>('NODE_ENV') !== 'development') {
      throw new NotFoundException();
    }
    if (!ctx.tenantId) {
      throw new BadRequestException('No tenant is available for this session');
    }

    await this.tenantRepo.update(ctx.tenantId, {
      autofix_access_granted_at: body.enabled ? new Date().toISOString() : null,
    });
    if (body.enabled) {
      await this.devSeeder.ensureSeeded(ctx.tenantId);
    }
    this.autofix.invalidateAccess(ctx.tenantId);

    return { eligible: await this.autofix.hasAccess(ctx.tenantId) };
  }
}
