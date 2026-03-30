<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-white.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-dark.svg" />
    <img src="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-dark.svg" alt="Manifest" height="53" title="Manifest"/>
  </picture>
</p>
<p align="center">
    Take control of your OpenClaw costs
</p>

![manifest-gh](https://github.com/user-attachments/assets/7dd74fc2-f7d6-4558-a95a-014ed754a125)

<p align="center">
  <span><img src="https://img.shields.io/badge/status-beta-yellow" alt="beta" /></span>
  &nbsp;
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
<a href="https://trendshift.io/repositories/12890" target="_blank"><img src="https://trendshift.io/api/badge/repositories/12890" alt="mnfst%2Fmanifest | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

## What is Manifest?

Manifest is a smart model router for OpenClaw. It sits between your agent and your LLM providers, scores each request, and routes it to the cheapest model that can handle it. Simple questions go to fast, cheap models. Hard problems go to expensive ones. You save money without thinking about it.

- Route requests to the right model: Cut costs up to 70%
- Automatic fallbacks: If a model fails, the next one picks up
- Set limits: Don't exceed your budget

## Quick start

### Cloud version

Go to [app.manifest.build](https://app.manifest.build) and follow the guide.

### Local version

```bash
openclaw plugins install manifest
openclaw gateway restart
```

Dashboard opens at **http://127.0.0.1:2099**. The plugin starts an embedded server, runs the dashboard locally, and registers itself as a provider automatically. No account or API key needed.

### Docker

Run the full Manifest stack (app + PostgreSQL) with a single command:

```bash
curl -O https://raw.githubusercontent.com/mnfst/manifest/main/docker-compose.yml
docker compose up -d
```

Open **http://localhost:3001** and log in with `admin@manifest.build` / `manifest`.

See the [Docker Hub page](https://hub.docker.com/r/manifestdotbuild/manifest) for more options (custom ports, standalone Docker run, environment variables).

### Cloud vs local

Pick cloud version for quick setup and multi-device access. Pick local version for keeping all your data on your machine or for using local models like Ollama. Pick Docker for self-hosting on your own infrastructure.

Not sure which one to choose? Start with cloud.

## How it works

Every request to `manifest/auto` goes through a 23-dimension scoring algorithm (runs in under 2ms). The scorer picks a tier (simple, standard, complex, or reasoning) and routes to the best model in that tier from your connected providers.

All routing data (tokens, costs, model, duration) is recorded automatically. You see it in the dashboard. No extra setup.

## Manifest vs OpenRouter

|              | Manifest                                     | OpenRouter                                          |
| ------------ | -------------------------------------------- | --------------------------------------------------- |
| Architecture | Local. Your requests, your providers         | Cloud proxy. All traffic goes through their servers |
| Cost         | Free                                         | 5% fee on every API call                            |
| Source code  | MIT, fully open                              | Proprietary                                         |
| Data privacy | Metadata only (cloud) or fully local         | Prompts and responses pass through a third party    |
| Transparency | Open scoring. You see why a model was chosen | No visibility into routing decisions                |

## Supported providers

Works with 300+ models across these providers:

| Provider                                                                       | Models                                                               |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| [OpenAI](https://platform.openai.com/)                                         | `gpt-5.3`, `gpt-4.1`, `o3`, `o4-mini` + 54 more                      |
| [Anthropic](https://www.anthropic.com/)                                        | `claude-opus-4-6`, `claude-sonnet-4.5`, `claude-haiku-4.5` + 14 more |
| [Google Gemini](https://ai.google.dev/)                                        | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-3-pro` + 19 more       |
| [DeepSeek](https://www.deepseek.com/)                                          | `deepseek-chat`, `deepseek-reasoner` + 11 more                       |
| [xAI](https://x.ai/)                                                           | `grok-4`, `grok-3`, `grok-3-mini` + 8 more                           |
| [Mistral AI](https://mistral.ai/)                                              | `mistral-large`, `codestral`, `devstral` + 26 more                   |
| [Qwen (Alibaba)](https://www.alibabacloud.com/en/solutions/generative-ai/qwen) | `qwen3-235b`, `qwen3-coder`, `qwq-32b` + 42 more                     |
| [MiniMax](https://www.minimax.io/)                                             | `minimax-m2.5`, `minimax-m1`, `minimax-m2` + 5 more                  |
| [Kimi (Moonshot)](https://kimi.ai/)                                            | `kimi-k2`, `kimi-k2.5` + 3 more                                      |
| [Amazon Nova](https://aws.amazon.com/ai/nova/)                                 | `nova-pro`, `nova-lite`, `nova-micro` + 5 more                       |
| [Z.ai (Zhipu)](https://z.ai/)                                                  | `glm-5`, `glm-4.7`, `glm-4.5` + 5 more                               |
| [OpenRouter](https://openrouter.ai/)                                           | 300+ models from all providers                                       |
| [Ollama](https://ollama.com/)                                                  | Run any model locally (Llama, Gemma, Mistral, ...)                   |
| Custom providers                                                               | Any provider with an OpenAI-compatible API endpoint                  |

## Contributing

Manifest is open source under the [MIT license](LICENSE). See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, architecture, and workflow. Join the conversation on [Discord](https://discord.gg/FepAked3W7).

## Quick links

- [GitHub](https://github.com/mnfst/manifest)
- [Docs](https://manifest.build/docs)
- [Discord](https://discord.com/invite/FepAked3W7)
- [Discussions](https://github.com/mnfst/manifest/discussions)

## License

[MIT](LICENSE)
