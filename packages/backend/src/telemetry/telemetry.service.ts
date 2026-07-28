import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstallIdService } from './install-id.service';
import { PayloadBuilderService } from './payload-builder.service';
import { buildTelemetryConfig, TELEMETRY_DOCS_URL, type TelemetryConfig } from './telemetry.config';

// One hour under a full day on purpose. The cron ticks at the top of each hour
// and `markSent` stamps `last_sent_at` a moment *after* the tick, so a >= 24h
// guard could never pass at the same-hour tick the next day — every send
// slipped one hour later per day. When that hour crossed UTC midnight, the
// install's report skipped a calendar day and received-at-binned daily stats
// dropped its whole volume for that day. A 23h guard keeps the real cadence at
// ~24h (the next qualifying tick is the same hour the next day) while pinning
// the send to a stable hour. The ingest's duplicate-report window is also 23h,
// so a send can never arrive inside it.
const SEND_INTERVAL_MS = 23 * 60 * 60 * 1000;

/**
 * Drives the once-per-24h telemetry send for self-hosted installs.
 *
 * Opt-out: `MANIFEST_TELEMETRY_DISABLED=1` silences all outbound traffic.
 * Dev safety: when `NODE_ENV !== 'production'` the sender is also silent, so
 * local development and tests never report.
 *
 * The cron ticks hourly (not daily) so restarts don't skip windows — each
 * tick checks `last_sent_at + jitter` and fires once `SEND_INTERVAL_MS` has
 * elapsed, which lands on the same hour every ~24h.
 */
@Injectable()
export class TelemetryService implements OnModuleInit {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly config: TelemetryConfig = buildTelemetryConfig();

  constructor(
    private readonly installIds: InstallIdService,
    private readonly payloadBuilder: PayloadBuilderService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.log('Anonymous usage telemetry is disabled for this process.');
      return;
    }
    const install = await this.installIds.getOrCreate();
    this.logger.log(
      `Anonymous usage telemetry is enabled. Install ID: ${install.install_id}. ` +
        `To disable: set MANIFEST_TELEMETRY_DISABLED=1. What we send: ${TELEMETRY_DOCS_URL}`,
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async tick(now: Date = new Date()): Promise<void> {
    if (!this.config.enabled) return;

    const install = await this.installIds.getOrCreate();
    if (!this.shouldSend(install.first_send_at, install.last_sent_at, now)) return;

    const payload = await this.payloadBuilder.build(
      install.install_id,
      this.config.manifestVersion,
    );
    const ok = await this.postPayload(payload);
    if (ok) await this.installIds.markSent(now);
  }

  private shouldSend(firstSendAt: string | null, lastSentAt: string | null, now: Date): boolean {
    if (firstSendAt && new Date(firstSendAt).getTime() > now.getTime()) return false;
    if (!lastSentAt) return true;
    return now.getTime() - new Date(lastSentAt).getTime() >= SEND_INTERVAL_MS;
  }

  private async postPayload(payload: unknown): Promise<boolean> {
    try {
      const res = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.logger.warn(`Telemetry endpoint returned ${res.status}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`Telemetry send failed: ${err}`);
      return false;
    }
  }
}
