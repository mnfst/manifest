import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { render } from '@react-email/render';
import * as React from 'react';
import { DoctorReleaseEmail } from '../notifications/emails/doctor-release';
import { isEmailConfigured, sendEmail } from '../notifications/services/email-providers/send-email';

export const DOCTOR_RELEASE_ANNOUNCEMENT_KEY = 'doctor-release-2026-07';
const SUBJECT = 'Auto-fix is live on your account';

/**
 * Manual sender for the Auto-fix release announcement.
 *
 * Nothing automatic anywhere: this runs only when an operator runs it, and
 * the audience comes from a JSON mailing-list file, never from the database.
 *
 *   npm run announce:doctor -- mailing-list-subscribers.json
 *   npm run announce:doctor -- mailing-list-subscribers.json --dry-run
 *   npm run announce:doctor -- --test you@example.com
 *
 * The JSON file is `["a@x.com", ...]` or `[{"email": "a@x.com"}, ...]`.
 * The `announcement_sends` ledger still guarantees one email per address,
 * ever (reruns skip already-sent addresses); `--test` replaces the audience
 * with one address and skips the ledger, so rehearsals are repeatable.
 * Provider config comes from the usual EMAIL_* environment variables, the
 * ledger from DATABASE_URL.
 */

/** Accepts ["a@x.com", ...] or [{"email": "a@x.com"}, ...]; lowercases and dedupes. */
export function parseMailingList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new Error('The mailing list must be a JSON array of emails or {"email": ...} objects');
  }
  const emails = raw.map((entry) => {
    const value =
      typeof entry === 'string'
        ? entry
        : entry &&
            typeof entry === 'object' &&
            typeof (entry as { email?: unknown }).email === 'string'
          ? (entry as { email: string }).email
          : null;
    if (!value || !value.includes('@')) {
      throw new Error(`Not an email address: ${JSON.stringify(entry)}`);
    }
    return value.trim().toLowerCase();
  });
  return [...new Set(emails)];
}

interface CliArgs {
  file?: string;
  dryRun: boolean;
  testRecipient?: string;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--test') {
      const recipient = argv[i + 1];
      if (!recipient || recipient.startsWith('-')) {
        throw new Error('--test requires an email address');
      }
      args.testRecipient = parseMailingList([recipient])[0];
      i++;
    } else if (!arg.startsWith('-') && !args.file) args.file = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

const ABANDONED_CLAIM_INTERVAL = '1 hour';

/** Atomically claim one address. A fresh claim held by another run is skipped. */
export async function claimRecipient(db: Client, email: string): Promise<string | null> {
  const claimId = randomUUID();
  const result = await db.query<{ claim_id: string }>(
    `INSERT INTO announcement_sends
       (announcement, email, claim_id, claimed_at, sent_at)
     VALUES ($1, $2, $3, NOW(), NULL)
     ON CONFLICT (announcement, email) DO UPDATE
       SET claim_id = EXCLUDED.claim_id, claimed_at = NOW()
       WHERE announcement_sends.sent_at IS NULL
         AND announcement_sends.claimed_at < NOW() - $4::interval
     RETURNING claim_id`,
    [DOCTOR_RELEASE_ANNOUNCEMENT_KEY, email, claimId, ABANDONED_CLAIM_INTERVAL],
  );
  return result.rows[0]?.claim_id === claimId ? claimId : null;
}

async function releaseClaim(db: Client, email: string, claimId: string): Promise<void> {
  await db.query(
    `DELETE FROM announcement_sends
     WHERE announcement = $1 AND email = $2 AND claim_id = $3 AND sent_at IS NULL`,
    [DOCTOR_RELEASE_ANNOUNCEMENT_KEY, email, claimId],
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file && !args.testRecipient) {
    console.error(
      'Usage: npm run announce:doctor -- <mailing-list.json> [--dry-run] | --test you@example.com',
    );
    process.exit(1);
  }

  const recipients = args.testRecipient
    ? [args.testRecipient]
    : parseMailingList(JSON.parse(readFileSync(args.file!, 'utf8')));
  console.log(
    `Doctor release announcement: ${recipients.length} recipient(s)` +
      (args.dryRun ? ' [DRY RUN]' : '') +
      (args.testRecipient ? ' [TEST RECIPIENT]' : ''),
  );

  if (args.dryRun) {
    for (const email of recipients) console.log(`[DRY RUN] would send to ${email}`);
    console.log(`[DRY RUN] subject: ${SUBJECT}`);
    return;
  }

  if (!isEmailConfigured()) {
    throw new Error(
      'A valid email provider configuration is required (EMAIL_PROVIDER and EMAIL_API_KEY)',
    );
  }

  const appUrl = process.env['ANNOUNCE_APP_URL'] ?? 'https://app.manifest.build';
  const tutorialUrl = process.env['DOCTOR_TUTORIAL_URL'] || undefined;
  const element = React.createElement(DoctorReleaseEmail, { appUrl, tutorialUrl });
  const html = await render(element);
  const text = await render(element, { plainText: true });

  // The one-email-per-address ledger; skipped entirely in test mode.
  let db: Client | null = null;
  if (!args.testRecipient) {
    if (!process.env['DATABASE_URL']) {
      console.error('DATABASE_URL is required for the announcement_sends ledger');
      process.exit(1);
    }
    db = new Client({ connectionString: process.env['DATABASE_URL'] });
    await db.connect();
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  try {
    for (const email of recipients) {
      let claimId: string | null = null;
      if (db) {
        claimId = await claimRecipient(db, email);
        if (!claimId) {
          skipped++;
          continue;
        }
      }
      let ok: boolean;
      try {
        ok = await sendEmail({ to: email, subject: SUBJECT, html, text });
      } catch (error) {
        if (db && claimId) await releaseClaim(db, email, claimId);
        throw error;
      }
      if (ok) {
        sent++;
        if (db && claimId) {
          await db.query(
            `UPDATE announcement_sends SET sent_at = NOW()
             WHERE announcement = $1 AND email = $2 AND claim_id = $3`,
            [DOCTOR_RELEASE_ANNOUNCEMENT_KEY, email, claimId],
          );
        }
      } else {
        failed++;
        if (db && claimId) await releaseClaim(db, email, claimId);
        console.warn(`Send failed for ${email} (no ledger row: a rerun will retry it)`);
      }
      // Gentle pace for the provider's rate limits.
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  } finally {
    await db?.end();
  }
  console.log(`Done: ${sent} sent, ${skipped} skipped (already sent or claimed), ${failed} failed`);
  if (failed > 0) {
    throw new Error(`${failed} announcement email(s) failed; rerun to retry them`);
  }
}

/* istanbul ignore next -- CLI entry, exercised manually */
if (require.main === module) {
  main().catch((error) => {
    console.error(String(error));
    process.exit(1);
  });
}
