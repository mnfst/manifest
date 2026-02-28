# OpenClaw Plugin — Contributor Guide

> **Note:** This README is for contributors working on the plugin source code. When the npm package is published, this file is automatically replaced by the [root project README](../../README.md) so that [npmjs.com/package/manifest](https://www.npmjs.com/package/manifest) shows the main project documentation.

## Overview

The `packages/openclaw-plugin` directory contains the OpenClaw plugin that powers Manifest's LLM routing and observability. It registers as an OpenClaw extension and hooks into the gateway lifecycle to intercept, route, score, and trace every LLM request.

## Source Files

| File | Purpose |
|------|---------|
| `index.ts` | Plugin entry point — registers hooks, routing, tools, and commands with the OpenClaw API |
| `config.ts` | Configuration parsing and validation (`mode`, `apiKey`, `endpoint`, etc.) |
| `hooks.ts` | OpenClaw lifecycle hooks (`message_received`, `before_agent_start`, `tool_result_persist`, `agent_end`) |
| `routing.ts` | LLM router — scores queries across 23 dimensions and selects the optimal model/provider |
| `telemetry.ts` | OpenTelemetry SDK setup — creates traces, spans, and metrics for each request |
| `telemetry-config.ts` | OTLP exporter configuration (endpoints, headers, batching) |
| `tools.ts` | Agent self-query tools (`manifest_usage`, `manifest_costs`, `manifest_health`) |
| `command.ts` | CLI command registration for `openclaw manifest ...` |
| `local-mode.ts` | Local mode bootstrap — starts the embedded NestJS server and injects provider config |
| `server.ts` | Embedded server entry point (imports and starts the backend in local/dev mode) |
| `product-telemetry.ts` | Anonymous product analytics (opt-out via `MANIFEST_TELEMETRY_OPTOUT=1`) |
| `verify.ts` | Connection verification — checks endpoint reachability on startup |
| `constants.ts` | Shared constants (endpoints, defaults, version) |

## How it Works

1. **Register** — OpenClaw loads `dist/index.js` and calls `register(api)`. The plugin parses config, initializes OpenTelemetry, and registers lifecycle hooks.
2. **Hook** — On each request, lifecycle hooks create OpenTelemetry spans and record token counts, latency, tool calls, and costs.
3. **Route** — When model is `auto`, the router scores the conversation (last 10 messages, momentum from last 5 turns) and selects the cheapest model that meets the quality bar. Adds <2ms latency.
4. **Export** — Spans and metrics are batched and exported via OTLP to the configured endpoint (cloud, local embedded server, or self-hosted).

## Build

```bash
npm run build     # esbuild bundle + tsc server + copy assets
npm run dev       # Watch mode (rebuild on change)
npm test          # Jest tests
npm run typecheck # Type-check without emitting
```

The build produces:

```
dist/index.js          Single-file esbuild bundle (~1.4 MB, zero runtime OTel deps)
dist/server.js         Embedded NestJS server (local mode)
dist/backend/          Backend compiled output
public/                Frontend dashboard assets
openclaw.plugin.json   Plugin manifest + config schema
skills/                Bundled agent skills
```

### Why a single-file bundle?

OpenClaw loads its own `@opentelemetry/api`. If the plugin brings a second copy, the two registries conflict and traces break. Bundling everything into one file with esbuild avoids the dual-registry problem entirely.

## Local Testing

```bash
# Install plugin from local source
openclaw plugins install -l ./packages/openclaw-plugin

# Restart gateway to load the plugin
openclaw gateway restart

# Dashboard at http://127.0.0.1:2099
```

## npm Publish

On publish (`npm publish` or via the release workflow), the `prepublishOnly` script copies the root `../../README.md` over this file so that the npm package page shows the main project README instead of this contributor guide.
