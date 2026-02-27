# Mintlify Documentation Spec

## Overview

Minimalistic user documentation for Manifest, hosted with [Mintlify](https://mintlify.com). Eight pages, each using `<Tabs>` / `<Tab>` components to toggle between **Cloud** (default) and **Local** instructions where the experience differs.

---

## Project Structure

```
docs/
├── mint.json                 # Mintlify config (nav, theme, metadata)
├── introduction.mdx          # What is Manifest
├── install.mdx               # Installation
├── track-usage.mdx           # Tracking tokens, costs, messages
├── set-limits.mdx            # Alerts and hard limits
├── routing.mdx               # LLM router & 4-tier scoring
├── cloud-vs-local.mdx        # Side-by-side comparison
├── configuration.mdx         # All settings reference
├── contributing.mdx          # Dev setup & contribution guide
├── images/
│   ├── logo-dark.svg         # Copy from .github/assets/
│   ├── logo-light.svg        # Copy from .github/assets/
│   └── dashboard.png         # Screenshot of dashboard (to capture)
└── SPEC.md                   # This file
```

---

## mint.json

```jsonc
{
  "$schema": "https://mintlify.com/schema.json",
  "name": "Manifest",
  "logo": {
    "dark": "/images/logo-light.svg",
    "light": "/images/logo-dark.svg"
  },
  "favicon": "/images/favicon.svg",
  "colors": {
    "primary": "#F05A28",       // Manifest orange
    "light": "#FF7A4D",
    "dark": "#D14A1E",
    "anchors": {
      "from": "#F05A28",
      "to": "#FF7A4D"
    }
  },
  "topbarLinks": [
    { "name": "Dashboard", "url": "https://app.manifest.build" }
  ],
  "topbarCtaButton": {
    "name": "GitHub",
    "url": "https://github.com/mnfst/manifest"
  },
  "anchors": [
    {
      "name": "Discord",
      "icon": "discord",
      "url": "https://discord.gg/FepAked3W7"
    }
  ],
  "tabs": [],
  "navigation": [
    {
      "group": "Getting Started",
      "pages": [
        "introduction",
        "install",
        "cloud-vs-local"
      ]
    },
    {
      "group": "Features",
      "pages": [
        "track-usage",
        "set-limits",
        "routing"
      ]
    },
    {
      "group": "Reference",
      "pages": [
        "configuration",
        "contributing"
      ]
    }
  ],
  "footerSocials": {
    "github": "https://github.com/mnfst/manifest",
    "discord": "https://discord.gg/FepAked3W7"
  }
}
```

---

## Page Specs

### 1. introduction.mdx

**Purpose:** Explain what Manifest is and why it exists. First thing a visitor reads.

**Sections:**

1. **Hero / Title**
   - Title: "Manifest"
   - Subtitle: "Take control of your OpenClaw costs"
   - One-liner: Manifest is an open-source OpenClaw plugin that routes queries to the most cost-effective model and gives you a real-time dashboard to track tokens, costs, and usage.

2. **Why Manifest** (3 bullet `<CardGroup>`)
   - **Smart routing** — Scores each query across 23 dimensions and picks the cheapest model that can handle it. Saves up to 90%.
   - **Real-time dashboard** — Track tokens, costs, messages, and model usage at a glance.
   - **Set limits** — Get notified or automatically block requests when spending exceeds a threshold.

3. **How it works** (short paragraph)
   - Manifest intercepts each OpenClaw request, runs a scoring algorithm in <2 ms, assigns a tier (simple / standard / complex / reasoning), and forwards the query to the matching model. All telemetry is captured via OpenTelemetry and displayed in the dashboard.

4. **Manifest vs OpenRouter** (table, reuse from README)

5. **Privacy**
   - Local mode: all data stays on your machine.
   - Cloud mode: only OpenTelemetry metadata (model name, token counts, latency) is sent — never message content.
   - Opt-out of anonymous analytics: `MANIFEST_TELEMETRY_OPTOUT=1`.

6. **Next step** → link to [Install](/install)

**Tabs needed:** No. This page is mode-agnostic.

---

### 2. install.mdx

**Purpose:** Get Manifest running in under a minute.

**Sections:**

1. **Prerequisites**
   - `<Tabs>` Cloud / Local
   - **Cloud tab:** An OpenClaw installation. A Manifest account at [app.manifest.build](https://app.manifest.build).
   - **Local tab:** An OpenClaw installation. Node.js >= 20. No account needed.

2. **Install the plugin**
   - Shared (no tabs):
     ```bash
     openclaw plugins install manifest
     ```

3. **Configure mode**
   - `<Tabs>` Cloud / Local
   - **Cloud tab:**
     1. Sign up at [app.manifest.build](https://app.manifest.build).
     2. Create an agent in the Workspace page.
     3. Copy the generated API key (`mnfst_...`).
     4. Configure:
        ```bash
        openclaw config set plugins.entries.manifest.config.mode cloud
        openclaw config set plugins.entries.manifest.config.apiKey "mnfst_YOUR_KEY"
        ```
   - **Local tab:**
     - No configuration needed. Local mode is the default.
     - Optionally change the dashboard port:
       ```bash
       openclaw config set plugins.entries.manifest.config.port 3000
       ```

4. **Restart the gateway**
   - Shared (no tabs):
     ```bash
     openclaw gateway restart
     ```

5. **Verify**
   - `<Tabs>` Cloud / Local
   - **Cloud tab:** Open [app.manifest.build](https://app.manifest.build). Send a message to any agent — it should appear in the dashboard within 30 seconds.
   - **Local tab:** Open [http://127.0.0.1:2099](http://127.0.0.1:2099). Send a message to any agent — it should appear in the dashboard within 10 seconds.

**Callout:** `<Info>` The gateway batches telemetry every 10-30 s. New messages may take a moment to appear.

---

### 3. track-usage.mdx

**Purpose:** Explain the dashboard and what data is tracked.

**Sections:**

1. **Overview dashboard**
   - What it shows: total messages, total tokens (input / output / cache), total cost, messages over time chart, cost over time chart, model distribution.
   - Screenshot placeholder.

2. **Metrics captured**
   - Table: metric name → description
     - `Messages` — number of LLM calls
     - `Input tokens` — prompt tokens sent
     - `Output tokens` — completion tokens received
     - `Cache read tokens` — tokens served from cache
     - `Cost (USD)` — calculated from model pricing × tokens
     - `Duration (ms)` — round-trip latency
     - `Model` — which LLM handled the request
     - `Routing tier` — simple / standard / complex / reasoning
     - `Agent name` — the OpenClaw agent that sent the request

3. **How cost is calculated**
   - Manifest maintains a pricing table for 40+ models (Anthropic, OpenAI, Google, DeepSeek, etc.).
   - Cost = `input_tokens × input_price + output_tokens × output_price`.
   - Pricing is refreshed automatically in the background (local mode syncs from OpenRouter).

4. **Message log**
   - Paginated list of every LLM call with full metadata.
   - Filterable by agent, model, time range.

5. **Data storage**
   - `<Tabs>` Cloud / Local
   - **Cloud tab:** PostgreSQL hosted at app.manifest.build. Data persists across devices. Accessible from any browser.
   - **Local tab:** SQLite file at `~/.openclaw/manifest/manifest.db`. Data stays on your machine. Dashboard only accessible from localhost.

---

### 4. set-limits.mdx

**Purpose:** Explain notification rules and hard limits.

**Sections:**

1. **What are limits?**
   - Two types of rules you can set per agent:
     - **Notify** — sends an email alert when a threshold is reached.
     - **Block** — returns HTTP 429 and stops requests when the threshold is reached.

2. **Creating a rule**
   - `<Tabs>` Cloud / Local
   - **Cloud tab:**
     1. Open your agent's Settings page in the dashboard.
     2. Under "Notification Rules", click "Add Rule".
     3. Pick metric (tokens or cost), period (hour / day / week / month), threshold, and action (notify or block).
     4. Save. The rule takes effect immediately.
   - **Local tab:**
     1. Open [http://127.0.0.1:2099](http://127.0.0.1:2099) and navigate to your agent's settings.
     2. Same UI — add a rule with metric, period, threshold, and action.
     3. Save. The rule takes effect immediately.

3. **How blocking works**
   - When a "block" rule triggers, the next ingest request returns `429 Too Many Requests` with a message: `"Limit exceeded: cost usage ($X) exceeds $Y per day"`.
   - The block resets at the start of the next period.

4. **Email notifications**
   - `<Tabs>` Cloud / Local
   - **Cloud tab:** Emails are sent via the platform's mail provider. Make sure your account email is valid.
   - **Local tab:** Configure an email provider in `~/.openclaw/manifest/config.json`:
     ```json
     {
       "email": {
         "provider": "mailgun",
         "apiKey": "key-...",
         "domain": "mg.example.com",
         "from": "alerts@example.com"
       }
     }
     ```
     Supported providers: Mailgun, Resend, SendGrid. If no provider is configured, email notifications are skipped (block rules still work).

5. **Checking rules**
   - Rules are evaluated hourly (cron) for notifications, and on every ingest for blocks.
   - A notification is sent once per rule per period to avoid spam.

---

### 5. routing.mdx

**Purpose:** Explain the LLM router — the core value proposition.

**Sections:**

1. **What is routing?**
   - Instead of sending every request to the same expensive model, Manifest scores each query and routes it to the cheapest model that can handle it.
   - Four tiers: **simple**, **standard**, **complex**, **reasoning**.
   - Scoring happens in under 2 ms with zero external calls.

2. **The four tiers** (`<CardGroup>` with 4 cards)
   - **Simple** — Greetings, definitions, short factual questions. Routed to the cheapest model.
   - **Standard** — General coding help, moderate questions. Good quality at low cost.
   - **Complex** — Multi-step tasks, large context, code generation. Best quality models.
   - **Reasoning** — Formal logic, proofs, math, multi-constraint problems. Reasoning-capable models only.

3. **How scoring works**
   - 23 dimensions grouped into two categories:
     - **Keyword-based** (13) — Scans the prompt for patterns like "prove", "write function", "what is", etc.
     - **Structural** (10) — Analyzes token count, nesting depth, code-to-prose ratio, tool count, conversation depth, etc.
   - Each dimension has a weight. The weighted sum maps to a tier via threshold boundaries.
   - Confidence score (0–1) indicates how clearly the request fits its tier.

4. **Session momentum**
   - Manifest remembers the last 5 tier assignments (30-min TTL).
   - Short follow-up messages ("yes", "do it") inherit momentum from the conversation, preventing unnecessary tier drops.

5. **Tier overrides**
   - Certain signals force a minimum tier:
     - Tools detected → at least **standard**.
     - Large context (>50k tokens) → at least **complex**.
     - Formal logic keywords → **reasoning**.

6. **Response headers**
   - Every routed response includes:
     - `X-Manifest-Tier` — assigned tier
     - `X-Manifest-Model` — actual model used
     - `X-Manifest-Provider` — provider (anthropic, openai, google, etc.)
     - `X-Manifest-Confidence` — scoring confidence (0–1)

7. **Cloud vs Local**
   - `<Tabs>` Cloud / Local
   - **Cloud tab:** Routing is performed server-side. Model mappings are managed by the Manifest team and updated regularly.
   - **Local tab:** Routing runs on your machine inside the embedded server. The model-to-tier mapping is seeded on first boot and can be customized in the dashboard.

---

### 6. cloud-vs-local.mdx

**Purpose:** Help users choose the right mode. Side-by-side comparison.

**Sections:**

1. **Intro paragraph**
   - Manifest runs in two modes: **Cloud** (hosted at app.manifest.build) and **Local** (embedded on your machine). Both share the same features — the difference is where data lives and how auth works.

2. **Comparison table**

   | | Cloud | Local |
   |---|---|---|
   | **Setup** | Sign up + API key | Zero config |
   | **Data storage** | PostgreSQL (hosted) | SQLite on your machine |
   | **Dashboard** | app.manifest.build | http://127.0.0.1:2099 |
   | **Auth** | Email/password or OAuth (Google, GitHub, Discord) | Auto-login (loopback trust) |
   | **Multi-device** | Yes — access from any browser | No — localhost only |
   | **API key** | Generated in dashboard (`mnfst_...`) | Auto-generated (`mnfst_local_...`) |
   | **Email alerts** | Built-in (platform mail) | Requires provider config (Mailgun/Resend/SendGrid) |
   | **Telemetry interval** | ~30 seconds | ~10 seconds |
   | **Privacy** | Metadata only (no message content) | 100% on your machine |
   | **Cost** | Free | Free |

3. **When to use Cloud**
   - You work across multiple machines.
   - You want email alerts without configuring a mail provider.
   - You want a managed experience with no local server.

4. **When to use Local**
   - Privacy is paramount — no data leaves your machine.
   - You don't need multi-device access.
   - You prefer zero-config, offline-capable tooling.

5. **Switching modes**
   ```bash
   # Switch to cloud
   openclaw config set plugins.entries.manifest.config.mode cloud
   openclaw config set plugins.entries.manifest.config.apiKey "mnfst_YOUR_KEY"
   openclaw gateway restart

   # Switch to local
   openclaw config set plugins.entries.manifest.config.mode local
   openclaw gateway restart
   ```
   `<Warning>` Switching modes does not migrate data. Cloud and local have separate databases.

---

### 7. configuration.mdx

**Purpose:** Reference page for all settings.

**Sections:**

1. **Plugin settings**
   - These are set via `openclaw config set plugins.entries.manifest.config.<key> <value>`.
   - Table:

     | Setting | Type | Default | Description |
     |---------|------|---------|-------------|
     | `mode` | `string` | `local` | `local`, `cloud`, or `dev` |
     | `apiKey` | `string` | — | OTLP key (`mnfst_...`). Required for cloud. Auto-generated for local. |
     | `endpoint` | `string` | `https://app.manifest.build/otlp` | OTLP endpoint. Only used in cloud/dev. |
     | `port` | `number` | `2099` | Dashboard port (local only). |
     | `host` | `string` | `127.0.0.1` | Bind address (local only). |

2. **Environment variables** (for self-hosting / contributing)
   - `<Tabs>` Cloud / Local
   - **Cloud tab:** Full table of env vars from CLAUDE.md (`BETTER_AUTH_SECRET`, `DATABASE_URL`, `PORT`, `BIND_ADDRESS`, `NODE_ENV`, `CORS_ORIGIN`, `API_KEY`, `THROTTLE_TTL`, `THROTTLE_LIMIT`, `MAILGUN_*`, OAuth `*_CLIENT_ID/*_CLIENT_SECRET`, `SEED_DATA`).
   - **Local tab:** No env vars needed. Local mode runs with zero configuration. If self-hosting the backend in local mode, set `MANIFEST_MODE=local`.

3. **Config file locations**
   - `<Tabs>` Cloud / Local
   - **Cloud tab:** All config via env vars or the dashboard UI. No local config files.
   - **Local tab:**
     - `~/.openclaw/manifest/config.json` — API key, auth secret, email provider config.
     - `~/.openclaw/manifest/manifest.db` — SQLite database.
     - `~/.openclaw/openclaw.json` — OpenClaw master config (provider injection).

4. **Opt-out of analytics**
   ```bash
   MANIFEST_TELEMETRY_OPTOUT=1
   ```
   Or add `"telemetryOptOut": true` to `~/.openclaw/manifest/config.json`.

5. **Rate limiting**
   - Default: 100 requests per 60-second window.
   - Configurable via `THROTTLE_TTL` (ms) and `THROTTLE_LIMIT` (count) env vars (self-hosted only).

---

### 8. contributing.mdx

**Purpose:** Get contributors up and running.

**Sections:**

1. **Tech stack** (short table: Frontend → SolidJS, Backend → NestJS, DB → sql.js / PostgreSQL, Auth → Better Auth, Build → Turborepo)

2. **Prerequisites**
   - Node.js 22.x, npm 10.x.

3. **Dev setup**
   - `<Tabs>` Cloud / Local
   - **Cloud tab:**
     1. Clone and install.
     2. Start PostgreSQL: `docker run -d --name postgres_db -e POSTGRES_USER=myuser -e POSTGRES_PASSWORD=mypassword -e POSTGRES_DB=mydatabase -p 5432:5432 postgres:16`
     3. Copy `.env.example` → `.env`, fill in `BETTER_AUTH_SECRET`, `DATABASE_URL`, `SEED_DATA=true`.
     4. Start backend: `cd packages/backend && NODE_OPTIONS='-r dotenv/config' npx nest start --watch`
     5. Start frontend: `cd packages/frontend && npx vite`
     6. Login: `admin@manifest.build` / `manifest`.
   - **Local tab:**
     1. Clone and install.
     2. Build: `npm run build`
     3. Run: `MANIFEST_MODE=local node packages/backend/dist/main.js`
     4. Open `http://127.0.0.1:3001`. No login needed.

4. **Running tests**
   ```bash
   npm test --workspace=packages/backend          # Jest unit
   npm run test:e2e --workspace=packages/backend  # Jest e2e
   npm test --workspace=packages/frontend         # Vitest
   ```

5. **Database migrations** (cloud mode only)
   ```bash
   cd packages/backend
   npm run migration:generate -- src/database/migrations/DescriptiveName
   npm run migration:run
   ```
   Local mode uses `synchronize: true` — no migrations needed.

6. **Changesets**
   - Every PR needs a changeset. Backend/frontend changes need a `manifest` changeset.
   - `npx changeset` to add one. `npx changeset add --empty` for docs/CI-only changes.

7. **Links**
   - [GitHub Issues](https://github.com/mnfst/manifest/issues)
   - [Discord](https://discord.gg/FepAked3W7)
   - [Code of Conduct](https://github.com/mnfst/manifest/blob/main/CODE_OF_CONDUCT.md)

---

## Design Guidelines

### Tabs Convention

Use Mintlify's `<Tabs>` component whenever the Cloud and Local experience differs:

```mdx
<Tabs>
  <Tab title="Cloud">
    Cloud-specific content here.
  </Tab>
  <Tab title="Local">
    Local-specific content here.
  </Tab>
</Tabs>
```

Cloud is always the **first tab** (default visible). If a section is identical for both modes, do not use tabs — write it once.

### Tone

- Short sentences. No filler.
- Second person ("you", "your").
- Present tense.
- Code blocks for every command — readers should be able to copy-paste.

### Components to Use

| Component | When |
|-----------|------|
| `<Tabs>` / `<Tab>` | Cloud vs Local divergence |
| `<CardGroup>` / `<Card>` | Feature highlights (intro, tier cards) |
| `<Info>` | Helpful tips |
| `<Warning>` | Destructive or irreversible actions |
| `<CodeGroup>` | Multiple related code snippets |
| `<Steps>` | Sequential instructions |
| `<Accordion>` | Optional detail (e.g., full env var list) |

### Images

- Place all images in `docs/images/`.
- Use dark-mode-friendly screenshots where possible.
- Keep image count minimal — this is a developer tool, not a marketing site.

---

## Implementation Checklist

- [ ] Create `docs/` directory with all `.mdx` files
- [ ] Create `mint.json` with nav, theme, metadata
- [ ] Copy logo SVGs from `.github/assets/` to `docs/images/`
- [ ] Capture 1-2 dashboard screenshots for `track-usage.mdx`
- [ ] Write all 8 pages following the section specs above
- [ ] Test locally with `mintlify dev`
- [ ] Deploy to Mintlify (connect GitHub repo or `mintlify deploy`)
