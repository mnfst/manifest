<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-white.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-dark.svg" />
    <img src="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-dark.svg" alt="Manifest" height="53" title="Manifest"/>
  </picture>
</p>
<p align="center">
Plug your AI agents into any provider
</p>

![manifest-gh](https://github.com/user-attachments/assets/7dd74fc2-f7d6-4558-a95a-014ed754a125)

<p align="center">
  <a href="https://render.com/deploy?repo=https://github.com/mnfst/manifest" target="_blank" rel="nofollow"><img src="https://img.shields.io/badge/Deploy%20on-Render-46E3B7?style=for-the-badge&amp;logo=render&amp;logoColor=white" alt="Deploy on Render" /></a>
  <a href="https://railway.com/deploy/wild-wild" target="_blank" rel="nofollow"><img src="https://img.shields.io/badge/Deploy%20on-Railway-0B0D0E?style=for-the-badge&amp;logo=railway&amp;logoColor=white" alt="Deploy on Railway" /></a>
  <a href="https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/quickcreate?stackName=manifest&amp;templateURL=https%3A%2F%2Fmnfst-manifest-deploy-templates.s3.us-east-1.amazonaws.com%2Fmanifest.yaml" target="_blank" rel="nofollow"><img src="https://img.shields.io/badge/Deploy%20on-AWS-232F3E?style=for-the-badge&amp;logo=amazonwebservices&amp;logoColor=white" alt="Deploy on AWS" /></a>
  <a href="https://ssh.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https%3A%2F%2Fgithub.com%2Fmnfst%2Fmanifest&amp;cloudshell_workspace=deploy%2Fgcp&amp;cloudshell_tutorial=TUTORIAL.md&amp;cloudshell_image=gcr.io/ds-artifacts-cloudshell/deploystack_custom_image&amp;shellonly=true" target="_blank" rel="nofollow"><img src="https://img.shields.io/badge/Deploy%20on-GCP-4285F4?style=for-the-badge&amp;logo=googlecloud&amp;logoColor=white" alt="Deploy on GCP" /></a>
</p>

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

Manifest is a smart model router for AI agents and apps. Connect your API keys, subscriptions, and local models to one OpenAI-compatible endpoint, and each query goes to the right model. No single-provider lock-in.

- 🔀 Routing based on complexity, specificity and custom HTTP headers
- 🎛️ Mix your providers: API keys, Subscriptions, Local models, Custom providers
- 📊 Track every single dollar, setup notifications and limits
- 🚑 Fallback on different models when queries fails

## Quick start

### Cloud version

Go to [app.manifest.build](https://app.manifest.build) and follow the guide.

### Self-hosted

Manifest ships as a [Docker image](https://hub.docker.com/r/manifestdotbuild/manifest). One command:

```bash
bash <(curl -sSL https://raw.githubusercontent.com/mnfst/manifest/main/docker/install.sh)
```

Open [http://localhost:2099](http://localhost:2099) and sign up — the first account you create becomes the admin. Full self-hosting guide: [docker/DOCKER_README.md](docker/DOCKER_README.md).

Managed deployment options:

| Platform | What it provisions |
| --- | --- |
| [Railway](https://railway.com/deploy/wild-wild) | Manifest plus PostgreSQL from the public Railway template. |
| [Render](https://render.com/deploy?repo=https://github.com/mnfst/manifest) | Manifest web service plus Render PostgreSQL from [render.yaml](render.yaml). |
| [AWS](deploy/aws/TUTORIAL.md) | ECS Fargate, Application Load Balancer, RDS PostgreSQL, and Secrets Manager via CloudFormation. |
| [GCP](deploy/gcp/TUTORIAL.md) | Cloud Run, Cloud SQL for PostgreSQL, and Secret Manager via the Cloud Shell tutorial. |

> The legacy `manifest` npm package is deprecated and no longer published.

## Providers

Manifest connects to **300+ models across 18 providers** plus any custom provider (OpenAI/Anthropic compatible). Bring your own API key, reuse a paid subscription you already have, or run models locally — all routed through
the same `/auto` endpoint.

| Provider                                                                                 | API key  | Subscription                 | Featured models                                         |
| ---------------------------------------------------------------------------------------- | :------: | :--------------------------- | :------------------------------------------------------ |
| [**OpenAI**](https://platform.openai.com/)                                               |    ✅    | ✅ ChatGPT Plus / Pro / Team | gpt-5, gpt-5-mini, o4, o4-mini                          |
| [**Anthropic**](https://www.anthropic.com/)                                              |    ✅    | ✅ Claude Max / Pro          | claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5    |
| [**Google**](https://ai.google.dev/)                                                     |    ✅    | —                            | gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash      |
| [**xAI**](https://x.ai/)                                                                 |    ✅    | —                            | grok-4, grok-3, grok-code-fast                          |
| [**DeepSeek**](https://www.deepseek.com/)                                                |    ✅    | —                            | deepseek-v3.2, deepseek-r1                              |
| [**Mistral**](https://mistral.ai/)                                                       |    ✅    | —                            | mistral-large, codestral, magistral                     |
| [**Qwen** (Alibaba Cloud)](https://www.alibabacloud.com/en/solutions/generative-ai/qwen) |    ✅    | —                            | qwen3-max, qwen3-coder, qwq-32b                         |
| [**Moonshot** (Kimi)](https://kimi.ai/)                                                  |    ✅    | ✅ Kimi Coding Plan          | kimi-k2, kimi-for-coding, moonshot-v1-128k              |
| [**MiniMax**](https://www.minimax.io/)                                                   |    ✅    | ✅ MiniMax Coding Plan       | minimax-m2, abab7-chat-preview                          |
| [**Xiaomi MiMo**](https://platform.xiaomimimo.com/)                                      |    ✅    | ✅ MiMo Token Plan           | mimo-v2.5-pro, mimo-v2.5, mimo-v2-flash                 |
| [**Z.ai** (Zhipu)](https://z.ai/)                                                        |    ✅    | ✅ GLM Coding Plan           | glm-4.6, glm-4.5-air                                    |
| [**BytePlus**](https://www.byteplus.com/en/activity/codingplan)                          |    —     | ✅ ModelArk Coding Plan      | ark-code-latest, bytedance-seed-code, deepseek-v4-flash |
| [**OpenCode**](https://opencode.ai/)                                                     |    —     | ✅ Go subscription           | Routes via OpenCode Go catalog                          |
| [**Ollama**](https://ollama.com/)                                                        | 🖥️ Local | ✅ Ollama Cloud              | Any GGUF model, port `11434`                            |
| [**LM Studio**](https://lmstudio.ai/)                                                    | 🖥️ Local | —                            | Any GGUF model, port `1234`                             |
| [**llama.cpp**](https://github.com/ggml-org/llama.cpp)                                   | 🖥️ Local | —                            | Any GGUF model, port `8080`                             |
| [**OpenRouter**](https://openrouter.ai/)                                                 |    ✅    | —                            | Routes to 300+ models across labs                       |
| [**GitHub Copilot**](https://github.com/features/copilot)                                |    —     | ✅ Copilot subscription      | OAuth, no API key needed                                |
| **Custom** (OpenAI/Anthropic-compatible)                                                 |    ✅    | —                            | Any `/v1/chat/completions` or `/v1/messages` endpoint   |

## Quick links

- [Docs](https://manifest.build/docs)
- [Discord](https://discord.com/invite/FepAked3W7)
- [Discussions](https://github.com/mnfst/manifest/discussions)
- [Contributing](CONTRIBUTING.md)
- [GitHub](https://github.com/mnfst/manifest)

## License

[MIT](LICENSE)
