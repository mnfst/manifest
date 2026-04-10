<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-white.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-dark.svg" />
    <img src="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-dark.svg" alt="Manifest" height="53" title="Manifest"/>
  </picture>
</p>
<p align="center">
  <a href="https://github.com/mnfst/manifest/stargazers"><img src="https://img.shields.io/github/stars/mnfst/manifest?style=flat" alt="GitHub stars" /></a>
  &nbsp;
  <a href="https://www.npmjs.com/package/manifest"><img src="https://img.shields.io/npm/v/manifest?color=cb3837&label=npm" alt="npm version" /></a>
  &nbsp;
  <a href="https://github.com/mnfst/manifest/blob/main/LICENSE"><img src="https://img.shields.io/github/license/mnfst/manifest?color=blue" alt="license" /></a>
  &nbsp;
  <a href="https://discord.gg/FepAked3W7"><img src="https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white" alt="Discord" /></a>
</p>

## What is Manifest?

Manifest is a smart model router for OpenClaw. It sits between your agent and your LLM providers, scores each request, and routes it to the cheapest model that can handle it. Simple questions go to fast, cheap models. Hard problems go to expensive ones. You save money without thinking about it.

- Route requests to the right model: Cut costs up to 70%
- Automatic fallbacks: If a model fails, the next one picks up
- Set limits: Don't exceed your budget

![manifest-gh](https://github.com/user-attachments/assets/7dd74fc2-f7d6-4558-a95a-014ed754a125)

## Supported providers

Works with 300+ models across OpenAI, Anthropic, Google Gemini, DeepSeek, xAI, Mistral, Qwen, MiniMax, Kimi, Amazon Nova, OpenRouter, Ollama, and any provider with an OpenAI-compatible API.

## Manifest vs OpenRouter

|              | Manifest                                     | OpenRouter                                          |
| ------------ | -------------------------------------------- | --------------------------------------------------- |
| Architecture | Local. Your requests, your providers         | Cloud proxy. All traffic goes through their servers |
| Cost         | Free                                         | 5% fee on every API call                            |
| Source code  | MIT, fully open                              | Proprietary                                         |
| Data privacy | Metadata only (cloud) or fully local         | Prompts and responses pass through a third party    |
| Transparency | Open scoring. You see why a model was chosen | No visibility into routing decisions                |

---

## Installation

### Option 1: Docker Compose (recommended)

Runs Manifest with a PostgreSQL database. One command.

1. Download the compose file:

```bash
curl -O https://raw.githubusercontent.com/mnfst/manifest/main/docker/docker-compose.yml
```

2. Start it:

```bash
docker compose up -d
```

3. Open [http://localhost:3001](http://localhost:3001) and log in:
   - Email: `admin@manifest.build`
   - Password: `manifest`

Connect a provider on the Routing page and you're set.

To stop:

```bash
docker compose down       # keeps data
docker compose down -v    # deletes everything
```

### Option 2: Docker Run (bring your own PostgreSQL)

If you already have PostgreSQL running:

```bash
docker run -d \
  -p 3001:3001 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/manifest \
  -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  -e BETTER_AUTH_URL=http://localhost:3001 \
  -e NODE_ENV=development \
  -e MANIFEST_TRUST_LAN=true \
  manifestdotbuild/manifest
```

`NODE_ENV=development` makes migrations run on startup. Without it you'd need to run them manually.

### Option 3: Local mode (no database)

For quick testing. Uses SQLite in-memory -- data goes away when the container stops unless you mount a volume.

```bash
docker run -d \
  -p 3001:3001 \
  -e MANIFEST_MODE=local \
  -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  -e MANIFEST_TRUST_LAN=true \
  -v manifest-data:/home/node/.openclaw/manifest \
  manifestdotbuild/manifest
```

Local mode skips the login page. The dashboard is accessible directly.

### Verifying the image signature

Published images are signed with cosign keyless signing (Sigstore). Verify before pulling:

```bash
cosign verify manifestdotbuild/manifest:<version> \
  --certificate-identity-regexp="^https://github.com/mnfst/manifest/" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com"
```

### Custom port

If port 3001 is taken, change both the mapping and `BETTER_AUTH_URL`:

```bash
docker run -d \
  -p 8080:3001 \
  -e BETTER_AUTH_URL=http://localhost:8080 \
  ...
```

Or in docker-compose.yml:

```yaml
ports:
  - "8080:3001"
environment:
  - BETTER_AUTH_URL=http://localhost:8080
```

If you see "Invalid origin" on the login page, `BETTER_AUTH_URL` doesn't match the port you're using.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes (cloud mode) | -- | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | -- | Session signing secret (min 32 chars) |
| `BETTER_AUTH_URL` | No | `http://localhost:3001` | Public URL. Set this when using a custom port |
| `PORT` | No | `3001` | Internal server port |
| `NODE_ENV` | No | `production` | Set `development` for auto-migrations |
| `MANIFEST_MODE` | No | `cloud` | `cloud` (PostgreSQL) or `local` (SQLite) |
| `SEED_DATA` | No | `false` | Seed demo data on startup |
| `MANIFEST_TRUST_LAN` | No | `false` | Trust private network IPs (needed in Docker) |

Full env var reference: [github.com/mnfst/manifest](https://github.com/mnfst/manifest)

## Links

- [GitHub](https://github.com/mnfst/manifest)
- [Website](https://manifest.build)
- [Docs](https://manifest.build/docs)
- [Discord](https://discord.gg/FepAked3W7)

## License

[MIT](https://github.com/mnfst/manifest/blob/main/LICENSE)
