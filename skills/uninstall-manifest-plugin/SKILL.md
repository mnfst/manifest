---
name: uninstall-manifest-plugin
description: Remove Manifest from OpenClaw and reset to a direct model provider. Use when the user says "/uninstall-manifest-plugin", "uninstall manifest", "remove manifest", "reset openclaw", or wants to stop using Manifest routing and go back to direct provider access. Works for both cloud users (provider config only) and local users (plugin + provider config).
---

# Uninstall Manifest

Remove Manifest from OpenClaw -- both the model provider config and the plugin (if installed). Resets the default model to the best available provider.

**Cloud users** (no plugin): This removes `models.providers.manifest` from the config and resets the default model.

**Local users** (plugin installed): This also removes the plugin, auth profiles, and local data.

## Workflow

### 1. Run the uninstall script

```bash
bash skills/uninstall-manifest-plugin/scripts/uninstall_manifest.sh
```

The script removes the provider config, plugin (if installed), auth profiles, and local data, then detects available providers and restarts the gateway. Use `--dry-run` to preview.

### 2. Set the default model

Read the script output for `OUTPUT_PROVIDER` and `OUTPUT_MODEL` lines. If a provider was detected, update the primary model:

```bash
jq --arg model "<OUTPUT_MODEL>" '
  .agents.defaults.model.primary = $model
' ~/.openclaw/openclaw.json > /tmp/oc.json \
  && mv /tmp/oc.json ~/.openclaw/openclaw.json
```

**Provider priority** (first match wins):

| Provider | Env var | Default model |
|----------|---------|---------------|
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic/claude-sonnet-4-6` |
| OpenAI | `OPENAI_API_KEY` | `openai/gpt-4o` |
| Google | `GOOGLE_API_KEY` or `GEMINI_API_KEY` | `google/gemini-2.5-pro` |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek/deepseek-r1` |
| Groq | `GROQ_API_KEY` | `groq/llama-4-scout-17b` |

If multiple exist, ask the user which to use as default.

### 3. Show status table

```bash
bash skills/manifest-status/scripts/manifest_status.sh
```

Output the table exactly as printed. No extra commentary.
