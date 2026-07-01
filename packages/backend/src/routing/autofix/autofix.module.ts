import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../../entities/agent.entity';
import { AutofixService } from './autofix.service';
import { HEALING_CLIENT, type HealingClient } from './healing-client';
import { HttpHealingClient } from './http-healing-client';
import { MockHealingClient } from './mock-healing-client';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Wires Auto-fix. The active healing client is chosen at boot: an
 * `HttpHealingClient` when `AUTOFIX_HEALING_URL` is set, otherwise the in-process
 * `MockHealingClient` so the loop works without an external Phoenix.
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
        return url && url.trim().length > 0
          ? new HttpHealingClient(url, timeoutMs)
          : new MockHealingClient();
      },
      inject: [ConfigService],
    },
  ],
  exports: [AutofixService],
})
export class AutofixModule {}
