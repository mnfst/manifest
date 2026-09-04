import { Controller, Get, Headers, Ip, Logger, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { timingSafeCompare } from '../common/utils/crypto.util';
import { CrmMetricsService } from './crm-metrics.service';
import { CrmMetricsQueryDto } from './dto/crm-metrics-query.dto';
import type { CrmHealedUser, CrmWaitlistClaim } from './crm-metrics.types';

/**
 * Internal read API for the CRM outreach pipeline.
 *
 * `@Public()` to skip the session/api-key guards, then gated by a shared secret
 * in the `x-internal-secret` header. Lives under /api/* so the SPA static
 * fallback never shadows it.
 *
 * This is the first Manifest endpoint that exports user email addresses across
 * tenants, so it is deliberately stricter than the error-pages sibling it is
 * modelled on: the comparison is constant-time, and a secret too short to be
 * worth anything counts as unconfigured rather than as a weak guard on a full
 * user list. Nothing here logs the payload.
 */
@Controller('api/v1/internal/crm-metrics')
export class InternalCrmMetricsController {
  /** Below this, a configured value is treated as absent. */
  private static readonly MIN_SECRET_LENGTH = 32;
  private static readonly DEFAULT_COHORT_DAYS = 7;
  private static readonly DEFAULT_CLAIM_DAYS = 90;

  private readonly logger = new Logger(InternalCrmMetricsController.name);

  constructor(
    private readonly service: CrmMetricsService,
    private readonly config: ConfigService,
  ) {}

  private assertSecret(provided: string | undefined, ip: string): void {
    const expected = this.config.get<string>('app.crmMetricsSecret') ?? '';
    const configured = expected.length >= InternalCrmMetricsController.MIN_SECRET_LENGTH;
    if (!configured || !timingSafeCompare(provided ?? '', expected)) {
      this.logger.warn(`Rejected CRM metrics request from ${ip}`);
      throw new UnauthorizedException('Invalid or missing internal secret');
    }
  }

  /** Users whose failing requests Autofix repaired inside the window. */
  @Public()
  @Get()
  async cohort(
    @Headers('x-internal-secret') secret: string,
    @Ip() ip: string,
    @Query() query: CrmMetricsQueryDto,
  ): Promise<CrmHealedUser[]> {
    this.assertSecret(secret, ip);
    return this.service.getHealedCohort(
      query.days ?? InternalCrmMetricsController.DEFAULT_COHORT_DAYS,
    );
  }

  /** Pivot waiting-list claims — the campaign's conversion signal. */
  @Public()
  @Get('conversions')
  async conversions(
    @Headers('x-internal-secret') secret: string,
    @Ip() ip: string,
    @Query() query: CrmMetricsQueryDto,
  ): Promise<CrmWaitlistClaim[]> {
    this.assertSecret(secret, ip);
    return this.service.getConversions(
      query.days ?? InternalCrmMetricsController.DEFAULT_CLAIM_DAYS,
    );
  }
}
