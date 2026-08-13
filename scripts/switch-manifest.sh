#!/usr/bin/env bash
# switch-manifest.sh — Manage the Manifest Prod/Dev dual-stack setup.
#
# Two Manifest instances run side-by-side:
#   Port 2099 = Production  (stable, safe, snapshotted when ready)
#   Port 2100 = Development (new features, active testing)
#
# All development happens on 2100. When stable, snapshot prod (2099) → dev (2100).
# OpenCode presets switch between "manifest" (prod) and "manifest-dev" (dev).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_DIR="$REPO_DIR/docker"
PROD_COMPOSE="$DOCKER_DIR/docker-compose.yml"
DEV_COMPOSE="$DOCKER_DIR/docker-compose.dev.yml"
PROD_ENV="$DOCKER_DIR/.env"
DEV_ENV="$DOCKER_DIR/.env.dev"
OMOS_CONFIG="$HOME/.config/opencode/oh-my-opencode-slim.jsonc"

# ── helpers ──────────────────────────────────────────────────────────────

prod_compose() {
  docker compose -f "$PROD_COMPOSE" --project-directory "$DOCKER_DIR" --env-file "$PROD_ENV" "$@"
}

dev_compose() {
  docker compose -f "$DEV_COMPOSE" --project-directory "$DOCKER_DIR" --env-file "$DEV_ENV" "$@"
}

# ── commands ─────────────────────────────────────────────────────────────

cmd_help() {
  cat <<'EOF'
switch-manifest.sh — Manifest Prod/Dev dual-stack manager

USAGE
  switch-manifest.sh <command>

COMMANDS
  status       Show both stacks' health and the active OpenCode preset.
               This is the default when no command is given.

  prod         Switch OpenCode to the PRODUCTION preset (port 2099).
               All agents (orchestrator, fixer, explorer, etc.) will use
               the stable prod instance. Restart OpenCode after running.

  dev          Switch OpenCode to the DEV preset (port 2100).
               All agents use the dev instance where you test new features.
               Restart OpenCode after running.

  snapshot     Copy the production database into the DEV instance (2099 → 2100).
               Use this when prod is stable and you want dev to match it,
               or before a big change so you have a clean baseline.
               ⚠️  This REPLACES the entire DEV database.

  up           Start both stacks (prod + dev).

  down         Stop both stacks.

  rebuild      Rebuild the manifest Docker image from source and restart
               both stacks. Use after pulling new code or changing the
               healer.

  help         Show this help message.

WORKFLOW
  1. Develop on Dev (2100):
       switch-manifest.sh dev    # point OpenCode at Dev
       # ... make changes, test ...

  2. When stable, snapshot prod into dev or promote:
       switch-manifest.sh snapshot   # copy prod DB → dev
       switch-manifest.sh prod       # point OpenCode at prod

PORTS & CONTAINERS
  Prod:  2099 (manifest) / 3100 (healer) / 5432 (postgres)  — project: mnfst
  Dev:   2100 (manifest) / 3101 (healer) / 5432 (postgres)  — project: mnfst-dev

FILES
  docker/docker-compose.yml      Prod compose
  docker/docker-compose.dev.yml  Dev compose
  docker/.env                    Prod env (secrets, port 2099)
  docker/.env.dev                Dev env (secrets, port 2100)
  ~/.config/opencode/oh-my-opencode-slim.jsonc   Preset config
EOF
}

cmd_status() {
  echo "═══ Production (2099) ═══"
  prod_compose ps 2>/dev/null || echo "(not running)"
  echo ""
  echo "═══ Dev (2100) ═══"
  dev_compose ps 2>/dev/null || echo "(not running)"
  echo ""
  echo "═══ OpenCode preset ═══"
  local preset
  preset=$(grep -oP '"preset"\s*:\s*"\K[^"]+' "$OMOS_CONFIG" 2>/dev/null || echo "unknown")
  echo "Active: $preset"
  echo ""
  echo "Run 'switch-manifest.sh help' for usage."
}

cmd_switch_preset() {
  local target="$1"
  local label="$2"
  if [[ ! -f "$OMOS_CONFIG" ]]; then
    echo "ERROR: oh-my-opencode-slim config not found at $OMOS_CONFIG"
    exit 1
  fi
  sed -i "s/\"preset\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"preset\": \"$target\"/" "$OMOS_CONFIG"
  echo "✓ Switched OpenCode preset: $target ($label)"
  echo "  Restart OpenCode for the change to take effect."
}

cmd_snapshot() {
  echo "Snapshot: prod (2099) → dev (2100)"
  echo "⚠️  This REPLACES the entire DEV database."
  echo ""

  echo "Stopping Dev manifest..."
  docker stop mnfst-dev-manifest-1 2>/dev/null || true
  sleep 2

  echo "Dumping prod DB (custom format)..."
  docker exec mnfst-postgres-1 pg_dump -U manifest -Fc manifest > /tmp/prod.dump

  echo "Copying dump into Dev postgres..."
  docker cp /tmp/prod.dump mnfst-dev-postgres-1:/tmp/prod.dump

  echo "Recreating Dev database..."
  docker exec mnfst-dev-postgres-1 psql -U manifest -d postgres -c "DROP DATABASE IF EXISTS manifest;"
  docker exec mnfst-dev-postgres-1 psql -U manifest -d postgres -c "CREATE DATABASE manifest OWNER manifest;"

  echo "Restoring into Dev..."
  docker exec mnfst-dev-postgres-1 pg_restore -U manifest -d manifest /tmp/prod.dump 2>/dev/null

  echo "Starting Dev manifest..."
  docker start mnfst-dev-manifest-1

  rm -f /tmp/prod.dump
  echo ""
  echo "✓ Snapshot complete. Dev (2100) is now a copy of prod (2099)."
  echo "  Waiting for Dev to be healthy..."
  sleep 15
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" http://100.69.158.7:2100/api/v1/health 2>/dev/null || echo "000")
  if [[ "$code" == "200" ]]; then
    echo "  ✓ Dev is healthy (HTTP 200)"
  else
    echo "  ⚠ Dev returned HTTP $code — check logs: docker logs mnfst-dev-manifest-1"
  fi
}

cmd_rebuild() {
  echo "Rebuilding manifest image..."
  docker build -f "$REPO_DIR/docker/Dockerfile" -t manifestdotbuild/manifest:latest "$REPO_DIR"
  echo "Restarting prod..."
  prod_compose up -d --force-recreate
  echo "Restarting dev..."
  dev_compose up -d --force-recreate
  cmd_status
}

# ── main ─────────────────────────────────────────────────────────────────

case "${1:-status}" in
  help|-h|--help)  cmd_help ;;
  status)          cmd_status ;;
  prod)            cmd_switch_preset "manifest" "port 2099" ;;
  dev)             cmd_switch_preset "manifest-dev" "port 2100" ;;
  snapshot)        cmd_snapshot ;;
  up)
    prod_compose up -d
    dev_compose up -d
    cmd_status
    ;;
  down)
    prod_compose down
    dev_compose down
    ;;
  rebuild)         cmd_rebuild ;;
  *)
    echo "Unknown command: $1"
    echo "Run '$0 help' for usage."
    exit 1
    ;;
esac
