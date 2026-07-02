import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../../entities/agent.entity';
import { AutofixService } from './autofix.service';
import { HEALING_CLIENT, type HealingClient } from './healing-client';
import { HttpHealingClient } from './http-healing-client';
import { MockHealingClient } from './mock-healing-client';
import { NoopHealingClient } from './noop-healing-client';

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
  imports: [TypeOrmModule.forFeature([Agent])],
  providers: [
    AutofixService,
    {
      provide: HEALING_CLIENT,
      useFactory: (config: ConfigService): HealingClient => {
        const url = config.get<string>('AUTOFIX_HEALING_URL');
        const parsed = Number.parseInt(config.get<string>('AUTOFIX_TIMEOUT_MS') ?? '', 10);
        const timeoutMs = Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
        if (url && url.trim().length > 0) {
          return new HttpHealingClient(url, timeoutMs);
        }
        return config.get<string>('NODE_ENV') === 'production'
          ? new NoopHealingClient()
          : new MockHealingClient();
      },
      inject: [ConfigService],
    },
  ],
  exports: [AutofixService],
})
export class AutofixModule {}
