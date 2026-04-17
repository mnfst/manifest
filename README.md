<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-white.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-dark.svg" />
    <img src="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-dark.svg" alt="Manifest" height="53" title="Manifest"/>
  </picture>
</p>
<p align="center">
    Affordable Personal AI
</p>

![manifest-gh](https://github.com/user-attachments/assets/7dd74fc2-f7d6-4558-a95a-014ed754a125)

<p align="center">
  <span><img src="https://img.shields.io/badge/status-beta-yellow" alt="beta" /></span>
  &nbsp;
  <a href="https://github.com/mnfst/manifest/stargazers"><img src="https://img.shields.io/github/stars/mnfst/manifest?style=flat" alt="GitHub stars" /></a>
  &nbsp;
  <a href="https://hub.docker.com/r/manifestdotbuild/manifest"><img src="https://img.shields.io/docker/pulls/manifestdotbuild/manifest?color=2496ED&label=docker%20pulls" alt="Docker pulls" /></a>
  &nbsp;
  <a href="https://hub.docker.com/r/manifestdotbuild/manifest/tags"><img src="https://img.shields.io/docker/image-size/manifestdotbuild/manifest/latest?color=2496ED&label=image%20size" alt="Docker image size" /></a>
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
<a href="https://trendshift.io/repositories/12890" target="_blank"><img src="https://trendshift.io/api/badge/repositories/12890" alt="mnfst%2Fmanifest | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

## What is Manifest?

Manifest is a smart model router for Personal AI Agents like OpenClaw or Hermes. It sits between your agent and your LLM providers, scores each request, and routes it to the cheapest model that can handle it. Simple questions go to fast, cheap models. Hard problems go to expensive ones. You save money without thinking about it.

- Route requests to the right model: Cut costs up to 70%
- Automatic fallbacks: If a model fails, the next one picks up
- Set limits: Don't exceed your budget

## Quick start

### Cloud version

Go to [app.manifest.build](https://app.manifest.build) and follow the guide.

### Self-hosted (Docker)

Manifest ships as a [Docker image](https://hub.docker.com/r/manifestdotbuild/manifest). One command:

```bash
bash <(curl -sSL https://raw.githubusercontent.com/mnfst/manifest/main/docker/install.sh)
```

The installer downloads the compose file, generates a secret, and brings up the stack. Give it about 30 seconds to boot.

Open [http://localhost:3001](http://localhost:3001) and sign up. The first account you create becomes the admin. Full self-hosting guide: [docker/DOCKER_README.md](docker/DOCKER_README.md).

> Docker is the only supported distribution. The legacy `manifest` npm package is deprecated and no longer published.

## How it works

Every request to `manifest/auto` goes through a 23-dimension scoring algorithm (runs in under 2ms). The scorer picks a tier (simple, standard, complex, or reasoning) and routes to the best model in that tier from your connected providers.

All routing data (tokens, costs, model, duration) is recorded automatically. You see it in the dashboard. No extra setup.

## Manifest vs OpenRouter

|              | Manifest                                     | OpenRouter                                          |
| ------------ | -------------------------------------------- | --------------------------------------------------- |
| Built for | Personal AI agents and consumer apps | Enterprise API traffic |
| Architecture | Local. Your requests, your providers         | Cloud proxy. All traffic goes through their servers |
| Cost         | Free                                         | 5% fee on every API call                            |
| Source code  | MIT, fully open                              | Proprietary                                         |
| Data privacy | Metadata only (cloud) or fully local         | Prompts and responses pass through a third party    |
| Transparency | Open scoring. You see why a model was chosen | No visibility into routing decisions                |
| Control | Define your model per tier with up to 5 fallbacks each, from complexity tiers (Simple → Reasoning) to specialized ones (Coding, Vision). | Flat fallback list per request, or opaque auto-routing. No user-defined tiers. |
| Custom providers | Add custom providers and models | Supported providers only, no arbitrary endpoints |
| Subscription support | Route through flat-rate subscriptions you already pay for (MiniMax $20/mo, etc.) | Pay-per-use billing |

## Supported providers

Works with 300+ models across these providers. Connect with an API key, or reuse an existing paid subscription where supported:

| Provider                                                                       | API key | Subscription               |
| ------------------------------------------------------------------------------ | :-----: | :------------------------- |
| [OpenAI](https://platform.openai.com/)                                         |   ✅    | ✅ ChatGPT Plus / Pro / Team |
| [Anthropic](https://www.anthropic.com/)                                        |   ✅    | ✅ Claude Max / Pro          |
| [Google Gemini](https://ai.google.dev/)                                        |   ✅    |                            |
| [DeepSeek](https://www.deepseek.com/)                                          |   ✅    |                            |
| [xAI](https://x.ai/)                                                           |   ✅    |                            |
| [Mistral AI](https://mistral.ai/)                                              |   ✅    |                            |
| [Qwen (Alibaba)](https://www.alibabacloud.com/en/solutions/generative-ai/qwen) |   ✅    |                            |
| [MiniMax](https://www.minimax.io/)                                             |   ✅    | ✅ MiniMax Coding Plan       |
| [Kimi (Moonshot)](https://kimi.ai/)                                            |   ✅    |                            |
| [Z.ai (Zhipu)](https://z.ai/)                                                  |   ✅    | ✅ GLM Coding Plan           |
| [GitHub Copilot](https://github.com/features/copilot)                          |         | ✅ Copilot subscription      |
| [OpenRouter](https://openrouter.ai/)                                           |   ✅    |                            |
| [Ollama](https://ollama.com/)                                                  |   ✅ Local   | ✅ Ollama Cloud              |
| Custom providers (OpenAI-compatible)                                           |   ✅    |                            |

## Contributing

Manifest is open source under the [MIT license](LICENSE). See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, architecture, and workflow. Join the conversation on [Discord](https://discord.gg/FepAked3W7).

## Quick links

- [GitHub](https://github.com/mnfst/manifest)
- [Docs](https://manifest.build/docs)
- [Discord](https://discord.com/invite/FepAked3W7)
- [Discussions](https://github.com/mnfst/manifest/discussions)

## License

[MIT](LICENSE)
