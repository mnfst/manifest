/**
 * Per-platform setup snippets — the single source of truth for "how do I
 * point this platform at Manifest". Consumed by the dashboard setup panels
 * directly and by the CLI via build-time template generation (functions are
 * invoked with {{ORIGIN}} placeholders and emitted as data).
 */

/** Anthropic SDK auto-appends /v1/messages to baseURL — strip a trailing /v1. */
function stripV1Suffix(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, '');
}

export function getOpenClawSnippet(baseUrl: string, apiKey: string): string {
  // Manifest's cloud proxy speaks OpenAI Chat Completions
  // (`/v1/chat/completions`). OpenClaw's `openai-responses` parser reads
  // assistant text from the Responses API shape (`output[].content[].text`),
  // which doesn't match — chat bubbles render empty even though tokens are
  // billed correctly. Stay on `openai-completions` until the proxy exposes a
  // first-class `/v1/responses` endpoint.
  const providerJson = JSON.stringify({
    baseUrl,
    api: 'openai-completions',
    apiKey,
    models: [{ id: 'auto', name: 'Manifest Auto' }],
  });
  return `openclaw config set models.providers.manifest '${providerJson}'
openclaw config set agents.defaults.model.primary manifest/auto
openclaw gateway restart`;
}

/**
 * The JSON block to paste into ~/.claude/settings.json. Claude Code reads
 * `env` keys from settings.json on every startup, so this is the persistent
 * configuration path — no shell rc edits, no Node required, no command-line
 * gymnastics. Pin the default model to Manifest's `auto` route so Claude
 * Code does not send its built-in Anthropic model IDs to the gateway.
 * Anthropic SDK auto-appends /v1/messages to baseURL, so we strip a trailing
 * /v1 from the rendered URL.
 */
export function getClaudeCodeSettingsSnippet(baseUrl: string, apiKey: string): string {
  const url = stripV1Suffix(baseUrl);
  return `{
  "model": "auto",
  "env": {
    "ANTHROPIC_BASE_URL": "${url}",
    "ANTHROPIC_AUTH_TOKEN": "${apiKey}"
  }
}`;
}

/**
 * The JSON block to merge into ~/.nanobot/config.json. Nanobot only accepts its
 * predefined provider keys; "custom" is the built-in slot for arbitrary
 * OpenAI-compatible endpoints, so we use that rather than an arbitrary name.
 */
export function getNanobotConfigSnippet(baseUrl: string, apiKey: string): string {
  return `{
  "agents": {
    "defaults": {
      "provider": "custom",
      "model": "auto"
    }
  },
  "providers": {
    "custom": {
      "apiKey": "${apiKey}",
      "apiBase": "${baseUrl}"
    }
  }
}`;
}

/** Which platforms have a first-class setup snippet, and which function renders it. */
export const PLATFORM_SETUP_SNIPPETS: Readonly<
  Record<string, (baseUrl: string, apiKey: string) => string>
> = {
  openclaw: getOpenClawSnippet,
  'claude-code': getClaudeCodeSettingsSnippet,
  nanobot: getNanobotConfigSnippet,
};
