<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-white.svg" />
    <source media="(prefers-color-scheme: light)" srcset=".github/assets/logo-dark.svg" />
    <img src=".github/assets/logo-dark.svg" alt="Manifest" height="53" title="Manifest"/>
  </picture>
</p>
<p align="center">
    🦞 Take control of your
OpenClaw costs
</p>

![manifest-gh](https://github.com/user-attachments/assets/7dd74fc2-f7d6-4558-a95a-014ed754a125)

<p align="center">
  <a href="https://github.com/mnfst/manifest/stargazers"><img src="https://img.shields.io/github/stars/mnfst/manifest?style=flat" alt="GitHub stars" /></a>
  &nbsp;
  <a href="https://www.npmjs.com/package/manifest"><img src="https://img.shields.io/npm/v/manifest?color=cb3837&label=npm" alt="npm version" /></a>
  &nbsp;
  <a href="https://www.npmjs.com/package/manifest"><img src="https://img.shields.io/npm/dw/manifest?color=cb3837" alt="npm downloads" /></a>
  &nbsp;
  <a href="https://github.com/mnfst/manifest/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/mnfst/manifest/ci.yml?branch=main&label=CI" alt="CI status" /></a>
  &nbsp;
  <a href="https://app.codecov.io/gh/mnfst/manifest"><img src="https://img.shields.io/codecov/c/github/mnfst/manifest?label=coverage" alt="Codecov" /></a>
  &nbsp;
  <a href="LICENSE"><img src="https://img.shields.io/github/license/mnfst/manifest?color=blue" alt="license" /></a>
  &nbsp;
  <a href="https://discord.gg/FepAked3W7"><img src="https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white" alt="Discord" /></a>
  &nbsp;
  <a href="https://relatedrepos.com/gh/mnfst/manifest"><img src="https://img.shields.io/badge/related-repos-yellow" alt="RelatedRepos" /></a>
  
</p>

## What do you get?

- 🔀 **Routes every request to the right model** — and cuts costs up to 70%
- 📊 **Track your expenses** — real-time dashboard that shows tokens and costs per model
- 🔔 **Set limits** — set up alerts (soft or hard) if your consumption exceeds a certain volume

## Why Manifest

OpenClaw sends all your requests to the same model, which is not cost-effective since you summon big models for tiny tasks. Manifest solves it by redirecting queries to the most cost-effective model.

Manifest is an OpenClaw plugin that intercepts your query, passes it through a 23-dimension scoring algorithm in <2ms and sends it to the most suitable model.

Unlike almost all alternatives, everything stays on your machine. No suspicious installer, no black box, no third party, no crypto.

## Quick Start

### Cloud vs Local

Manifest is available in cloud and local versions. While both versions install the same OpenClaw Plugin, the local version stores the telemetry data on your computer and the cloud version uses our secure platform.

#### Use cloud if
- You want a quick install
- You want to access the dashboard from different devices
- You want to connect multiple agents

#### Use local if
- You don't want the telemetry data to move from your computer
- You don’t need multi-device access
- You don't want to subscribe to a cloud service

If you don't know which version to chose, start with the **cloud version**.

### Cloud (default)

```bash
openclaw plugins install manifest
openclaw config set plugins.entries.manifest.config.apiKey "mnfst_YOUR_KEY"
openclaw gateway restart
```

Sign up at [app.manifest.build](https://app.manifest.build) to get your API key.

### Local

```bash
openclaw plugins install manifest
openclaw config set plugins.entries.manifest.config.mode local
openclaw gateway restart
```

Dashboard opens at **http://127.0.0.1:2099**. Telemetry from your agents flows in automatically.

## Features

- **LLM Router** — scores each query and calls the most suitable model
- **Real-time dashboard** — tokens, costs, messages, and model usage at a glance
- **No coding required** — Simple install as OpenClaw plugin
- **OTLP-native** — standard OpenTelemetry ingestion (traces, metrics, logs)

## Privacy by architecture

**In local mode, your data stays on your machine.** All agent messages, token counts, costs, and telemetry are stored locally. In cloud mode, only OpenTelemetry metadata (model, tokens, latency) is sent — message content is never collected.

**In cloud mode, the blind proxy physically cannot read your prompts** This is fundamentally different from services saying "trust us."

The only thing Manifest collects is anonymous product analytics (hashed machine ID, OS platform, package version, event names) to help improve the project. No personally identifiable information or agent data is included.

**Opting out:**

```bash
MANIFEST_TELEMETRY_OPTOUT=1
```

Or add `"telemetryOptOut": true` to `~/.openclaw/manifest/config.json`.


## Manifest vs OpenRouter

|              | Manifest                                                   | OpenRouter                                                    |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------- |
| Architecture | Runs locally — data stays on your machine                  | Cloud proxy — all traffic routes through their servers        |
| Cost         | Free                                                       | 5% fee on every API call                                      |
| Source code  | MIT licensed, fully open                                   | Proprietary                                                   |
| Data privacy | 100% local routing and logging                    | Your prompts and responses pass through a third party         |
| Transparency | Open scoring algorithm — see exactly why a model is chosen | Black box routing, no visibility into how models are selected |

## Configuration

Cloud mode is the default. For local mode (zero config), set `mode` to `local`.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mode` | `string` | `cloud` | `cloud` sends telemetry to app.manifest.build (default). `local` runs an embedded server on your machine. `dev` connects to a local backend without API key. |
| `apiKey` | `string` | env `MANIFEST_API_KEY` | Agent API key (must start with `mnfst_`). Required for cloud mode, auto-generated in local mode. |
| `endpoint` | `string` | `https://app.manifest.build/otlp` | OTLP endpoint URL. Only relevant for cloud and dev modes. |
| `port` | `number` | `2099` | Port for the embedded dashboard server (local mode only). |
| `host` | `string` | `127.0.0.1` | Bind address for the embedded server (local mode only). |

```bash
# Switch to local mode
openclaw config set plugins.entries.manifest.config.mode local
openclaw gateway restart
```

## Contributing

Manifest is open source under the [MIT license](LICENSE). See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, architecture notes, and workflow. Join the conversation on [Discord](https://discord.gg/FepAked3W7).

> **Want a hosted version instead?** Check out [app.manifest.build](https://app.manifest.build)

## License

[MIT](LICENSE)
