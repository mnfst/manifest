#!/usr/bin/env bash
# Output a diagnostic table of the current Manifest plugin configuration.
# Usage: bash manifest_status.sh
set -euo pipefail

CONFIG="${HOME}/.openclaw/openclaw.json"
MANIFEST_DIR="${HOME}/.openclaw/extensions/manifest"
LOCAL_DIR="${HOME}/.openclaw/manifest"

# Helpers
val() { jq -r "$1 // empty" "$CONFIG" 2>/dev/null || echo ""; }
mask() {
  local v="$1"
  if [[ -z "$v" ]]; then echo "—"; return; fi
  if [[ ${#v} -le 12 ]]; then echo "$v"; return; fi
  echo "${v:0:10}…${v: -4}"
}
yn() { if [[ "$1" == "true" ]]; then echo "Yes"; else echo "No"; fi; }

# Gather data
INSTALLED="No"
[[ -d "$MANIFEST_DIR" ]] && INSTALLED="Yes"

VERSION=$(val '.plugins.installs.manifest.version')
[[ -z "$VERSION" ]] && VERSION="—"

ENABLED=$(val '.plugins.entries.manifest.enabled')
ENABLED_DISPLAY=$(yn "${ENABLED:-false}")

MODE=$(val '.plugins.entries.manifest.config.mode')
[[ -z "$MODE" ]] && MODE="—"

ENDPOINT=$(val '.plugins.entries.manifest.config.endpoint')
[[ -z "$ENDPOINT" ]] && ENDPOINT="—"

PLUGIN_KEY=$(val '.plugins.entries.manifest.config.apiKey')
PLUGIN_KEY_DISPLAY=$(mask "$PLUGIN_KEY")

PROVIDER_BASE=$(val '.models.providers.manifest.baseUrl')
[[ -z "$PROVIDER_BASE" ]] && PROVIDER_BASE="—"

PROVIDER_KEY=$(val '.models.providers.manifest.apiKey')
PROVIDER_KEY_DISPLAY=$(mask "$PROVIDER_KEY")

PROVIDER_API=$(val '.models.providers.manifest.api')
[[ -z "$PROVIDER_API" ]] && PROVIDER_API="—"

DEFAULT_MODEL=$(val '.agents.defaults.model.primary')
[[ -z "$DEFAULT_MODEL" ]] && DEFAULT_MODEL="—"

MODELS_ROUTING=$(jq -c '.agents.defaults.models // {}' "$CONFIG" 2>/dev/null || echo "{}")
[[ "$MODELS_ROUTING" == "{}" || "$MODELS_ROUTING" == "[]" ]] && MODELS_ROUTING="—" || MODELS_ROUTING=$(echo "$MODELS_ROUTING" | jq -r 'if type == "object" then keys | join(", ") elif type == "array" then join(", ") else . end' 2>/dev/null || echo "—")

LOCAL_DB="—"
[[ -f "${LOCAL_DIR}/manifest.db" ]] && LOCAL_DB="${LOCAL_DIR}/manifest.db"

# Key sync check
KEY_SYNC="—"
if [[ -n "$PLUGIN_KEY" && -n "$PROVIDER_KEY" ]]; then
  if [[ "$PLUGIN_KEY" == "$PROVIDER_KEY" ]]; then
    KEY_SYNC="In sync"
  else
    KEY_SYNC="DESYNC"
  fi
elif [[ -z "$PLUGIN_KEY" && -z "$PROVIDER_KEY" ]]; then
  KEY_SYNC="—"
elif [[ "$MODE" == "dev" || "$MODE" == "local" ]]; then
  KEY_SYNC="OK (dev/local)"
else
  KEY_SYNC="DESYNC"
fi

# Output table
printf "\n"
printf "  %-24s  %s\n" "Setting" "Value"
printf "  %-24s  %s\n" "────────────────────────" "──────────────────────────────────────────"
printf "  %-24s  %s\n" "Installed"          "$INSTALLED"
printf "  %-24s  %s\n" "Version"            "$VERSION"
printf "  %-24s  %s\n" "Enabled"            "$ENABLED_DISPLAY"
printf "  %-24s  %s\n" "Mode"               "$MODE"
printf "  %-24s  %s\n" "OTLP endpoint"      "$ENDPOINT"
printf "  %-24s  %s\n" "Plugin API key"     "$PLUGIN_KEY_DISPLAY"
printf "  %-24s  %s\n" "Provider baseUrl"   "$PROVIDER_BASE"
printf "  %-24s  %s\n" "Provider API key"   "$PROVIDER_KEY_DISPLAY"
printf "  %-24s  %s\n" "Provider API type"  "$PROVIDER_API"
printf "  %-24s  %s\n" "Keys in sync"       "$KEY_SYNC"
printf "  %-24s  %s\n" "Default model"      "$DEFAULT_MODEL"
printf "  %-24s  %s\n" "Models allowlist"   "$MODELS_ROUTING"
printf "  %-24s  %s\n" "Local DB"           "$LOCAL_DB"
printf "\n"
