#!/usr/bin/env bash
# disaster-recovery.sh — Kill the WIP stack, spin up the DR stack over Tailscale.
#
# Usage:
#   ./disaster-recovery.sh              # stop WIP → start DR
#   ./disaster-recovery.sh status       # show both stacks
#   ./disaster-recovery.sh stop         # stop DR only
#   ./disaster-recovery.sh restore      # stop DR → start WIP
#
# First run: fills in .env.dr if empty, then starts everything.

set -euo pipefail
cd "$(dirname "$0")"

COMPOSE_WIP="docker-compose.yml"
COMPOSE_DR="docker-compose.dr.yml"
ENV_DR=".env.dr"
PROJECT_WIP="mnfst"
PROJECT_DR="mnfst-dr"

red()   { printf '\033[1;31m%s\033[0m\n' "$*"; }
green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[1;33m%s\033[0m\n' "$*"; }
dim()   { printf '\033[2m%s\033[0m\n' "$*"; }

# ── Helpers ────────────────────────────────────────────────────────────────

ensure_env() {
  local missing=0
  if ! grep -qE '^BETTER_AUTH_SECRET=.+' "$ENV_DR" 2>/dev/null; then
    missing=1
  fi
  if ! grep -qE '^TS_AUTHKEY=.+' "$ENV_DR" 2>/dev/null; then
    missing=1
  fi

  if [[ "$missing" -eq 0 ]]; then
    return 0
  fi

  yellow "⚠  .env.dr is missing required values."
  echo ""

  # Generate BETTER_AUTH_SECRET if empty
  if ! grep -qE '^BETTER_AUTH_SECRET=.+' "$ENV_DR" 2>/dev/null; then
    local secret
    secret=$(openssl rand -hex 32)
    if grep -qE '^BETTER_AUTH_SECRET=$' "$ENV_DR" 2>/dev/null; then
      sed -i "s/^BETTER_AUTH_SECRET=$/BETTER_AUTH_SECRET=$secret/" "$ENV_DR"
    else
      echo "BETTER_AUTH_SECRET=$secret" >> "$ENV_DR"
    fi
    green "✓  Generated BETTER_AUTH_SECRET"
  fi

  # Prompt for TS_AUTHKEY if empty
  if ! grep -qE '^TS_AUTHKEY=.+' "$ENV_DR" 2>/dev/null; then
    echo ""
    yellow "I need your Tailscale auth key."
    dim "   Get one at: https://login.tailscale.com/admin/settings/keys"
    echo ""
    read -rp "Paste TS_AUTHKEY: " tskey
    if [[ -z "$tskey" ]]; then
      red "✗  No key provided. Aborting."
      exit 1
    fi
    if grep -qE '^TS_AUTHKEY=$' "$ENV_DR" 2>/dev/null; then
      sed -i "s/^TS_AUTHKEY=$/TS_AUTHKEY=$tskey/" "$ENV_DR"
    else
      echo "TS_AUTHKEY=$tskey" >> "$ENV_DR"
    fi
    green "✓  Saved TS_AUTHKEY"
  fi

  echo ""
}

stop_project() {
  local project="$1" compose="$2"
  if docker compose -f "$compose" -p "$project" ps --quiet 2>/dev/null | grep -q .; then
    yellow "⏹  Stopping $project..."
    docker compose -f "$compose" -p "$project" down --remove-orphans 2>/dev/null || true
    green "✓  $project stopped"
  else
    dim "   $project not running"
  fi
}

start_dr() {
  ensure_env

  green "🚀  Starting DR stack (mnfst-dr)..."
  docker compose -f "$COMPOSE_DR" --env-file "$ENV_DR" up -d

  echo ""
  green "✓  DR stack is up"
  echo ""
  dim "   Dashboard:  http://$(grep -oP 'TS_HOSTNAME=\K.*' "$ENV_DR" 2>/dev/null || echo 'manifest-dr'):2100"
  dim "   Project:    $PROJECT_DR"
  dim "   Image:      manifestdotbuild/manifest:latest"
  echo ""
  yellow "Tailscale sidecar may take 10-30s to fully mesh."
  dim "   Check: tailscale status"
}

# ── Commands ───────────────────────────────────────────────────────────────

cmd_status() {
  echo ""
  yellow "── WIP stack ($PROJECT_WIP) ──"
  docker compose -f "$COMPOSE_WIP" -p "$PROJECT_WIP" ps 2>/dev/null || dim "   not running"
  echo ""
  yellow "── DR stack ($PROJECT_DR) ──"
  docker compose -f "$COMPOSE_DR" -p "$PROJECT_DR" --env-file "$ENV_DR" ps 2>/dev/null || dim "   not running"
  echo ""
}

cmd_stop() {
  stop_project "$PROJECT_DR" "$COMPOSE_DR"
}

cmd_restore() {
  stop_project "$PROJECT_DR" "$COMPOSE_DR"
  echo ""
  green "🔄  Starting WIP stack (mnfst)..."
  docker compose -f "$COMPOSE_WIP" -p "$PROJECT_WIP" up -d
  green "✓  WIP stack restored"
}

cmd_default() {
  stop_project "$PROJECT_WIP" "$COMPOSE_WIP"
  echo ""
  start_dr
}

# ── Main ───────────────────────────────────────────────────────────────────

case "${1:-}" in
  status)  cmd_status ;;
  stop)    cmd_stop ;;
  restore) cmd_restore ;;
  ""|-*)   cmd_default ;;
  *)
    red "Unknown command: $1"
    echo "Usage: $0 [status|stop|restore]"
    exit 1
    ;;
esac
