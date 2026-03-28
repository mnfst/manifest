#!/usr/bin/env bash
# Configure Manifest as a model provider in OpenClaw.
# Cloud users: sets models.providers.manifest directly (no plugin needed).
# Dev/local users: also configures the plugin.
# Usage: bash setup_manifest.sh [PORT] [--mode dev|local|cloud] [--key mnfst_*] [--dry-run]
set -euo pipefail

OPENCLAW_DIR="${HOME}/.openclaw"
CONFIG_FILE="${OPENCLAW_DIR}/openclaw.json"
DRY_RUN=false
MODE="dev"
PORT=""
API_KEY=""

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode) MODE="$2"; shift 2 ;;
    --key) API_KEY="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *)
      if [[ -z "$PORT" && "$1" =~ ^[0-9]+$ ]]; then
        PORT="$1"; shift
      else
        echo "ERROR: Unknown argument: $1" >&2; exit 1
      fi
      ;;
  esac
done

if [[ ! "$MODE" =~ ^(dev|local|cloud)$ ]]; then
  echo "ERROR: Mode must be dev, local, or cloud (got: $MODE)" >&2
  exit 1
fi

# Port is required for dev/local, optional for cloud
if [[ -z "$PORT" && "$MODE" != "cloud" ]]; then
  echo "ERROR: Port is required for ${MODE} mode. Usage: bash setup_manifest.sh <PORT> [--mode dev|local|cloud] [--key mnfst_*]" >&2
  exit 1
fi

# Cloud mode requires an API key
if [[ "$MODE" == "cloud" && -z "$API_KEY" ]]; then
  API_KEY="mnfst_dev-otlp-key-001"
  echo "[setup-manifest] No --key provided for cloud mode, using seeded dev key"
fi

# Compute base URL
if [[ -n "$PORT" ]]; then
  BASE_ORIGIN="http://localhost:${PORT}"
else
  BASE_ORIGIN="https://app.manifest.build"
fi
BASE_URL="${BASE_ORIGIN}/v1"

log() { echo "[setup-manifest] $*"; }
warn() { echo "[setup-manifest] WARNING: $*" >&2; }

# --- Pre-flight checks ---
if ! command -v openclaw &>/dev/null; then
  echo "ERROR: openclaw CLI not found. Install it first." >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: sudo apt install jq / brew install jq" >&2
  exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: OpenClaw config not found at $CONFIG_FILE" >&2
  exit 1
fi

# --- Step 1: Set plugin mode (only for local/dev — cloud users skip the plugin) ---
if [[ "$MODE" != "cloud" ]]; then
  log "Setting manifest plugin mode to '${MODE}'..."
  if $DRY_RUN; then
    log "[dry-run] Would run: openclaw config set plugins.entries.manifest.config.mode ${MODE}"
  else
    openclaw config set plugins.entries.manifest.config.mode "${MODE}"
    log "Mode set to ${MODE}"
  fi

  # Set plugin endpoint for dev mode
  if [[ "$MODE" == "dev" ]]; then
    log "Setting plugin endpoint to ${BASE_ORIGIN}..."
    if $DRY_RUN; then
      log "[dry-run] Would run: openclaw config set plugins.entries.manifest.config.endpoint ${BASE_ORIGIN}"
    else
      openclaw config set plugins.entries.manifest.config.endpoint "${BASE_ORIGIN}"
      log "Endpoint set to ${BASE_ORIGIN}"
    fi
  fi
fi

# --- Step 2: Set provider config (models.providers.manifest) ---
PROVIDER_KEY="${API_KEY:-dev-no-auth}"
log "Setting provider config (baseUrl=${BASE_URL}, apiKey=${PROVIDER_KEY:0:10}***)..."
if $DRY_RUN; then
  log "[dry-run] Would set models.providers.manifest = { baseUrl, apiKey, api, models }"
else
  TEMP_CONFIG=$(mktemp)
  trap 'rm -f "$TEMP_CONFIG"' EXIT

  jq --arg url "$BASE_URL" --arg key "$PROVIDER_KEY" '
    .models.providers.manifest = {
      baseUrl: $url,
      api: "openai-completions",
      apiKey: $key,
      models: [{ id: "auto", name: "Manifest Auto" }]
    }
  ' "$CONFIG_FILE" > "$TEMP_CONFIG"
  cp "$TEMP_CONFIG" "$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE"
  log "Provider config set"
fi

# --- Step 3: Set API key for plugin (cloud mode) ---
if [[ -n "$API_KEY" && "$MODE" != "cloud" ]]; then
  log "Setting plugin API key..."
  if $DRY_RUN; then
    log "[dry-run] Would run: openclaw config set plugins.entries.manifest.config.apiKey ${API_KEY:0:10}***"
  else
    openclaw config set plugins.entries.manifest.config.apiKey "${API_KEY}"
    log "Plugin API key set (${API_KEY:0:10}***)"
  fi
fi

# --- Step 4: Set primary model to manifest/auto ---
log "Setting default model to manifest/auto..."
if $DRY_RUN; then
  log "[dry-run] Would update agents.defaults.model.primary = manifest/auto"
else
  TEMP_CONFIG=$(mktemp)
  trap 'rm -f "$TEMP_CONFIG"' EXIT

  jq '.agents.defaults.model.primary = "manifest/auto"' "$CONFIG_FILE" > "$TEMP_CONFIG"
  cp "$TEMP_CONFIG" "$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE"
  log "Default model set to manifest/auto"
fi

# --- Step 5: Reset routing overrides ---
log "Resetting routing overrides..."
if $DRY_RUN; then
  log "[dry-run] Would clear agents.defaults.models"
else
  TEMP_CONFIG=$(mktemp)
  trap 'rm -f "$TEMP_CONFIG"' EXIT

  jq '
    if .agents?.defaults?.models then
      if (.agents.defaults.models | type) == "object" then
        .agents.defaults.models = {}
      else
        .agents.defaults.models = []
      end
    else . end
  ' "$CONFIG_FILE" > "$TEMP_CONFIG"
  cp "$TEMP_CONFIG" "$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE"
  log "Routing overrides cleared"
fi

# --- Step 6: Restart gateway ---
log "Restarting OpenClaw gateway..."
if $DRY_RUN; then
  log "[dry-run] Would run: openclaw gateway restart"
else
  openclaw gateway restart 2>/dev/null && log "Gateway restarted" || warn "Gateway restart failed -- restart manually with: openclaw gateway restart"
fi

log ""
log "=== Setup complete ==="
log "  Mode:      ${MODE}"
log "  Proxy:     ${BASE_URL}"
log "  Provider:  ${PROVIDER_KEY:0:10}***"
log "  Model:     manifest/auto"
log ""
log "The gateway is now routing through ${BASE_ORIGIN}"
