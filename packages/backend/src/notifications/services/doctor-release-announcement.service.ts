import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { render } from '@react-email/render';
import * as React from 'react';
import { Tenant } from '../../entities/tenant.entity';
import { DoctorReleaseEmail } from '../emails/doctor-release';
import { sendEmail } from './email-providers/send-email';

export const DOCTOR_RELEASE_ANNOUNCEMENT_KEY = 'doctor-release-2026-07';
const SUBJECT = 'Auto-fix is live on your account';
const DEFAULT_DELAY_MS = 10 * 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_483_647;

export function announcementDelayMs(raw: string | undefined): number {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return DEFAULT_DELAY_MS;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed <= MAX_TIMEOUT_MS ? parsed : DEFAULT_DELAY_MS;
}

/**
 * One-shot release announcement to the Auto-fix waitlist.
 *
 * Armed by `ANNOUNCE_DOCTOR_RELEASE=true` on the release deploy, it waits
 * `ANNOUNCE_DELAY_MS` (default 10 minutes) after boot, resolves the audience
 * (cloud waitlisted tenants + self-hosted signups), and sends the branded
 * announcement through the configured email provider.
 *
 * Guarantees:
 * - At most one email per address: an `announcement_sends` row is claimed
 *   atomically before sending, so concurrent replicas cannot both send it.
 * - `ANNOUNCE_DRY_RUN=true` logs the audience and subject, sends nothing,
 *   writes nothing.
 * - `ANNOUNCE_TEST_RECIPIENT=someone@x` replaces the audience with that one
 *   address and skips the ledger: rerunnable rehearsals.
 */
@Injectable()
export class DoctorReleaseAnnouncementService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DoctorReleaseAnnouncementService.name);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env['ANNOUNCE_DOCTOR_RELEASE'] !== 'true') return;
    const delayMs = announcementDelayMs(process.env['ANNOUNCE_DELAY_MS']);
    this.logger.log(`Doctor release announcement armed: sending in ${Math.round(delayMs / 1000)}s`);
    this.timer = setTimeout(() => {
      void this.run().catch((error) =>
        this.logger.error(`Doctor release announcement failed: ${String(error)}`),
      );
    }, delayMs);
    if (typeof this.timer === 'object' && 'unref' in this.timer) this.timer.unref();
  }

  /** Resolve the audience: cloud waitlisted tenants + self-hosted signups. */
  async resolveRecipients(): Promise<string[]> {
    const testRecipient = process.env['ANNOUNCE_TEST_RECIPIENT'];
    if (testRecipient) return [testRecipient.toLowerCase()];

    const rows = (await this.tenantRepo.query(
      `SELECT LOWER(t.email) AS email
         FROM tenants t
        WHERE t.autofix_waitlist_at IS NOT NULL AND t.email IS NOT NULL
       UNION
       SELECT LOWER(s.email) AS email
         FROM waitlist_claims s
        WHERE s.email IS NOT NULL`,
    )) as Array<{ email: string }>;
    return [...new Set(rows.map((r) => r.email).filter(Boolean))];
  }

  async run(): Promise<{ sent: number; skipped: number; dryRun: boolean }> {
    const dryRun = process.env['ANNOUNCE_DRY_RUN'] === 'true';
    const testMode = Boolean(process.env['ANNOUNCE_TEST_RECIPIENT']);
    const appUrl = process.env['ANNOUNCE_APP_URL'] ?? 'https://app.manifest.build';
    const tutorialUrl = process.env['DOCTOR_TUTORIAL_URL'] || undefined;

    const recipients = await this.resolveRecipients();
    this.logger.log(
      `Doctor release announcement: ${recipients.length} recipient(s)` +
        (dryRun ? ' [DRY RUN]' : '') +
        (testMode ? ' [TEST RECIPIENT]' : ''),
    );

    if (dryRun) {
      for (const email of recipients) this.logger.log(`[DRY RUN] would send to ${email}`);
      this.logger.log(`[DRY RUN] subject: ${SUBJECT}`);
      return { sent: 0, skipped: recipients.length, dryRun: true };
    }

    const element = React.createElement(DoctorReleaseEmail, { appUrl, tutorialUrl });
    const html = await render(element);
    const text = await render(element, { plainText: true });

    let sent = 0;
    let skipped = 0;
    for (const email of recipients) {
      if (!testMode && !(await this.claim(email))) {
        skipped++;
        continue;
      }
      const ok = await sendEmail({ to: email, subject: SUBJECT, html, text });
      if (ok) {
        sent++;
        if (!testMode) await this.markSent(email);
      } else {
        if (!testMode) await this.releaseClaim(email);
        this.logger.warn(`Doctor release announcement: send failed for ${email}`);
      }
      // Gentle pace for the provider's rate limits.
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    this.logger.log(`Doctor release announcement done: ${sent} sent, ${skipped} skipped`);
    return { sent, skipped, dryRun: false };
  }

  private async claim(email: string): Promise<boolean> {
    const rows = (await this.tenantRepo.query(
      `INSERT INTO announcement_sends (announcement, email)
       VALUES ($1, $2)
       ON CONFLICT (announcement, email) DO NOTHING
       RETURNING 1`,
      [DOCTOR_RELEASE_ANNOUNCEMENT_KEY, email],
    )) as unknown[];
    return rows.length > 0;
  }

  private async markSent(email: string): Promise<void> {
    await this.tenantRepo.query(
      `UPDATE announcement_sends SET sent_at = NOW()
       WHERE announcement = $1 AND email = $2`,
      [DOCTOR_RELEASE_ANNOUNCEMENT_KEY, email],
    );
  }

  private async releaseClaim(email: string): Promise<void> {
    await this.tenantRepo.query(
      `DELETE FROM announcement_sends
       WHERE announcement = $1 AND email = $2 AND sent_at IS NULL`,
      [DOCTOR_RELEASE_ANNOUNCEMENT_KEY, email],
    );
  }
}
