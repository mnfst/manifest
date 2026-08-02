# mnfst — Manifest management CLI

Configure Manifest from the terminal (or from a coding agent): create agents, connect providers, set routing, and read usage — without opening the dashboard. Thin wrapper over the `/api/v1` management REST API; JSON output on stdout, exit `0`/`1`, never interactive mid-task.

## Install / run

The package is part of the monorepo (not yet published to npm):

```bash
npm run build --workspace=packages/cli
node packages/cli/bin/mnfst.js --help
# or link it:
npm link --workspace=packages/cli && mnfst --help
```

## Login once, manage everything

One global API key (a tenant credential from the `api_keys` table — e.g. the seeded
`dev-api-key-manifest-001` on a dev stack) unlocks every management command. Per-agent
`mnfst_…` keys are **never inputs**: the CLI only produces them, delivered to
`--key-file` paths with mode `0600`.

```bash
# browser login (default): opens the dashboard, you approve, the CLI gets a token
mnfst login --url http://localhost:2099

# non-interactive alternatives — the secret is never passed as an argument
printf '%s' "$MY_KEY" | mnfst login --token-stdin --url http://localhost:2099
# or: mnfst login --token-env MY_KEY --url http://localhost:2099

mnfst whoami
mnfst agent create --name coding-assistant --key-file ./coding-assistant.key
mnfst provider connect --provider openai --agent coding-assistant --credential-env OPENAI_API_KEY
mnfst routing tier set coding-assistant --tier default --model gpt-4o-mini --provider openai
mnfst routing status coding-assistant
mnfst overview --range 7d
```

Credentials resolve as: `MANIFEST_API_KEY` env var → the stored credential whose origin
exactly matches the target (`--url` → `MANIFEST_URL` → active login → Cloud). A key
stored for one host is never sent to another. Config lives at
`~/.config/manifest/config.json` (mode `0600`).

Browser login runs a one-shot loopback listener on `127.0.0.1`, sends the browser to
`/cli/auth?port=…&state=…`, and exchanges the returned one-time code for a token over a
direct CLI→server call — the token itself never travels through the browser. It needs an
interactive terminal (`no_tty` otherwise, so scripts get a clear pointer to
`--token-stdin`). `mnfst logout` revokes the stored token server-side on a best-effort
basis before deleting it locally, and reports `revoked` in its JSON.

Destructive commands (`delete`, `rotate-key`, `disconnect`, `clear`) require `--yes`
and fail rather than prompt. Run `mnfst --help` for the full command list.

## Telemetry

The CLI sends one anonymous event per command, on by default. The **entire** payload is:

| Field         | Value                                                                                                                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anon_id`     | A persistent anonymous **install id** — a random UUID minted on first run and stored at `~/.config/manifest/telemetry-id` (mode `0600`). It identifies an install, not a person, tenant, or machine. Delete the file to reset it. |
| `cli_version` | The `mnfst` version.                                                                                                                                                                                                              |
| `command`     | The command **name** only, as registered (`agent create`, `provider connect`) — never arguments.                                                                                                                                  |
| `ok`          | Whether the command exited `0`.                                                                                                                                                                                                   |
| `duration_ms` | Wall-clock duration, clamped to 0–600000.                                                                                                                                                                                         |
| `os`          | `darwin`, `linux`, `win32`, or `other`.                                                                                                                                                                                           |

Nothing else is collected: no arguments, agent or provider names, URLs, hostnames, prompts,
API keys, tokens, file paths, or IP-derived data. The request is fire-and-forget with a 500 ms
timeout, and every failure is swallowed.

- **Opt out:** `MANIFEST_TELEMETRY_DISABLED=1` (also accepts `true`).
- **Redirect:** `MANIFEST_CLI_TELEMETRY_ENDPOINT=<url>` overrides the default endpoint
  (`https://telemetry.manifest.build/v1/cli-event`) — useful for self-hosted collection or
  for inspecting exactly what is sent.

Design spec: `docs/superpowers/specs/2026-07-31-manifest-cli-design.md` (local-only).
