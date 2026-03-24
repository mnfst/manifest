
<a href="https://luma.com/clawcondfw">
<img width="1543" height="256" alt="Capture d’écran 2026-03-18 à 16 13 34" src="https://github.com/user-attachments/assets/11294f94-76c4-47bb-9c75-5ccc6b28fbdb" />
</a>
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-white.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-dark.svg" />
    <img src="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-dark.svg" alt="Manifest" height="53" title="Manifest"/>
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
</p>

<p align="center">
<a href="https://trendshift.io/repositories/12890" target="_blank"><img src="https://trendshift.io/api/badge/repositories/12890" alt="mnfst%2Fmanifest | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>&nbsp;&nbsp;<a href="https://www.producthunt.com/products/manifest-361?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-manifest-361" target="_blank" rel="noopener noreferrer"><img alt="Manifest - Open Source LLM Router for OpenClaw | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1104032&amp;theme=light&amp;t=1774281267919"></a>
</p>

## What do you get?

- 🔀 **Route requests to the right model** — cut costs up to 70%
- 🔄 **Automatic fallbacks** — if a model fails, retry with backup models instantly
- 🔔 **Set limits** — get alerts when usage goes over a threshold

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
- You are using a local model like Ollama

If you don't know which version to choose, start with the **cloud version**.

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

To use tailsacle to proxy it to your network (needs Tailscale installed in both devices).

```
tailscale serve --bg 2099
```

## Features

- **LLM Router** — scores each query and calls the most suitable model
- **Real-time dashboard** — tokens, costs, messages, and model usage at a glance
- **No coding required** — Simple install as OpenClaw plugin
- **OTLP-native** — standard OpenTelemetry ingestion (traces, metrics, logs)

## Privacy by architecture

**In local mode, your data stays on your machine.** All agent messages, token counts, costs, and telemetry are stored locally. In cloud mode, only OpenTelemetry metadata (model, tokens, latency) is sent — message content is never collected.

**In cloud mode, the blind proxy physically cannot read your prompts.** This is fundamentally different from services saying "trust us."

In local mode, all Manifest data stays on your machine. No analytics or telemetry data is sent externally.


## Manifest vs OpenRouter

|              | Manifest                                                   | OpenRouter                                                    |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------- |
| Architecture | Runs locally — data stays on your machine                  | Cloud proxy — all traffic routes through their servers        |
| Cost         | Free                                                       | 5% fee on every API call                                      |
| Source code  | MIT licensed, fully open                                   | Proprietary                                                   |
| Data privacy | 100% local routing and logging                    | Your prompts and responses pass through a third party         |
| Transparency | Open scoring algorithm — see exactly why a model is chosen | Black box routing, no visibility into how models are selected |

## Supported Providers

Works with **300+ models** across these providers:

| Provider | Models |
|----------|--------|
| [OpenAI](https://platform.openai.com/) | `gpt-5.3`, `gpt-4.1`, `o3`, `o4-mini` + 54 more |
| [Anthropic](https://www.anthropic.com/) | `claude-opus-4-6`, `claude-sonnet-4.5`, `claude-haiku-4.5` + 14 more |
| [Google Gemini](https://ai.google.dev/) | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-3-pro` + 19 more |
| [DeepSeek](https://www.deepseek.com/) | `deepseek-chat`, `deepseek-reasoner` + 11 more |
| [xAI](https://x.ai/) | `grok-4`, `grok-3`, `grok-3-mini` + 8 more |
| [Mistral AI](https://mistral.ai/) | `mistral-large`, `codestral`, `devstral` + 26 more |
| [Qwen (Alibaba)](https://www.alibabacloud.com/en/solutions/generative-ai/qwen) | `qwen3-235b`, `qwen3-coder`, `qwq-32b` + 42 more |
| [MiniMax](https://www.minimax.io/) | `minimax-m2.5`, `minimax-m1`, `minimax-m2` + 5 more |
| [Kimi (Moonshot)](https://kimi.ai/) | `kimi-k2`, `kimi-k2.5` + 3 more |
| [Amazon Nova](https://aws.amazon.com/ai/nova/) | `nova-pro`, `nova-lite`, `nova-micro` + 5 more |
| [Z.ai (Zhipu)](https://z.ai/) | `glm-5`, `glm-4.7`, `glm-4.5` + 5 more |
| [OpenRouter](https://openrouter.ai/) | 300+ models from all providers |
| [Ollama](https://ollama.com/) | Run any model locally (Llama, Gemma, Mistral, …) |

## Contributing

Manifest is open source under the [MIT license](LICENSE). See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, architecture notes, and workflow. Join the conversation on [Discord](https://discord.gg/FepAked3W7).

> **Want a hosted version instead?** Check out [app.manifest.build](https://app.manifest.build)

## Quick Links

- [GitHub](https://github.com/mnfst/manifest)
- [Docs](https://manifest.build/docs)
- [Discord](https://discord.com/invite/FepAked3W7)
- [Discussions](https://github.com/mnfst/manifest/discussions)

## License

[MIT](LICENSE)
