---
'manifest': minor
---

Tenant-canonical scoping: every resource now belongs to a tenant instead of a user. The `user_providers` table is renamed to `tenant_providers` (junction column `user_provider_id` → `tenant_provider_id`), `api_keys`, `email_provider_configs`, and `custom_providers` are re-keyed by `tenant_id`, and the remaining `user_id` scope columns are dropped from routing/notification/playground tables (kept only as nullable `created_by_user_id` audit columns). Self-host operators querying the database directly should note the table/column renames; migrations run automatically on boot and abort with a clear message if orphaned rows are found (set `MANIFEST_MIGRATION_FORCE=1` to delete them instead).
