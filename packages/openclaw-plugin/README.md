# Manifest

Observability plugin for [OpenClaw](https://github.com/open-claw/open-claw). Collects traces, metrics, and cost data from your AI agent and exports them to [Manifest](https://manifest.build) via OTLP/HTTP.

## Install

```bash
openclaw plugins install manifest
openclaw config set plugins.entries.manifest.config.apiKey "mnfst_YOUR_KEY"
openclaw gateway restart
```

Or with environment variables:

```bash
export MANIFEST_API_KEY=mnfst_YOUR_KEY
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | env `MANIFEST_API_KEY` | Agent API key (`mnfst_*`) |
| `endpoint` | string | `https://app.manifest.build/api/v1/otlp` | OTLP endpoint URL |
| `serviceName` | string | `openclaw-gateway` | OpenTelemetry service name |
| `captureContent` | boolean | `false` | Include message content in spans |
| `metricsIntervalMs` | number | `30000` | Metrics export interval (min 5000ms) |

Point to a self-hosted instance:

```bash
openclaw config set plugins.entries.manifest.config.endpoint "http://localhost:3001/otlp/v1"
```

## What it does

The plugin hooks into four OpenClaw lifecycle events and produces OpenTelemetry traces and metrics:

| Event | What happens |
|-------|-------------|
| `message_received` | Root span created, message counter incremented |
| `before_agent_start` | Child span for the agent turn |
| `tool_result_persist` | Tool span with duration, success/error tracking |
| `agent_end` | Spans closed, token and LLM metrics recorded |

Resulting trace:

```
openclaw.request (SERVER)
  └── openclaw.agent.turn (INTERNAL)
        ├── tool.web_search
        └── tool.summarize
```

## Agent tools

The plugin registers three tools the agent can call to query its own telemetry:

- **`manifest_usage`** — token consumption (input, output, cache, trend)
- **`manifest_costs`** — cost breakdown by model in USD
- **`manifest_health`** — connectivity check

```
User: "How many tokens today?"
  → manifest_usage({ period: "today" })
  → { total_tokens: 45230, input_tokens: 34500, output_tokens: 10730, trend_pct: -20 }
```

## Architecture

The plugin bundles all OpenTelemetry dependencies into a single file via esbuild. This avoids the dual-registry problem that occurs when OpenClaw's own `@opentelemetry/api` and the plugin's copy coexist as separate instances. Zero runtime dependencies.

```
Published package:
  dist/index.js          Single-file bundle (~1.4MB)
  openclaw.plugin.json   Plugin manifest + config schema
  skills/                Bundled agent skills
  README.md
  LICENSE.md
```

## Development

```bash
npm run build    # Build the bundle
npm run dev      # Watch mode
npm test         # Run tests
npm run typecheck # Type check
```

Local testing:

```bash
openclaw plugins install -l ./packages/openclaw-plugin
openclaw config set plugins.entries.manifest.config.apiKey "mnfst_YOUR_KEY"
openclaw config set plugins.entries.manifest.config.endpoint "http://localhost:3001/otlp/v1"
openclaw gateway restart
```

## Troubleshooting

**No spans appearing?**
- Check your API key starts with `mnfst_`
- Verify the endpoint is reachable: `curl -I http://your-endpoint/v1/traces`
- Disable `diagnostics-otel` if enabled: `openclaw plugins disable diagnostics-otel`

**Stale code after update?**
```bash
rm -rf /tmp/jiti && openclaw gateway restart
```

## License

[MIT](LICENSE.md)
