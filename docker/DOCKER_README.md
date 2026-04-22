<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-white.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-dark.svg" />
    <img src="https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/logo-dark.svg" alt="Manifest" height="53" title="Manifest"/>
  </picture>
</p>
<p align="center">
  <a href="https://hub.docker.com/r/manifestdotbuild/manifest"><img src="https://img.shields.io/docker/pulls/manifestdotbuild/manifest?color=2496ED&label=docker%20pulls" alt="Docker pulls" /></a>
  &nbsp;
  <a href="https://github.com/mnfst/manifest/stargazers"><img src="https://img.shields.io/github/stars/mnfst/manifest?style=flat" alt="GitHub stars" /></a>
  &nbsp;
  <a href="https://github.com/mnfst/manifest/blob/main/LICENSE"><img src="https://img.shields.io/github/license/mnfst/manifest?color=blue" alt="license" /></a>
  &nbsp;
  <a href="https://discord.gg/FepAked3W7"><img src="https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white" alt="Discord" /></a>
</p>

## What is Manifest?

Manifest is a smart model router for **personal AI agents** like OpenClaw, Hermes, or anything speaking the OpenAI-compatible HTTP API. It sits between your agent and your LLM providers, scores each request, and routes it to the cheapest model that can handle it. Simple questions go to fast, cheap models. Hard problems go to expensive ones. You save money without thinking about it.

- Route requests to the right model: cut costs up to 70%
- Automatic fallbacks: if a model fails, the next one picks up
- Set limits: don't exceed your budget
- Self-hosted: your requests, your providers, your data

