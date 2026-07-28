import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isSelfHosted } from '../../common/utils/detect-self-hosted';
import { resolveHttpHealingUrl } from './autofix-healing-config';

const PROBE_TIMEOUT_MS = 5_000;

/**
 * On boot, ping the resolved Phoenix healer's public `GET /api/health` once.
 * This includes the hosted self-hosted default, but excludes `off`, cloud
 * production without a URL, and the in-process dev mock. The probe never
 * registers or sends credentials, and never delays or fails app boot.
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
    const url = resolveHttpHealingUrl(
      this.config.get<string>('AUTOFIX_HEALING_URL'),
      this.config.get<string>('NODE_ENV'),
      isSelfHosted(),
    );
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
