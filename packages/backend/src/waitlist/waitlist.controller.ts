import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { AutofixWaitlistSignup } from '../entities/autofix-waitlist-signup.entity';
import { TenantCtx, TenantContext } from '../common/decorators/tenant-context.decorator';
import { Public } from '../common/decorators/public.decorator';
import { WaitlistPhoneHomeService } from './waitlist-phone-home.service';
import { WaitlistSignupDto } from './dto/waitlist-signup.dto';

@Controller('api/v1/waitlist')
export class WaitlistController {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(AutofixWaitlistSignup)
    private readonly signupRepo: Repository<AutofixWaitlistSignup>,
    private readonly phoneHome: WaitlistPhoneHomeService,
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

    const tenant = await this.tenantRepo.findOne({
      where: { id: ctx.tenantId },
      select: ['email'],
    });
    this.phoneHome.reportSignup(tenant?.email ?? '').catch(() => {});

    return { joined: true, joinedAt: now };
  }

  @Public()
  @Post('autofix/claim')
  @HttpCode(HttpStatus.OK)
  async receiveClaim(@Body() dto: WaitlistSignupDto): Promise<{ ok: boolean }> {
    await this.signupRepo.upsert(
      { email: dto.email, source: 'self-hosted', signed_up_at: new Date().toISOString() },
      { conflictPaths: ['email'] },
    );
    return { ok: true };
  }
}
