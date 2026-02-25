# Manifest

Cut your AI agent costs by up to 70%. Manifest is an open-source [OpenClaw](https://github.com/open-claw/open-claw) plugin that combines **intelligent LLM routing** with **real-time cost observability** — one install, zero configuration.

Instead of sending every request to the most expensive model, Manifest scores each query in under 2ms and routes it to the most cost-effective model that can handle it. Simple lookups go to fast, cheap models. Complex reasoning goes to frontier models. You see exactly where every dollar goes in a local dashboard.

## Quick start

```bash
openclaw plugins install manifest
openclaw gateway restart
```

Open `http://127.0.0.1:2099` — your dashboard is live with SQLite storage, no accounts or external services needed.

## How the LLM router works

Manifest registers as an OpenAI-compatible provider in OpenClaw under the model name `auto`. When a request comes in:

1. **Score** — The plugin analyzes the conversation locally (last 10 user/assistant messages, excluding system prompts) and assigns a complexity tier.
2. **Route** — The tier maps to the cheapest model that meets the quality bar: simple tasks go to small models, complex tasks go to frontier models.
3. **Momentum** — Recent tier history (last 5 turns, 30-min window) is factored in so mid-conversation complexity shifts are handled smoothly.
4. **Observe** — Every routed request is traced with the resolved model, provider, tier, token counts, and cost — visible in your dashboard.

The entire scoring step adds < 2ms of latency. If the resolve call fails, the request falls through to the default model with no interruption.

### Enable routing

Routing activates automatically in local mode. Point your OpenClaw config to use the `manifest` provider with model `auto`:

```yaml
# openclaw.config.yaml
models:
  - provider: manifest
    model: auto
```

## Cost observability

The dashboard tracks every LLM call in real time:

- **Token usage** — input, output, and cache-read tokens broken down by model and provider
- **Cost breakdown** — per-model spend in USD with trend indicators
- **Message log** — paginated history with latency, tokens, and tool calls per request
- **Agent overview** — aggregated metrics across all your agents

### Agent self-query tools

The plugin registers three tools your agent can call to query its own telemetry:

| Tool | Returns |
|------|---------|
| `manifest_usage` | Token consumption (input, output, cache, trend %) |
| `manifest_costs` | Cost breakdown by model in USD |
| `manifest_health` | Connectivity check |

```
User: "How much have I spent today?"
  → manifest_costs({ period: "today" })
  → { total_usd: 0.42, by_model: { "gpt-4o": 0.38, "gpt-4o-mini": 0.04 } }
```

## Data privacy

- **Local mode**: Everything stays on your machine. SQLite database, no network calls.
- **Cloud mode**: Only OpenTelemetry metadata (model, tokens, latency) is sent. Your message content is never collected unless you explicitly enable `captureContent`.

## Configuration

### Local mode (default)

Works out of the box. No API key needed.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | number | `2099` | Dashboard port |
| `host` | string | `127.0.0.1` | Bind address |
| `serviceName` | string | `openclaw-gateway` | OpenTelemetry service name |
| `captureContent` | boolean | `true` | Include message content in spans (always on in local mode) |
| `metricsIntervalMs` | number | `10000` | Metrics export interval |

### Cloud mode

Send telemetry to the hosted platform at [app.manifest.build](https://app.manifest.build):

```bash
openclaw config set plugins.entries.manifest.config.mode cloud
openclaw config set plugins.entries.manifest.config.apiKey "mnfst_YOUR_KEY"
openclaw gateway restart
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | string | `local` | `local` or `cloud` |
| `apiKey` | string | env `MANIFEST_API_KEY` | Agent API key (`mnfst_*`). Required for cloud mode. |
| `endpoint` | string | `https://app.manifest.build/otlp` | OTLP endpoint URL |
| `serviceName` | string | `openclaw-gateway` | OpenTelemetry service name |
| `captureContent` | boolean | `false` | Include message content in spans |
| `metricsIntervalMs` | number | `30000` | Metrics export interval (min 5000ms) |

### Self-hosted

Point to your own Manifest instance:

```bash
openclaw config set plugins.entries.manifest.config.endpoint "http://localhost:3001/otlp/v1"
```

## OpenTelemetry trace structure

The plugin hooks into four OpenClaw lifecycle events and produces standard OpenTelemetry traces:

| Event | What happens |
|-------|-------------|
| `message_received` | Root span created, message counter incremented |
| `before_agent_start` | Child span for the agent turn |
| `tool_result_persist` | Tool span with duration, success/error tracking |
| `agent_end` | Spans closed, token/cost metrics recorded, routing resolved |

```
openclaw.request (SERVER)
  └── openclaw.agent.turn (INTERNAL)     model=gpt-4o-mini, tier=simple
        ├── tool.web_search               duration=320ms
        └── tool.summarize                duration=45ms
```

## Architecture

The plugin bundles all OpenTelemetry dependencies into a single file via esbuild. This avoids the dual-registry problem when OpenClaw's own `@opentelemetry/api` and the plugin's copy coexist. Zero runtime dependencies.

```
Published package:
  dist/index.js          Single-file bundle (~1.4 MB)
  dist/server.js         Embedded NestJS server (local mode)
  dist/backend/          Backend compiled output
  public/                Frontend dashboard assets
  openclaw.plugin.json   Plugin manifest + config schema
  skills/                Bundled agent skills
```

## Development

```bash
npm run build     # Build the bundle
npm run dev       # Watch mode
npm test          # Run tests
npm run typecheck # Type-check
```

Local testing against OpenClaw:

```bash
openclaw plugins install -l ./packages/openclaw-plugin
openclaw gateway restart
# Dashboard at http://127.0.0.1:2099
```

## Troubleshooting

**No spans appearing?**
- In cloud mode, check your API key starts with `mnfst_`
- Verify the endpoint is reachable: `curl -I http://your-endpoint/v1/traces`
- Disable `diagnostics-otel` if enabled: `openclaw plugins disable diagnostics-otel`

**Stale code after update?**
```bash
rm -rf /tmp/jiti && openclaw gateway restart
```

## License

[MIT](LICENSE.md)
