import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../common/decorators/public.decorator';
import { WaitlistClaim } from '../entities/waitlist-claim.entity';
import { PivotClaimDto } from './dto/pivot-claim.dto';

@Controller('api/v1/waitlist')
export class WaitlistController {
  constructor(
    @InjectRepository(WaitlistClaim)
    private readonly claimRepo: Repository<WaitlistClaim>,
  ) {}

  /**
   * Compatibility endpoint for self-hosted versions that predate Autofix GA.
   * Keep returning 200 during the deprecation window, but do not retain new
   * waitlist claims now that every tenant has access.
   */
  @Public()
  @Post('autofix/claim')
  @HttpCode(HttpStatus.OK)
  receiveClaim(): { ok: boolean } {
    return { ok: true };
  }

  /**
   * Pivot waiting-list claim. Public and CORS-open on purpose: cloud posts
   * same-origin and self-hosted dashboards post here straight from the
   * browser, so any locally-registered user can join with a corrected email.
   * The upsert dedupes by email; the global throttler still applies.
   */
  @Public()
  @Post('pivot/claim')
  @HttpCode(HttpStatus.OK)
  async receivePivotClaim(@Body() dto: PivotClaimDto): Promise<{ ok: boolean }> {
    // On an email conflict only claimed_at is refreshed: a row registered
    // under another source keeps its original attribution, so the pivot
    // route never rewrites history it does not own.
    await this.claimRepo
      .createQueryBuilder()
      .insert()
      .into(WaitlistClaim)
      .values({
        email: dto.email.trim().toLowerCase(),
        source: 'pivot',
        claimed_at: new Date().toISOString(),
      })
      .orUpdate(['claimed_at'], ['email'])
      .execute();
    return { ok: true };
  }
}
