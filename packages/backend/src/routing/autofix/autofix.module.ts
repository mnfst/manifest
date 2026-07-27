import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../../entities/agent.entity';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Tenant } from '../../entities/tenant.entity';
import { ManifestRequest } from '../../entities/request.entity';
import { AutofixService } from './autofix.service';
import { AutofixCohortController } from './autofix-cohort.controller';
import { AutofixHealthProbe } from './autofix-health-probe';
import { HEALING_CLIENT, type HealingClient } from './healing-client';
import { HttpHealingClient } from './http-healing-client';
import { MockHealingClient } from './mock-healing-client';
import { NoopHealingClient } from './noop-healing-client';
import { ObservationReporter } from './observation-reporter';
import { DevAutofixSeederService } from './dev-autofix-seeder.service';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Wires Auto-fix. The active healing client is chosen at boot:
 * - `HttpHealingClient` when `AUTOFIX_HEALING_URL` is set (the real Phoenix).
 * - otherwise `NoopHealingClient` in production — inert, so enabling Auto-fix
 *   without a configured healer never lets the dev mock mutate real traffic.
 * - otherwise `MockHealingClient` in dev/test, so the heal → resend → confirm
 *   loop can be exercised locally without an external Phoenix.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Agent, AgentMessage, ManifestRequest, Tenant])],
  controllers: [AutofixCohortController],
  providers: [
    AutofixService,
    AutofixHealthProbe,
    ObservationReporter,
    DevAutofixSeederService,
    {
      provide: HEALING_CLIENT,
      useFactory: (config: ConfigService): HealingClient => {
        const url = config.get<string>('AUTOFIX_HEALING_URL');
        // Digits-only: `Number.parseInt` stops at the first non-digit, so a typo'd
        // `AUTOFIX_TIMEOUT_MS` like `'5abc'` would silently override the timeout with
        // `5`. Require a clean positive integer or fall back to the default.
        const rawTimeout = config.get<string>('AUTOFIX_TIMEOUT_MS')?.trim() ?? '';
        const parsed = /^\d+$/.test(rawTimeout) ? Number.parseInt(rawTimeout, 10) : NaN;
        const timeoutMs = parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
        if (url && url.trim().length > 0) {
          // Phoenix guards /api/heal* and fails closed in production; send the key
          // when configured (omit it for a keyless dev/test Phoenix).
          const apiKey = config.get<string>('AUTOFIX_HEALING_API_KEY')?.trim() || undefined;
          return new HttpHealingClient(url, timeoutMs, apiKey);
        }
        return config.get<string>('NODE_ENV') === 'production'
          ? new NoopHealingClient()
          : new MockHealingClient();
      },
      inject: [ConfigService],
    },
  ],
  exports: [AutofixService, ObservationReporter],
})
export class AutofixModule {}
