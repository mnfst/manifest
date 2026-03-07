---
name: uninstall-manifest-plugin
description: Uninstall the Manifest observability plugin from OpenClaw and reset to a local model provider. Use when the user says "/uninstall-manifest-plugin", "uninstall manifest", "remove manifest plugin", "reset openclaw to local", or wants to stop using Manifest routing and go back to direct provider access. Detects installed API keys and sets the best available model as default.
---

# Uninstall Manifest Plugin

Reverse everything `openclaw plugins install manifest` did: remove the manifest provider, clean up auth profiles, delete local data, and set the default model to the best available provider.

## Workflow

### 1. Run the uninstall script

Execute the bundled script to perform the full cleanup:

```bash
bash skills/uninstall-manifest-plugin/scripts/uninstall_manifest.sh
```

The script removes the plugin, provider config, auth profiles, and local data, then detects available providers and restarts the gateway. Use `--dry-run` to preview changes without modifying anything.

### 2. Set the default model

Read the script output for `OUTPUT_PROVIDER` and `OUTPUT_MODEL` lines. If a provider was detected, update both the primary model and the allowlist in `~/.openclaw/openclaw.json`:

```bash
# Set detected model as primary and in the allowlist
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

Config providers take precedence over env vars. If multiple exist, ask the user which to use as default.

### 3. Show status table

After running the script, show the diagnostic table:

```bash
bash skills/manifest-status/scripts/manifest_status.sh
```

Output the table exactly as printed. No extra commentary.
