---
'manifest': patch
---

Low-risk cleanups from the 2026-04-23 OWASP audit that cause no behaviour change for operators or users:

- Scope agent rename cascades by `tenant_id` on `agent_messages` / `notification_rules` / `notification_logs`. Forward-only fix — no backfill — so any pre-existing row that was mislabelled when slugs collided across tenants stays as-is; new renames no longer touch other tenants' data.
- Replace `ApiKeyGuard.safeCompare` with `Buffer.from` + length-check + `timingSafeEqual`. Same observable behaviour; cleaner canonical pattern.
- Add a snapshot test for `ThresholdAlertEmail` against hostile agent names (angle brackets, attribute-context quote payloads) — verifies React's existing escaping, no runtime change.
- `npm audit fix` for the moderate `@nestjs/core` advisory (11.1.17 → 11.1.19).

All other findings from the audit are deferred — they required breaking changes or operator action and live in a separate tracking issue.
