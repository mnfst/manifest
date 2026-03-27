# manifest

Self-hosted [Manifest](https://manifest.build) plugin for [OpenClaw](https://openclaw.ai) — runs the full LLM router locally with an embedded NestJS server, SQLite database, and dashboard.

## Install

```bash
openclaw plugins install manifest
openclaw gateway restart
```

Dashboard opens at **http://127.0.0.1:2099**. The plugin auto-generates an API key, starts the embedded server, and registers `manifest/auto` as a model. No configuration needed.

## How it works

On gateway startup the plugin:

1. Generates a persistent API key (`mnfst_local_*`) stored in `~/.openclaw/manifest/config.json`
2. Starts the embedded NestJS backend with SQLite at `~/.openclaw/manifest/manifest.db`
3. Injects `manifest` as a provider into `~/.openclaw/openclaw.json`
4. Serves the dashboard from the bundled frontend static files

If the server is already running on the configured port, the plugin reuses it instead of starting a new instance.

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `port` | `number` | `2099` | Embedded server port |
| `host` | `string` | `127.0.0.1` | Bind address |

```bash
openclaw config set plugins.entries.manifest.config.port 3099
openclaw gateway restart
```

## Cloud mode

For cloud routing without the embedded server, use the lightweight provider plugin instead:

```bash
openclaw plugins install manifest-provider
openclaw providers setup manifest-provider
```

See [manifest-provider](https://www.npmjs.com/package/manifest-provider).

## Data

Telemetry, dashboard, and configuration data stays on your machine. LLM requests are forwarded to your configured providers (e.g. OpenAI, Anthropic) as part of normal routing.

- **Database**: `~/.openclaw/manifest/manifest.db` (SQLite)
- **API key**: `~/.openclaw/manifest/config.json`
- **Provider config**: `~/.openclaw/openclaw.json`

## Contributing

This package lives at `packages/openclaw-plugins/manifest/` in the [mnfst/manifest](https://github.com/mnfst/manifest) monorepo.

```bash
npm run build --workspace=packages/openclaw-plugins/manifest
npm test --workspace=packages/openclaw-plugins/manifest
```

**Note:** On `npm publish`, this README is replaced by the root project README.
