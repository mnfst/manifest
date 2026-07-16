# Doctor release checklist

Everything the release deploy needs, in order. The announcement service
and the rollout gate ship in this branch; the rest is environment
configuration on the production (Railway) service.

## Before the deploy

- [ ] Publish the tutorial article (`docs/auto-fix-tutorial-article.md`,
      videos recorded) and note its final URL.
- [ ] Rehearse the email locally (see "Rehearsals" below): one dry run,
      one real send to your own inbox.
- [ ] Confirm the waitlist audience looks right:
      ```sql
      SELECT LOWER(t.email) FROM tenants t
       WHERE t.autofix_waitlist_at IS NOT NULL AND t.email IS NOT NULL
      UNION
      SELECT LOWER(s.email) FROM autofix_waitlist_signups s
       WHERE s.email IS NOT NULL;
      ```

## Environment variables on the release deploy

| Variable | Value | Why |
| --- | --- | --- |
| `AUTOFIX_ROLLOUT` | `waitlist` | Opens Auto-fix to granted tenants **plus** everyone on the waitlist (default is `selected`, hand-picked only). This is what makes the email true. |
| `ANNOUNCE_DOCTOR_RELEASE` | `true` | Arms the one-shot announcement on boot. Remove after the send. |
| `ANNOUNCE_DELAY_MS` | (unset) | Defaults to 10 minutes after boot, which covers the health check and any quick rollback window. |
| `ANNOUNCE_APP_URL` | (unset) | Defaults to `https://app.manifest.build`. |
| `DOCTOR_TUTORIAL_URL` | the published article URL | Adds the "how Auto-fix works" link to the email. Leave unset to omit the link. |
| `EMAIL_PROVIDER` | `mailgun` | The generic send path (`send-email.ts`). |
| `EMAIL_API_KEY` | Mailgun API key | |
| `EMAIL_DOMAIN` | Mailgun sending domain | |
| `EMAIL_FROM` | e.g. `Manifest <hello@…>` | Falls back to `NOTIFICATION_FROM_EMAIL` if unset. |

The migration `1801100000000-AddAnnouncementSends` creates the
`announcement_sends` ledger; it runs with the deploy's normal migration
step. One row per `(announcement, email)` guarantees one email per
address, ever, even across redeploys and restarts.

## Order of operations

1. Merge the branch, deploy with `AUTOFIX_ROLLOUT=waitlist` and the
   variables above. Auto-fix becomes active for the waitlist the moment
   the deploy is healthy.
2. The announcement service arms at boot and waits 10 minutes. If the
   deploy is bad, roll back inside that window and nothing is sent.
3. It resolves the audience, sends one email per address (200 ms
   pacing), and writes the ledger. Watch the logs for
   `Doctor release announcement done: N sent, M skipped`.
4. After the send, remove `ANNOUNCE_DOCTOR_RELEASE` (or set it to
   `false`). The ledger already prevents re-sends, but an unarmed
   service does no work at all on future boots.

## Rehearsals (local, before the real thing)

Dry run (lists the audience, sends nothing, writes nothing):

```bash
ANNOUNCE_DOCTOR_RELEASE=true ANNOUNCE_DRY_RUN=true ANNOUNCE_DELAY_MS=2000 \
  node dist/main.js
```

Real send to yourself (replaces the audience with one address, skips
the ledger, so it is rerunnable):

```bash
EMAIL_PROVIDER=mailgun EMAIL_API_KEY=… EMAIL_DOMAIN=… EMAIL_FROM=… \
ANNOUNCE_DOCTOR_RELEASE=true ANNOUNCE_TEST_RECIPIENT=you@example.com \
ANNOUNCE_DELAY_MS=2000 node dist/main.js
```

## If something goes wrong

- **Send failed for some addresses:** the log warns per address and the
  ledger has no row for them, so re-arming the flag on the next deploy
  retries only the missed ones.
- **Need to resend to one person:** delete their ledger row
  (`DELETE FROM announcement_sends WHERE announcement =
  'doctor-release-2026-07' AND email = '…'`) and re-arm.
- **Sent too early / article not live:** the email works without the
  tutorial link; `DOCTOR_TUTORIAL_URL` only adds a secondary line.
