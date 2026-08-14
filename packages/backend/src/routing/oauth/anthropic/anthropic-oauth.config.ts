/**
 * OAuth constants for the Claude Pro / Max subscription flow.
 *
 * These mirror what the `claude setup-token` CLI uses internally — Anthropic
 * publishes the same client_id and endpoints for any third-party tool that
 * wants to authenticate end-users with their existing Claude subscription.
 *
 * The flow is PKCE with a manual paste-code step: Anthropic's redirect URI
 * is a console page that displays the authorization code (formatted as
 * `<code>#<state>`) for the user to copy back into Manifest. Token exchange
 * uses the Claude Code API host, matching Claude Code-compatible routers.
 */
export const ANTHROPIC_OAUTH = {
  CLIENT_ID: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
  AUTHORIZE_URL: 'https://claude.ai/oauth/authorize',
  TOKEN_URL: 'https://api.anthropic.com/v1/oauth/token',
  REDIRECT_URI: 'https://console.anthropic.com/oauth/code/callback',
  SCOPE: 'org:create_api_key user:profile user:inference',
  /** Pending authorize state lives this long before the user must restart. */
  STATE_TTL_MS: 10 * 60 * 1000,
} as const;
