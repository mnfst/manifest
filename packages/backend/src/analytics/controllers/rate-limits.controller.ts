import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthUser } from '../../auth/auth.instance';
import { RateLimitTrackerService } from '../../routing/proxy/rate-limit-tracker.service';

@Controller('api/v1/rate-limits')
export class RateLimitsController {
  constructor(private readonly rateLimitTracker: RateLimitTrackerService) {}

  @Get()
  async getRateLimits(@CurrentUser() user: AuthUser) {
    const snapshots = await this.rateLimitTracker.getRateLimits(user.id);
    return {
      providers: snapshots.map((s) => ({
        provider: s.provider,
        auth_type: s.authType,
        key_label: s.keyLabel ?? null,
        limits: s.limits.map((l) => ({
          limit_type: l.limitType,
          period: l.period,
          limit_value: l.limitValue,
          used_value: l.usedValue,
          remaining_value: l.remainingValue,
          resets_at: l.resetsAt,
          utilization_pct:
            l.limitValue != null && l.limitValue > 0 && l.usedValue != null
              ? Math.round(((l.usedValue / l.limitValue) * 100 + Number.EPSILON) * 10) / 10
              : null,
        })),
      })),
    };
  }
}
