#!/usr/bin/env bash
# Uninstall the Manifest plugin from OpenClaw and reset to a local model provider.
# Usage: bash uninstall_manifest.sh [--dry-run]
set -euo pipefail

OPENCLAW_DIR="${HOME}/.openclaw"
CONFIG_FILE="${OPENCLAW_DIR}/openclaw.json"
MANIFEST_DIR="${OPENCLAW_DIR}/manifest"
EXTENSIONS_DIR="${OPENCLAW_DIR}/extensions/manifest"
AGENTS_DIR="${OPENCLAW_DIR}/agents"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
  esac
done

log() { echo "[uninstall-manifest] $*"; }
warn() { echo "[uninstall-manifest] WARNING: $*" >&2; }

# --- Pre-flight checks ---
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: sudo apt install jq / brew install jq" >&2
  exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: OpenClaw config not found at $CONFIG_FILE" >&2
  exit 1
fi

# --- Step 1: Run openclaw plugins uninstall + remove extension directory ---
log "Uninstalling manifest plugin via openclaw CLI..."
if $DRY_RUN; then
  log "[dry-run] Would run: echo y | openclaw plugins uninstall manifest"
  [[ -d "$EXTENSIONS_DIR" ]] && log "[dry-run] Would remove: $EXTENSIONS_DIR"
else
  if command -v openclaw &>/dev/null; then
    echo "y" | openclaw plugins uninstall manifest 2>/dev/null || warn "openclaw CLI uninstall failed; continuing with manual cleanup"
  else
    warn "openclaw CLI not found; performing manual cleanup only"
  fi
  # Always remove the extension directory — the CLI may skip it or fail on the prompt
  if [[ -d "$EXTENSIONS_DIR" ]]; then
    rm -rf "$EXTENSIONS_DIR"
    log "Removed extension directory $EXTENSIONS_DIR"
  fi
fi

# --- Step 2: Clean manifest provider from openclaw.json ---
log "Removing manifest provider from config..."
TEMP_CONFIG=$(mktemp)
trap 'rm -f "$TEMP_CONFIG"' EXIT

jq '
  # Remove manifest from models.providers
  (if .models?.providers?.manifest then del(.models.providers.manifest) else . end)
  |
  # Remove "manifest/auto" from agents.defaults.models (object or array format)
  (if .agents?.defaults?.models then
    if (.agents.defaults.models | type) == "object" then
      .agents.defaults.models |= with_entries(select(.key != "manifest/auto"))
    else
      .agents.defaults.models = [.agents.defaults.models[] | select(. != "manifest/auto")]
    end
  else . end)
  |
  # Reset primary model if it was manifest/auto
  (if .agents?.defaults?.model?.primary == "manifest/auto" then
    .agents.defaults.model.primary = ""
  else . end)
  |
  # Remove manifest plugin entry
  (if .plugins?.entries?.manifest then del(.plugins.entries.manifest) else . end)
  |
  # Remove manifest install record
  (if .plugins?.installs?.manifest then del(.plugins.installs.manifest) else . end)
' "$CONFIG_FILE" > "$TEMP_CONFIG"

if $DRY_RUN; then
  log "[dry-run] Config changes:"
  diff <(jq --sort-keys . "$CONFIG_FILE") <(jq --sort-keys . "$TEMP_CONFIG") || true
else
  cp "$TEMP_CONFIG" "$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE"
  log "Updated $CONFIG_FILE"
fi

# --- Step 3: Remove manifest auth profiles from all agents ---
if [[ -d "$AGENTS_DIR" ]]; then
  log "Cleaning manifest auth profiles from agents..."
  find "$AGENTS_DIR" -name "auth-profiles.json" -type f | while read -r profile_file; do
    if jq -e '.profiles["manifest:default"]' "$profile_file" &>/dev/null; then
      if $DRY_RUN; then
        log "[dry-run] Would remove manifest:default from $profile_file"
      else
        jq 'del(.profiles["manifest:default"])' "$profile_file" > "${profile_file}.tmp"
        mv "${profile_file}.tmp" "$profile_file"
        chmod 600 "$profile_file"
        log "Cleaned $profile_file"
      fi
    fi
  done
fi

