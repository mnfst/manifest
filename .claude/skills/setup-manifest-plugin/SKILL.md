---
name: setup-manifest-plugin
description: Configure Manifest as a model provider in OpenClaw. Use when the user says "/setup-manifest-plugin", "setup manifest", "connect manifest", "point openclaw to localhost", or wants to add Manifest as a model provider. For cloud users, sets up models.providers.manifest directly (no plugin). For local dev, configures the plugin. Accepts a port number and optional mode.
---

# Setup Manifest

Configure OpenClaw to route through Manifest -- either the cloud service or a local dev server.

**Cloud users don't need the plugin.** This skill adds Manifest as a direct model provider in the OpenClaw config.

## Workflow

### 1. Determine parameters

- **Port** (required for dev/local, optional for cloud): The port where the Manifest backend is running. In cloud mode without a port, defaults to `https://app.manifest.build`.
- **Mode** (optional, default `dev`): `dev`, `local`, or `cloud`
  - `dev` -- Local development, connects to a backend you started manually
  - `local` -- Configures the plugin for embedded server with SQLite (plugin must be installed separately via `openclaw plugins install manifest`)
  - `cloud` -- Connects to `app.manifest.build` (or localhost if port is provided)
- **Key** (optional): A `mnfst_*` API key. Required for cloud mode.

If the user doesn't specify a mode, default to `dev`. If dev/local and no port, ask them.

### 2. Run the setup script

```bash
# Dev (port required):
bash "${CLAUDE_SKILL_DIR}/scripts/setup_manifest.sh" <PORT> --mode dev [--key <KEY>]

# Cloud (port optional):
bash "${CLAUDE_SKILL_DIR}/scripts/setup_manifest.sh" --mode cloud --key <KEY>
```

The script sets the provider config (`models.providers.manifest`), default model (`manifest/auto`), and restarts the gateway. Use `--dry-run` to preview.

### 3. Show status table

```bash
bash .claude/skills/manifest-status/scripts/manifest_status.sh
```

Output the table exactly as printed. No extra commentary.
