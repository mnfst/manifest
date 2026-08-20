/**
 * Scopes for rows in the `api_keys` table.
 *
 * - `owner`: a dashboard/owner API key (the default, as historically all
 *   `api_keys` rows were owner keys). Authorizes the full `/api/v1/*` surface.
 * - `ai_admin`: an AI agent administration key (`mnfst_admin_ai_*`). Authorizes
 *   the scoped `/api/v1/admin` surface only, via AdminAiGuard. It is NOT a
 *   harness ingest key (those live in `agent_api_keys` and are proxy-scoped).
 *
 * Adding a scope column is purely additive: existing owner keys keep `owner`
 * and continue to resolve exactly as before through ApiKeyGuard.
 */
export type ApiKeyScope = 'owner' | 'ai_admin';

export const ADMIN_KEY_SCOPE: ApiKeyScope = 'ai_admin';
export const OWNER_KEY_SCOPE: ApiKeyScope = 'owner';

/** Prefix for minted AI-admin keys; differs from the harness `mnfst_` prefix only
 * by intent — we keep `mnfst_` so existing key-format validation still applies,
 * and scope it via the `scope` column rather than a distinct prefix. */
export const ADMIN_AI_KEY_PREFIX = 'mnfst_admin_ai_' as const;
