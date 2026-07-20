import { readFileSync } from 'fs';
import { Client } from 'pg';
import { render } from '@react-email/render';
import * as React from 'react';
import { DoctorReleaseEmail } from '../notifications/emails/doctor-release';
import { sendEmail } from '../notifications/services/email-providers/send-email';

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
    else if (arg === '--test') args.testRecipient = argv[++i]?.toLowerCase();
    else if (!arg.startsWith('-') && !args.file) args.file = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
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
  try {
    for (const email of recipients) {
      if (db) {
        const seen = await db.query(
          'SELECT 1 FROM announcement_sends WHERE announcement = $1 AND email = $2 LIMIT 1',
          [DOCTOR_RELEASE_ANNOUNCEMENT_KEY, email],
        );
        if (seen.rows.length > 0) {
          skipped++;
          continue;
        }
      }
      const ok = await sendEmail({ to: email, subject: SUBJECT, html, text });
      if (ok) {
        sent++;
        if (db) {
          await db.query(
            `INSERT INTO announcement_sends (announcement, email, sent_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (announcement, email) DO NOTHING`,
            [DOCTOR_RELEASE_ANNOUNCEMENT_KEY, email],
          );
        }
      } else {
        console.warn(`Send failed for ${email} (no ledger row: a rerun will retry it)`);
      }
      // Gentle pace for the provider's rate limits.
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  } finally {
    await db?.end();
  }
  console.log(`Done: ${sent} sent, ${skipped} skipped (already sent earlier)`);
}

/* istanbul ignore next -- CLI entry, exercised manually */
if (require.main === module) {
  main().catch((error) => {
    console.error(String(error));
    process.exit(1);
  });
}
