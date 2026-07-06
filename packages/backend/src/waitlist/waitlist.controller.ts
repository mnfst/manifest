import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { Tenant } from '../entities/tenant.entity';
import { WaitlistClaim } from '../entities/waitlist-claim.entity';
import { TenantCtx, TenantContext } from '../common/decorators/tenant-context.decorator';
import { Public } from '../common/decorators/public.decorator';
import { WaitlistSyncService } from './waitlist-sync.service';
import { WaitlistClaimDto } from './dto/waitlist-claim.dto';
import { AutofixService } from '../routing/autofix/autofix.service';

@Controller('api/v1/waitlist')
export class WaitlistController {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(WaitlistClaim)
    private readonly claimRepo: Repository<WaitlistClaim>,
    private readonly waitlistSync: WaitlistSyncService,
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
  async join(
    @TenantCtx() ctx: TenantContext,
    @Req() req: Request & { user?: { email?: string } },
  ): Promise<{ joined: boolean; joinedAt: string }> {
    if (!ctx.tenantId) {
      return { joined: false, joinedAt: '' };
    }
    const now = new Date().toISOString();
    await this.tenantRepo.update(ctx.tenantId, { autofix_waitlist_at: now });
    // Joining grants Auto-fix early access — drop the cached decision so the
    // toggle shows up right away instead of after the cache TTL.
    this.autofixService.invalidateAccess(ctx.tenantId);

    const email = req.user?.email ?? '';
    this.waitlistSync.syncClaim(email).catch(() => {});

    return { joined: true, joinedAt: now };
  }

  @Public()
  @Post('autofix/claim')
  @HttpCode(HttpStatus.OK)
  async receiveClaim(@Body() dto: WaitlistClaimDto): Promise<{ ok: boolean }> {
    await this.claimRepo.upsert(
      { email: dto.email, source: 'self-hosted', claimed_at: new Date().toISOString() },
      { conflictPaths: ['email'] },
    );
    return { ok: true };
  }
}
