import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../../entities/agent.entity';
import { AgentMessage } from '../../entities/agent-message.entity';
import { ManifestRequest } from '../../entities/request.entity';
import { isSelfHosted } from '../../common/utils/detect-self-hosted';
import { readManifestVersion } from '../../telemetry/telemetry.config';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { AutofixService } from './autofix.service';
import { AutofixHealthProbe } from './autofix-health-probe';
import { resolveHealingUrl } from './autofix-healing-config';
import { HEALING_CLIENT, type HealingClient } from './healing-client';
import { HttpHealingClient } from './http-healing-client';
import { InstallIdService } from '../../telemetry/install-id.service';
import { MockHealingClient } from './mock-healing-client';
import { NoopHealingClient } from './noop-healing-client';
import { ObservationReporter } from './observation-reporter';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Wires Auto-fix. The active healing client is chosen at boot:
 * - explicit `off` always selects the inert client;
 * - an explicit URL selects HTTP in every mode;
 * - self-hosted production defaults to hosted Phoenix;
 * - cloud production remains inert when unset;
 * - dev/test remains on the deterministic in-process mock when unset.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Agent, AgentMessage, ManifestRequest]), TelemetryModule],
  providers: [
    AutofixService,
    AutofixHealthProbe,
    ObservationReporter,
    {
      provide: HEALING_CLIENT,
      useFactory: (config: ConfigService, installIds: InstallIdService): HealingClient => {
        const rawUrl = config.get<string>('AUTOFIX_HEALING_URL');
        const nodeEnv = config.get<string>('NODE_ENV');
        const selfHosted = isSelfHosted();
        const { url, invalid } = resolveHealingUrl(rawUrl, nodeEnv, selfHosted);
        if (invalid) {
          // Loud once at boot: an unusable URL silently disables Auto-fix, and
          // "Auto-fix never runs" is otherwise indistinguishable from it being
          // switched off on purpose.
          new Logger('AutofixModule').error(
            `AUTOFIX_HEALING_URL is not an absolute http(s) URL; Auto-fix is inert. Got: ${rawUrl}`,
          );
        }
        // Digits-only: `Number.parseInt` stops at the first non-digit, so a typo'd
        // `AUTOFIX_TIMEOUT_MS` like `'5abc'` would silently override the timeout with
        // `5`. Require a clean positive integer or fall back to the default.
        const rawTimeout = config.get<string>('AUTOFIX_TIMEOUT_MS')?.trim() ?? '';
        const parsed = /^\d+$/.test(rawTimeout) ? Number.parseInt(rawTimeout, 10) : NaN;
        const timeoutMs = parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
        if (rawUrl?.trim().toLowerCase() === 'off') {
          return new NoopHealingClient();
        }
        if (url) {
          // Phoenix guards /api/heal* and fails closed in production; send the key
          // when configured (omit it for a keyless dev/test Phoenix).
          const apiKey = config.get<string>('AUTOFIX_HEALING_API_KEY')?.trim() || undefined;
          // Self-hosted with no static key announces the install's anonymous id,
          // minted lazily (an install that never enables Auto-fix or reports
          // telemetry never creates one) and memoized for the process lifetime —
          // InstallIdService reads the row on every call, so without this each
          // heal request would do its own lookup. Only successful resolutions
          // are cached: a transient DB failure must not disable Auto-fix for
          // the rest of the process.
          const instanceId =
            !apiKey && selfHosted
              ? (() => {
                  let cached: Promise<string> | null = null;
                  return async (): Promise<string> => {
                    if (cached) return cached;
                    cached = installIds.getOrCreate().then((i) => i.install_id);
                    try {
                      return await cached;
                    } catch (err) {
                      cached = null;
                      throw err;
                    }
                  };
                })()
              : undefined;
          return new HttpHealingClient(url, timeoutMs, apiKey, instanceId, readManifestVersion());
        }
        return nodeEnv === 'production' ? new NoopHealingClient() : new MockHealingClient();
      },
      inject: [ConfigService, InstallIdService],
    },
  ],
  exports: [AutofixService, ObservationReporter],
})
export class AutofixModule {}
