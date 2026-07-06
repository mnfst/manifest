import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { TenantCtx, TenantContext } from '../common/decorators/tenant-context.decorator';
import { AutofixService } from '../routing/autofix/autofix.service';

@Controller('api/v1/waitlist')
export class WaitlistController {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly autofixService: AutofixService,
  ) {}

  @Get('autofix')
  async getStatus(
    @TenantCtx() ctx: TenantContext,
  ): Promise<{ joined: boolean; joinedAt: string | null }> {
    if (!ctx.tenantId) return { joined: false, joinedAt: null };
    const tenant = await this.tenantRepo.findOne({
      where: { id: ctx.tenantId },
      select: ['autofix_waitlist_at'],
    });
    return {
      joined: tenant?.autofix_waitlist_at != null,
      joinedAt: tenant?.autofix_waitlist_at ?? null,
    };
  }

  @Post('autofix')
  @HttpCode(HttpStatus.OK)
  async join(@TenantCtx() ctx: TenantContext): Promise<{ joined: boolean; joinedAt: string }> {
    if (!ctx.tenantId) {
      return { joined: false, joinedAt: '' };
    }
    const now = new Date().toISOString();
    await this.tenantRepo.update(ctx.tenantId, { autofix_waitlist_at: now });
    // Joining grants Auto-fix early access — drop the cached decision so the
    // toggle shows up right away instead of after the cache TTL.
    this.autofixService.invalidateAccess(ctx.tenantId);
    return { joined: true, joinedAt: now };
  }
}
