#!/usr/bin/env bash
# Configure the Manifest OpenClaw plugin (OTLP endpoint + proxy baseUrl).
# Usage: bash setup_manifest.sh [PORT] [--mode dev|local|cloud] [--key mnfst_*] [--dry-run]
# PORT is required for dev/local modes. In cloud mode without PORT, defaults to app.manifest.build.
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

# Port is required for dev/local, optional for cloud (defaults to app.manifest.build)
if [[ -z "$PORT" && "$MODE" != "cloud" ]]; then
  echo "ERROR: Port is required for ${MODE} mode. Usage: bash setup_manifest.sh <PORT> [--mode dev|local|cloud] [--key mnfst_*]" >&2
  exit 1
fi

# Cloud mode requires an API key — use seeded dev key as fallback
if [[ "$MODE" == "cloud" && -z "$API_KEY" ]]; then
  API_KEY="mnfst_dev-otlp-key-001"
  echo "[setup-manifest] No --key provided for cloud mode, using seeded dev key"
fi

# Compute base origin, OTLP endpoint, and proxy baseUrl
if [[ -n "$PORT" ]]; then
  BASE_ORIGIN="http://localhost:${PORT}"
else
  # Cloud mode without port → production
  BASE_ORIGIN="https://app.manifest.build"
fi
ENDPOINT="${BASE_ORIGIN}/otlp"
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

# --- Step 1: Set plugin mode ---
log "Setting manifest plugin mode to '${MODE}'..."
if $DRY_RUN; then
  log "[dry-run] Would run: openclaw config set plugins.entries.manifest.config.mode ${MODE}"
else
  openclaw config set plugins.entries.manifest.config.mode "${MODE}"
  log "Mode set to ${MODE}"
fi

# --- Step 2: Set OTLP endpoint ---
log "Setting OTLP endpoint to ${ENDPOINT}..."
if $DRY_RUN; then
  log "[dry-run] Would run: openclaw config set plugins.entries.manifest.config.endpoint ${ENDPOINT}"
else
  openclaw config set plugins.entries.manifest.config.endpoint "${ENDPOINT}"
  log "Endpoint set to ${ENDPOINT}"
fi

# --- Step 3: Set provider config (baseUrl + apiKey + api type) ---
# The gateway reads models.providers.manifest to route proxy requests.
# injectProviderConfig (local/dev mode) writes these values, but switching
# modes leaves stale values behind. We must overwrite the full provider
# block so the gateway sends requests to the right host with the right key.
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
      models: [{ id: "auto", name: "auto" }]
    }
  ' "$CONFIG_FILE" > "$TEMP_CONFIG"
  cp "$TEMP_CONFIG" "$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE"
  log "Provider config set"
fi

# --- Step 4: Set API key (cloud mode) ---
if [[ -n "$API_KEY" ]]; then
  log "Setting API key..."
  if $DRY_RUN; then
    log "[dry-run] Would run: openclaw config set plugins.entries.manifest.config.apiKey ${API_KEY:0:10}***"
  else
    openclaw config set plugins.entries.manifest.config.apiKey "${API_KEY}"
    log "API key set (${API_KEY:0:10}***)"
  fi
else
  # Remove any stale apiKey for non-cloud modes
  TEMP_CONFIG=$(mktemp)
  trap 'rm -f "$TEMP_CONFIG"' EXIT
  if jq -e '.plugins.entries.manifest.config.apiKey' "$CONFIG_FILE" &>/dev/null; then
    log "Removing stale API key (not needed for ${MODE} mode)..."
    if $DRY_RUN; then
      log "[dry-run] Would remove plugins.entries.manifest.config.apiKey"
    else
      jq 'del(.plugins.entries.manifest.config.apiKey)' "$CONFIG_FILE" > "$TEMP_CONFIG"
      cp "$TEMP_CONFIG" "$CONFIG_FILE"
      chmod 600 "$CONFIG_FILE"
      log "Stale API key removed"
    fi
  fi
fi

# --- Step 5: Set primary model to manifest/auto ---
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

# --- Step 6: Reset routing overrides ---
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

# --- Step 7: Restart gateway ---
log "Restarting OpenClaw gateway..."
if $DRY_RUN; then
  log "[dry-run] Would run: openclaw gateway restart"
else
  openclaw gateway restart 2>/dev/null && log "Gateway restarted" || warn "Gateway restart failed — restart manually with: openclaw gateway restart"
fi

log ""
log "=== Setup complete ==="
log "  Mode:      ${MODE}"
log "  OTLP:      ${ENDPOINT}"
log "  Proxy:     ${BASE_URL}"
log "  Provider:  ${PROVIDER_KEY:0:10}***"
log "  Model:     manifest/auto"
log ""
log "The gateway is now routing through ${BASE_ORIGIN}"
log "Telemetry will appear in the dashboard after a few seconds."
