---
name: setup-manifest-plugin
description: Configure the Manifest OpenClaw plugin (OTLP endpoint + proxy baseUrl). Use when the user says "/setup-manifest-plugin", "setup manifest plugin", "connect manifest to port", "point openclaw to localhost", "switch to cloud mode", or wants to configure the OpenClaw gateway to route through Manifest (local dev or cloud at app.manifest.build). Accepts a port number (required for dev/local, optional for cloud) and optional mode. Resets routing, sets the OTLP endpoint and proxy baseUrl, and restarts the gateway.
---

# Setup Manifest Plugin

Configure the OpenClaw gateway to route through Manifest — either a local dev server or cloud (`app.manifest.build`).

## Workflow

### 1. Determine parameters

- **Port** (required for dev/local, optional for cloud): The port where the Manifest backend is running (e.g., `35166`). In cloud mode without a port, defaults to `https://app.manifest.build`.
- **Mode** (optional, default `dev`): `dev`, `local`, or `cloud`
  - `dev` — Standard development mode, OTLP loopback bypass (no real API key needed)
  - `local` — Local mode with SQLite, no PostgreSQL, useful for testing local-mode differences
  - `cloud` — Cloud mode pointing to `app.manifest.build` (or localhost if port is provided for local cloud testing)
- **Key** (optional): A `mnfst_*` OTLP API key. Required for cloud mode. If mode is `cloud` and no key is provided, use the seeded dev key `mnfst_dev-otlp-key-001`.

If the user doesn't specify a mode, default to `dev`. If the mode is dev/local and the user doesn't specify a port, ask them. For cloud mode without a port, the script defaults to `app.manifest.build`.

### 2. Run the setup script

```bash
# Dev/local (port required):
bash skills/setup-manifest-plugin/scripts/setup_manifest.sh <PORT> --mode <MODE> [--key <KEY>]

# Cloud (port optional — defaults to app.manifest.build):
bash skills/setup-manifest-plugin/scripts/setup_manifest.sh --mode cloud --key <KEY>
```

The script configures the OTLP endpoint, provider block, default model (`manifest/auto`), and restarts the gateway. Use `--dry-run` to preview changes without modifying anything.

### 3. Show status table

After the script completes, run the diagnostic table:

```bash
bash skills/manifest-status/scripts/manifest_status.sh
```

Output the table exactly as printed. No extra commentary.