# --- Step 4: Remove local manifest data ---
if [[ -d "$MANIFEST_DIR" ]]; then
  log "Removing local manifest data at $MANIFEST_DIR..."
  if $DRY_RUN; then
    log "[dry-run] Would remove: $MANIFEST_DIR"
  else
    rm -rf "$MANIFEST_DIR"
    log "Removed $MANIFEST_DIR"
  fi
fi

# --- Step 5: Detect installed API keys and suggest default model ---
log ""
log "=== Detecting installed providers ==="

DETECTED_PROVIDER=""
DETECTED_MODEL=""

# Read remaining providers from config
PROVIDERS=$(jq -r '.models.providers // {} | keys[]' "$CONFIG_FILE" 2>/dev/null || true)

# Also check common environment variables
detect_from_env() {
  local name="$1" env_var="$2" model="$3"
  if [[ -n "${!env_var:-}" ]]; then
    log "  Found $name (via \$$env_var)"
    if [[ -z "$DETECTED_PROVIDER" ]]; then
      DETECTED_PROVIDER="$name"
      DETECTED_MODEL="$model"
    fi
  fi
}

# Check config providers first (higher priority)
for provider in $PROVIDERS; do
  case "$provider" in
    anthropic|Anthropic)
      log "  Found Anthropic provider in config"
      if [[ -z "$DETECTED_PROVIDER" ]]; then
        DETECTED_PROVIDER="anthropic"
        DETECTED_MODEL="anthropic/claude-sonnet-4-6"
      fi
      ;;
    openai|OpenAI)
      log "  Found OpenAI provider in config"
      if [[ -z "$DETECTED_PROVIDER" ]]; then
        DETECTED_PROVIDER="openai"
        DETECTED_MODEL="openai/gpt-4o"
      fi
      ;;
    google|Google|gemini|Gemini)
      log "  Found Google provider in config"
      if [[ -z "$DETECTED_PROVIDER" ]]; then
        DETECTED_PROVIDER="google"
        DETECTED_MODEL="google/gemini-2.5-pro"
      fi
      ;;
    deepseek|DeepSeek)
      log "  Found DeepSeek provider in config"
      if [[ -z "$DETECTED_PROVIDER" ]]; then
        DETECTED_PROVIDER="deepseek"
        DETECTED_MODEL="deepseek/deepseek-r1"
      fi
      ;;
    groq|Groq)
      log "  Found Groq provider in config"
      if [[ -z "$DETECTED_PROVIDER" ]]; then
        DETECTED_PROVIDER="groq"
        DETECTED_MODEL="groq/llama-4-scout-17b"
      fi
      ;;
    *)
      log "  Found provider: $provider"
      ;;
  esac
done

# Fallback: check environment variables
detect_from_env "Anthropic" "ANTHROPIC_API_KEY" "anthropic/claude-sonnet-4-6"
detect_from_env "OpenAI" "OPENAI_API_KEY" "openai/gpt-4o"
detect_from_env "Google" "GOOGLE_API_KEY" "google/gemini-2.5-pro"
detect_from_env "Google" "GEMINI_API_KEY" "google/gemini-2.5-pro"
detect_from_env "DeepSeek" "DEEPSEEK_API_KEY" "deepseek/deepseek-r1"
detect_from_env "Groq" "GROQ_API_KEY" "groq/llama-4-scout-17b"

log ""
if [[ -n "$DETECTED_PROVIDER" ]]; then
  log "Recommended default model: $DETECTED_MODEL"
  log ""
  log "OUTPUT_PROVIDER=$DETECTED_PROVIDER"
  log "OUTPUT_MODEL=$DETECTED_MODEL"
else
  log "No API keys detected. Configure a provider manually in $CONFIG_FILE"
  log ""
  log "OUTPUT_PROVIDER=none"
  log "OUTPUT_MODEL=none"
fi

# --- Step 6: Restart the gateway ---
log "Restarting OpenClaw gateway..."
if $DRY_RUN; then
  log "[dry-run] Would run: openclaw gateway restart"
else
  if command -v openclaw &>/dev/null; then
    openclaw gateway restart 2>/dev/null && log "Gateway restarted" || warn "Gateway restart failed"
  else
    warn "openclaw CLI not found; restart the gateway manually with: openclaw gateway restart"
  fi
fi

log ""
log "Manifest plugin uninstall complete."
