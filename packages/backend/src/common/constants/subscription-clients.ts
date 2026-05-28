/**
 * Client identification strings sent to subscription backends that gate model
 * lists or requests by client version. Lifted into one place so bumping a
 * version when an upstream releases a new model is a single edit.
 *
 * Codex (`https://chatgpt.com/backend-api/codex/...`): the `client_version`
 * URL param is enforced — older versions silently receive an older model
 * subset. Bump `CODEX_CLI_VERSION` to track the current `openai/codex` CLI
 * release. The user-agent string is not enforced, so it stays synthetic.
 *
 * Copilot (`https://api.githubcopilot.com/...`): GitHub validates the
 * `Editor-Version` and `Editor-Plugin-Version` headers; both are bumped
 * together when GitHub deprecates an older pair.
 */

export const CODEX_CLI_VERSION = '0.128.0';
export const CODEX_CLI_ORIGINATOR = 'codex_cli_rs';
export const CODEX_CLI_USER_AGENT = 'codex_cli_rs/0.0.0 (Unknown 0; unknown) unknown';

export const COPILOT_EDITOR_VERSION = 'vscode/1.100.0';
export const COPILOT_PLUGIN_VERSION = 'copilot/1.300.0';
