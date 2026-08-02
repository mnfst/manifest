#!/usr/bin/env bash
# switch-manifest.sh — Manage the Manifest prod/DR dual-stack setup.
#
# Usage:
#   switch-manifest.sh status     Show both stacks' health
#   switch-manifest.sh prod       Switch oh-my-opencode-slim to prod preset (2099)
#   switch-manifest.sh dev        Switch oh-my-opencode-slim to DR preset (2100)
#   switch-manifest.sh snapshot   Copy prod DB → DR (stops DR postgres, pg_dump/restore)
#   switch-manifest.sh up         Start both stacks
#   switch-manifest.sh down       Stop both stacks
#   switch-manifest.sh rebuild    Rebuild manifest image, restart both stacks
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_DIR="$REPO_DIR/docker"
PROD_COMPOSE="$DOCKER_DIR/docker-compose.yml"
DR_COMPOSE="$DOCKER_DIR/docker-compose.dr.yml"
PROD_ENV="$DOCKER_DIR/.env"
DR_ENV="$DOCKER_DIR/.env.dr"
OMOS_CONFIG="$HOME/.config/opencode/oh-my-opencode-slim.jsonc"

prod_compose() {
  docker compose -f "$PROD_COMPOSE" --project-directory "$DOCKER_DIR" --env-file "$PROD_ENV" "$@"
}

dr_compose() {
  docker compose -f "$DR_COMPOSE" --project-directory "$DOCKER_DIR" --env-file "$DR_ENV" "$@"
}

status() {
  echo "═══ Production (2099) ═══"
  prod_compose ps 2>/dev/null || echo "(not running)"
  echo ""
  echo "═══ DR / Dev (2100) ═══"
  dr_compose ps 2>/dev/null || echo "(not running)"
  echo ""
  echo "═══ OpenCode preset ═══"
  local preset
  preset=$(grep -oP '"preset"\s*:\s*"\K[^"]+' "$OMOS_CONFIG" 2>/dev/null || echo "unknown")
  echo "Active: $preset"
}

switch_preset() {
  local target="$1"
  if [[ ! -f "$OMOS_CONFIG" ]]; then
    echo "ERROR: oh-my-opencode-slim config not found at $OMOS_CONFIG"
    exit 1
  fi
  # Replace the "preset" value
  sed -i "s/\"preset\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"preset\": \"$target\"/" "$OMOS_CONFIG"
  echo "Switched oh-my-opencode-slim preset to: $target"
  echo "Restart OpenCode for the change to take effect."
}

snapshot() {
  echo "Snapshotting prod DB → DR..."
  echo "Stopping DR postgres..."
  dr_compose stop postgres 2>/dev/null || true

  echo "Dumping prod DB..."
  prod_compose exec -T postgres pg_dump -U manifest manifest > /tmp/manifest_snapshot.sql

  echo "Starting DR postgres..."
  dr_compose up -d postgres
  sleep 5

  echo "Restoring into DR..."
  dr_compose exec -T postgres psql -U manifest -d manifest < /tmp/manifest_snapshot.sql
  rm -f /tmp/manifest_snapshot.sql

  echo "Restarting DR manifest..."
  dr_compose restart manifest

  echo "Snapshot complete. DR is now a copy of prod."
}

case "${1:-status}" in
  status)   status ;;
  prod)     switch_preset "manifest" ;;
  dev)      switch_preset "manifest-dr" ;;
  snapshot) snapshot ;;
  up)
    prod_compose up -d
    dr_compose up -d
    status
    ;;
  down)
    prod_compose down
    dr_compose down
    ;;
  rebuild)
    docker build -f "$REPO_DIR/docker/Dockerfile" -t manifestdotbuild/manifest:latest "$REPO_DIR"
    prod_compose up -d --force-recreate
    dr_compose up -d --force-recreate
    status
    ;;
  *)
    echo "Usage: $0 {status|prod|dev|snapshot|up|down|rebuild}"
    exit 1
    ;;
esac
