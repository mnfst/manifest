/**
 * Backwards-compat facade. The shared OAuth types now live in `./core`;
 * existing callers (model-discovery, MiniMax helpers, the controller) keep
 * importing from here. New code should import from `./core` directly.
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
  userId: string;
  backendUrl: string;
  expiresAt: number;
}
