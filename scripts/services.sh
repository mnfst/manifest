#!/usr/bin/env bash
# services.sh — Start or restart the Manifest Prod/Dev dual-stack services.
#
#   services.sh start     Start both stacks (prod 2099 + dev 2100)
#   services.sh restart   Restart both stacks (recreate containers, no image rebuild)
#   services.sh help      Show this help
#
# For image rebuilds (after code changes): ./scripts/switch-manifest.sh rebuild
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_DIR="$REPO_DIR/docker"
PROD_COMPOSE="$DOCKER_DIR/docker-compose.yml"
DEV_COMPOSE="$DOCKER_DIR/docker-compose.dev.yml"
PROD_ENV="$DOCKER_DIR/.env"
DEV_ENV="$DOCKER_DIR/.env.dev"

prod_compose() {
  docker compose -f "$PROD_COMPOSE" --project-directory "$DOCKER_DIR" --env-file "$PROD_ENV" "$@"
}

dev_compose() {
  docker compose -f "$DEV_COMPOSE" --project-directory "$DOCKER_DIR" --env-file "$DEV_ENV" "$@"
}

cmd_start() {
  echo "Starting prod (2099) + dev (2100)..."
  prod_compose up -d
  dev_compose up -d
}

cmd_restart() {
  echo "Restarting prod (2099) + dev (2100)..."
  prod_compose up -d --force-recreate
  dev_compose up -d --force-recreate
}

cmd_help() {
  cat <<'EOF'
services.sh — Start or restart Manifest Prod/Dev services

USAGE
  services.sh <command>

COMMANDS
  start      Start both stacks (prod 2099 + dev 2100). Safe to re-run.
  restart    Restart both stacks (recreate containers, no image rebuild).
  help       Show this help.

NOTE
  After code changes, rebuild the image first:
    ./scripts/switch-manifest.sh rebuild
EOF
}

case "${1:-help}" in
  start)        cmd_start ;;
  restart)      cmd_restart ;;
  help|-h|--help) cmd_help ;;
  *)
    echo "Unknown command: $1"
    echo "Run 'services.sh help' for usage."
    exit 1
    ;;
esac

echo ""
"$REPO_DIR/scripts/switch-manifest.sh" status
