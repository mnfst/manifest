---
name: manifest
description: Install and configure the Manifest observability plugin for OpenClaw agents. Use when the user wants to set up Manifest telemetry, connect an agent to Manifest, configure an API key or endpoint, troubleshoot plugin connection issues, or check if the Manifest plugin is running.
metadata: {"openclaw":{"requires":{"bins":["openclaw"]}}}
---

# Manifest Setup

Follow these steps **in order**. Do not skip ahead.

## Step 1 — Stop the gateway

Stop the gateway first to avoid hot-reload issues during configuration.

Show the user the command below and ask for confirmation before running it.

```bash
openclaw gateway stop
```

## Step 2 — Install the plugin

Show the user the command below and ask for confirmation before running it.

```bash
openclaw plugins install manifest
```

If it fails, check that OpenClaw is installed and the CLI is available in the PATH.

## Step 3 — Get an API key

Ask the user:

> To connect your agent, you need a Manifest API key. Here's how to get one:
>
> 1. Go to **https://app.manifest.build** and create an account (or sign in)
> 2. Once logged in, click **"Connect Agent"** to create a new agent
> 3. Copy the API key that starts with `mnfst_`
> 4. Paste it here

Wait for a key starting with `mnfst_`. If the key doesn't match, tell the user the format looks incorrect and ask them to try again.

> **Note:** Your API key will be stored in `~/.openclaw/openclaw.json` under `plugins.entries.manifest.config.apiKey`. It persists on disk until you remove it.

## Step 4 — Configure the plugin

Show the user the command below and ask for confirmation before running it.

```bash
openclaw config set plugins.entries.manifest.config.apiKey "USER_API_KEY"
```

Replace `USER_API_KEY` with the actual key the user provided.

Ask the user if they have a custom endpoint. If not, the default (`https://app.manifest.build/api/v1/otlp`) is used automatically. If they do:

Show the user the command below and ask for confirmation before running it.

```bash
openclaw config set plugins.entries.manifest.config.endpoint "USER_ENDPOINT"
```

## Step 5 — Start the gateway

Show the user the command below and ask for confirmation before running it.

```bash
openclaw gateway restart
```

## Step 6 — Verify

Wait 3 seconds for the gateway to fully start, then check the logs:

```bash
grep "manifest" ~/.openclaw/logs/gateway.log | tail -5
```

Look for:

```
[manifest] Observability pipeline active
```

If it appears, tell the user setup is complete. If not, check the error messages and troubleshoot.

## Troubleshooting

- **"Missing apiKey"**: Re-run step 4.
- **"Invalid apiKey format"**: The key must start with `mnfst_`.
- **Connection refused**: The endpoint is unreachable. Check the URL or ask if they self-host.
- **Duplicate OTel registration**: Disable the conflicting built-in plugin: `openclaw plugins disable diagnostics-otel`
