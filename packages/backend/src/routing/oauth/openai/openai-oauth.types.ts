/**
 * Backwards-compat facade. The shared OAuth types now live in `../core`;
 * existing callers (model-discovery, MiniMax helpers, the controller) keep
 * importing from here. New code should import from `../core` directly.
 */
export {
  isOAuthTokenBlob,
  oauthDoneHtml,
  parseOAuthTokenBlob,
  serializeOAuthTokenBlob,
  type OAuthTokenBlob,
} from '../core';

/** OpenAI-specific pending-flow shape, colocated with the OpenAI service. */
export interface PendingOAuth {
  verifier: string;
  agentId: string;
  /** Tenant that owns the agent — the scope the stored credential belongs to. */
  tenantId: string;
  /** Acting user, audit only (tenant_providers.created_by_user_id). */
  createdByUserId: string | null;
  backendUrl: string;
  expiresAt: number;
}