![manifest-gh](https://raw.githubusercontent.com/mnfst/manifest/HEAD/.github/assets/manifest-screenshot.png)

## Table of contents

- [Supported providers](#supported-providers)
- [Manifest vs OpenRouter](#manifest-vs-openrouter)
- [Installation](#installation)
  - [Option 1: Quickstart install script (recommended)](#option-1-quickstart-install-script-recommended)
  - [Option 2: Docker Compose (manual)](#option-2-docker-compose-manual)
  - [Option 3: Docker Run (bring your own PostgreSQL)](#option-3-docker-run-bring-your-own-postgresql)
  - [Verifying the image signature](#verifying-the-image-signature)
  - [Custom port](#custom-port)
- [Image tags](#image-tags)
- [Upgrading](#upgrading)
- [Backup & persistence](#backup--persistence)
- [Connecting local LLM servers](#connecting-local-llm-servers)
- [Environment variables](#environment-variables)
- [Links](#links)

## Supported providers

Works with 300+ models across OpenAI, Anthropic, Google Gemini, DeepSeek, xAI, Mistral, Qwen, MiniMax, Kimi, Amazon Nova, Z.ai, OpenRouter, Ollama, and any provider with an OpenAI-compatible API. Connect with an API key, or reuse an existing paid subscription (ChatGPT Plus/Pro, Claude Max/Pro, GLM Coding Plan, etc.) where supported.

## Manifest vs OpenRouter

|              | Manifest                                          | OpenRouter                                          |
| ------------ | ------------------------------------------------- | --------------------------------------------------- |
| Architecture | Your Manifest instance forwards to your providers | Cloud proxy. All traffic goes through their servers |
| Cost         | Free                                              | 5% fee on every API call                            |
| Source code  | MIT, fully open                                   | Proprietary                                         |
| Data privacy | Self-hosted, no middleman                         | Prompts and responses pass through a third party    |
| Transparency | Open scoring. You see why a model was chosen      | No visibility into routing decisions                |

---

## Installation

Three paths, ordered from fastest to most hands-on. All three end in the same place: a running stack at [http://localhost:2099](http://localhost:2099) where you sign up. The first account you create becomes the admin. No demo credentials are pre-seeded.

> **Heads up on network binding.** The bundled compose file binds port 2099 to `127.0.0.1` only, so the dashboard is reachable on the host machine but not over the LAN. See [Custom port](#custom-port) to expose it beyond localhost.

### Option 1: Quickstart install script (recommended)

One command. The installer downloads the compose file, generates a secret, and brings up the stack. Give it about 30 seconds to boot.

```bash
bash <(curl -sSL https://raw.githubusercontent.com/mnfst/manifest/main/docker/install.sh)
```

<details>
<summary><strong>Prefer to review the script before running it?</strong></summary>

Download the script:

```bash
curl -sSLO https://raw.githubusercontent.com/mnfst/manifest/main/docker/install.sh
```

Review it (optional):

```bash
less install.sh
```

Run it:

```bash
bash install.sh
```

</details>

Useful flags: `--dir <path>` to install elsewhere, `--dry-run` to preview, `--yes` to skip the confirmation prompt.

### Option 2: Docker Compose (manual)

Same underlying flow as the install script, but you drive it yourself so you can edit the config before booting the stack.

1. Download the compose file and the env template into the same directory:

```bash
curl -O https://raw.githubusercontent.com/mnfst/manifest/main/docker/docker-compose.yml
curl -O https://raw.githubusercontent.com/mnfst/manifest/main/docker/.env.example
cp .env.example .env
```

2. Open `.env` in your editor and set `BETTER_AUTH_SECRET` to a random string. You can generate one with:

```bash
openssl rand -hex 32
```

(Optional: to use a stronger database password, set BOTH `POSTGRES_PASSWORD` and `DATABASE_URL` in `.env`, they must agree, and any special characters in the password need to be percent-encoded in the URL.)

3. Start the stack:

```bash
docker compose up -d
```

Give it about 30 seconds to boot.

4. Open [http://localhost:2099](http://localhost:2099) and sign up. The first account you create becomes the admin.

To stop:

```bash
docker compose down       # keeps data
docker compose down -v    # deletes everything
```

### Option 3: Docker Run (bring your own PostgreSQL)

If you already have PostgreSQL running, replace `user`, `pass`, and `host` with your actual database credentials, then run this in your terminal:

<details open>
<summary><strong>macOS / Linux (bash, zsh)</strong></summary>

```bash
docker run -d \
  -p 2099:2099 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/manifest \
  -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  -e BETTER_AUTH_URL=http://localhost:2099 \
  manifestdotbuild/manifest
```

</details>

<details>
<summary><strong>Windows (PowerShell)</strong></summary>

```powershell
$secret = -join ((48..57 + 97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ })

docker run -d `
  -p 2099:2099 `
  -e DATABASE_URL=postgresql://user:pass@host:5432/manifest `
  -e BETTER_AUTH_SECRET=$secret `
  -e BETTER_AUTH_URL=http://localhost:2099 `
  manifestdotbuild/manifest
```

</details>

<details>
<summary><strong>Windows (CMD)</strong></summary>

Generate a 64-character hex secret with any tool you trust, then:

```cmd
docker run -d ^
  -p 2099:2099 ^
  -e DATABASE_URL=postgresql://user:pass@host:5432/manifest ^
  -e BETTER_AUTH_SECRET=<your-64-char-secret> ^
  -e BETTER_AUTH_URL=http://localhost:2099 ^
  manifestdotbuild/manifest
```

</details>

TypeORM migrations run automatically on every boot — fresh installs come up with the schema in place. Then visit [http://localhost:2099](http://localhost:2099) and complete the setup wizard to create your admin account.

### Verifying the image signature

Published images are signed with cosign keyless signing (Sigstore). Verify before pulling:

```bash
cosign verify manifestdotbuild/manifest:<version> \
  --certificate-identity-regexp="^https://github.com/mnfst/manifest/" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com"
```

### Custom port

If port 2099 is taken, change both the mapping and `BETTER_AUTH_URL`:

```bash
docker run -d \
  -p 8080:2099 \
  -e BETTER_AUTH_URL=http://localhost:8080 \
  ...
```

Or in docker-compose.yml:

```yaml
ports:
  - '127.0.0.1:8080:2099'
```

…and in `.env`:

```env
BETTER_AUTH_URL=http://localhost:8080
```

### Exposing on the LAN

By default the compose file binds port `2099` to `127.0.0.1` only. The dashboard is reachable from the host but not from other machines on the network. To expose it on the LAN:

1. Edit `docker-compose.yml` and change the `ports` line from `"127.0.0.1:2099:2099"` to `"2099:2099"`.
2. In `.env`, set `BETTER_AUTH_URL` to the host you'll reach the dashboard on, e.g. `http://192.168.1.20:2099` or `https://manifest.mydomain.com`. This MUST match the URL in the browser or Better Auth will reject the login with "Invalid origin".
3. `docker compose up -d` to apply.

If you see "Invalid origin" on the login page, `BETTER_AUTH_URL` doesn't match the URL you're accessing the dashboard on. The host matters as much as the port.

If the dashboard loads as a **blank page on a LAN IP on an older image**, pull the latest image (`docker compose pull && docker compose up -d`). Older builds emitted an `upgrade-insecure-requests` CSP directive that made browsers rewrite `/assets/*.js` to HTTPS on private-IP hosts (10.x / 172.16-31.x / 192.168.x), which the server doesn't serve — the JS bundle failed to load and the page never mounted. This directive has been removed.

## Image tags

Every release is published with the following tags:

- `{major}.{minor}.{patch}` - fully pinned (e.g. `5.46.0`)
- `{major}.{minor}` - latest patch within a minor (e.g. `5.46`)
- `{major}` - latest minor+patch within a major (e.g. `5`)
- `latest` - latest stable release
- `sha-<short>` - exact commit for rollback

Images are built for both `linux/amd64` and `linux/arm64`.

## Upgrading

Manifest ships a new image on every release. To upgrade an existing compose install:

```bash
docker compose pull
docker compose up -d
```

Database migrations run automatically on boot, no manual steps. Your data in the `pgdata` volume is preserved across upgrades. Pin to a specific major version (e.g. `manifestdotbuild/manifest:5`) in `docker-compose.yml` if you want control over when major upgrades happen.

## Backup & persistence

All state lives in the `pgdata` named volume mounted at `/var/lib/postgresql/data` in the `postgres` service. Nothing else in the Manifest container is stateful.

**Back up** (from the host, with the stack running):

```bash
docker compose exec -T postgres pg_dump -U manifest manifest > manifest-backup-$(date +%F).sql
```

**Restore** into a fresh stack:

```bash
docker compose up -d postgres
cat manifest-backup-2026-04-12.sql | docker compose exec -T postgres psql -U manifest manifest
docker compose up -d
```

To list / remove the volume manually:

```bash
docker volume ls | grep pgdata
docker compose down -v    # ⚠  destroys all data
```

## Connecting local LLM servers

The self-hosted Manifest container can reach any OpenAI-compatible server running on your host via `host.docker.internal:<port>`. This works on Docker Desktop (macOS/Windows) out of the box, and on Linux with Docker Engine 20.10 or later.

Because the container detects self-hosted mode automatically (via `/.dockerenv`), it lets you add custom providers with `http://` and private/loopback URLs — cloud-metadata endpoints (169.254.169.254, etc.) stay blocked.

### Ollama (built-in tile)

1. Install Ollama from [ollama.com](https://ollama.com) and pull a model:

```bash
ollama pull llama3.1:8b
```

2. In the dashboard, go to Providers → API Keys → click the **Ollama** tile.
3. Manifest reaches Ollama at `http://host.docker.internal:11434` and syncs the available models.

### vLLM, LM Studio, llama.cpp, text-generation-webui — anything OpenAI-compatible

1. Start your server on the host. **Bind to `0.0.0.0`**, not `127.0.0.1`, so the Manifest container can reach it:
   - vLLM: `vllm serve <model> --host 0.0.0.0 --port 8000`
   - LM Studio: enable the local server on port 1234
   - llama.cpp: `./server -m model.gguf --host 0.0.0.0 --port 8080`
2. Providers → API Keys → **Add custom provider** → pick a preset chip, or type the URL (e.g. `http://host.docker.internal:8000/v1`).
3. Click **Fetch models** to auto-populate the model list from the server's `/v1/models` endpoint.

### Running Ollama on another machine

If Ollama runs on a different host on your LAN, set `OLLAMA_HOST` in `.env` to the full URL (e.g. `http://192.168.1.20:11434`) and restart the stack. Private IPs are allowed in the self-hosted version.

## Environment variables

| Variable             | Required | Default                 | Description                                   |
| -------------------- | -------- | ----------------------- | --------------------------------------------- |
| `DATABASE_URL`       | Yes      | --                      | PostgreSQL connection string                  |
| `BETTER_AUTH_SECRET` | Yes      | --                      | Session signing secret (min 32 chars)         |
| `BETTER_AUTH_URL`    | No       | `http://localhost:2099` | Public URL. Set this when using a custom port |
| `PORT`               | No       | `2099`                  | Internal server port                          |
| `NODE_ENV`           | No       | `production`            | Runtime mode. Leave as `production` for Docker |
| `SEED_DATA`          | No       | `false`                 | Seed demo data on startup                     |
| `OLLAMA_HOST`        | No       | `http://host.docker.internal:11434` | Ollama endpoint for the built-in tile. Override to point at a LAN-hosted Ollama. |
| `MANIFEST_MODE`      | No       | auto (Docker → selfhosted) | `selfhosted` or `cloud`. `local` is a legacy alias. Self-hosted mode allows private/http URLs for custom providers. |
| `MANIFEST_TELEMETRY_DISABLED` | No | `0`               | Set `1` to disable anonymous usage telemetry  |

Full env var reference: [github.com/mnfst/manifest](https://github.com/mnfst/manifest)

## Anonymous usage telemetry

Manifest sends a small anonymous usage report once per 24h so the maintainers
can see how the project is being used. Aggregates only — no prompts, no
message contents, no API keys, nothing that identifies a user. The report is
a random install UUID (generated once, no PII), the Manifest version, and
aggregate counters grouped by provider, routing tier, auth type, agent
platform, OS, and arch.

To disable, set `MANIFEST_TELEMETRY_DISABLED=1` in your `.env` file and
restart the container. The full field list is published at
[manifest.build/docs/self-hosted#telemetry](https://manifest.build/docs/self-hosted#telemetry).

## Links

- [GitHub](https://github.com/mnfst/manifest)
- [Website](https://manifest.build)
- [Docs](https://manifest.build/docs)
- [Discord](https://discord.gg/FepAked3W7)

## License

[MIT](https://github.com/mnfst/manifest/blob/main/LICENSE)
