import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PROBE_TIMEOUT_MS = 5_000;

/**
 * On boot, if a Phoenix healer is configured (`AUTOFIX_HEALING_URL`), ping its
 * public `GET /api/health` once and log the result. This surfaces a wrong URL, a
 * down Phoenix, or a network gap at deploy time — instead of silently on the
 * first repairable 4xx, where it would look like the healer is "down" and trip
 * the circuit breaker. Fire-and-forget and never throws, so it can never delay
 * or fail app boot.
 */
@Injectable()
export class AutofixHealthProbe implements OnApplicationBootstrap {
  private readonly logger = new Logger(AutofixHealthProbe.name);

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap(): void {
    // Do not await: a slow/unreachable healer must not hold up boot.
    void this.probe();
  }

  async probe(): Promise<void> {
    const url = this.config.get<string>('AUTOFIX_HEALING_URL')?.trim();
    if (!url) return; // No external healer wired — nothing to probe.

    const target = `${url.replace(/\/+$/, '')}/api/health`;
    try {
      // `/api/health` is public in the Phoenix contract (`security: []`), so send
      // no `x-api-key` here — the key belongs only on guarded `/api/heal*` calls,
      // and shipping it to a wrong/misconfigured URL would leak the credential.
      const res = await fetch(target, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(
          `Auto-fix: Phoenix health probe ${target} returned ${res.status} — ` +
            `Auto-fix will not heal until this is resolved.`,
        );
        return;
      }
      this.logger.log(`Auto-fix: Phoenix healer reachable at ${url}.`);
    } catch (err) {
      this.logger.warn(
        `Auto-fix: Phoenix health probe ${target} failed (${(err as Error).message}) — ` +
          `check AUTOFIX_HEALING_URL.`,
      );
    }
  }
}
