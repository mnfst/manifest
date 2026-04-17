#!/usr/bin/env bash
# Manifest — self-host quick install
#
# Downloads the Docker Compose file and the `.env.example` template,
# generates a BETTER_AUTH_SECRET, writes it into a local `.env`, then
# brings up the stack. Designed for first-time self-hosters who want a
# one-command setup. After the stack is healthy, visit http://localhost:3001
# — the setup wizard walks you through creating the first admin account.
#
# Usage:
#   bash install.sh                  # install into ./manifest
#   bash install.sh --dir /opt/mnfst # install into a custom directory
#   bash install.sh --dry-run        # print what would happen, do nothing
#   bash install.sh --yes            # skip confirmation prompt
#
# Review before running:
#   curl -sSLO https://raw.githubusercontent.com/mnfst/manifest/main/docker/install.sh
#   less install.sh
#   bash install.sh
#
# If you trust the source, one-shot:
#   bash <(curl -sSL https://raw.githubusercontent.com/mnfst/manifest/main/docker/install.sh)

set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/mnfst/manifest/main/docker"
DEFAULT_DIR="./manifest"
INSTALL_DIR="$DEFAULT_DIR"
DRY_RUN=0
ASSUME_YES=0

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m  %s\n' "$*" >&2; exit 1; }

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '    \033[2m$ %s\033[0m\n' "$*"
  else
    "$@"
  fi
}

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)     INSTALL_DIR="${2:?--dir requires a path}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --yes|-y)  ASSUME_YES=1; shift ;;
    -h|--help) usage ;;
    *)         die "Unknown flag: $1 (use --help)" ;;
  esac
done

command -v docker >/dev/null 2>&1 \
  || die "docker not found. Install Docker first: https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 \
  || die "'docker compose' plugin not found. Upgrade Docker to a version that bundles Compose v2."
command -v curl >/dev/null 2>&1 || die "curl is required."

SECRET_TOOL=""
if command -v openssl >/dev/null 2>&1; then
  SECRET_TOOL="openssl"
elif [[ -r /dev/urandom ]]; then
  SECRET_TOOL="urandom"
else
  die "Need either openssl or /dev/urandom to generate a secret."
fi

if [[ -e "$INSTALL_DIR" && -n "$(ls -A "$INSTALL_DIR" 2>/dev/null || true)" ]]; then
  die "$INSTALL_DIR already exists and is not empty. Pass --dir to choose another location or remove it first."
fi

log "Manifest self-host installer"
printf '    Install directory: %s\n' "$INSTALL_DIR"
printf '    Source:            %s\n' "$REPO_RAW"
printf '    Mode:              %s\n' "$([[ $DRY_RUN -eq 1 ]] && echo 'dry-run (no changes)' || echo 'live install')"
echo

if [[ "$ASSUME_YES" -eq 0 && "$DRY_RUN" -eq 0 ]]; then
  read -r -p "Proceed? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || { warn "Aborted."; exit 1; }
fi

log "Creating install directory"
run mkdir -p "$INSTALL_DIR"

log "Downloading compose file"
if [[ "$DRY_RUN" -eq 1 ]]; then
  printf '    \033[2m$ curl -sSLf %s/docker-compose.yml -o %s/docker-compose.yml\033[0m\n' "$REPO_RAW" "$INSTALL_DIR"
else
  curl -sSLf "$REPO_RAW/docker-compose.yml" -o "$INSTALL_DIR/docker-compose.yml" \
    || die "Failed to download docker-compose.yml"
fi

log "Downloading .env.example"
ENV_PATH="$INSTALL_DIR/.env"
if [[ "$DRY_RUN" -eq 1 ]]; then
  printf '    \033[2m$ curl -sSLf %s/.env.example -o %s\033[0m\n' "$REPO_RAW" "$ENV_PATH"
else
  curl -sSLf "$REPO_RAW/.env.example" -o "$ENV_PATH" \
    || die "Failed to download .env.example"
fi

log "Generating BETTER_AUTH_SECRET"
if [[ "$DRY_RUN" -eq 1 ]]; then
  SECRET="<generated-at-install-time>"
  printf '    \033[2m$ openssl rand -hex 32\033[0m\n'
else
  case "$SECRET_TOOL" in
    openssl) SECRET="$(openssl rand -hex 32)" ;;
    urandom) SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')" ;;
  esac
fi

log "Writing secret into .env"
if [[ "$DRY_RUN" -eq 1 ]]; then
  printf '    \033[2m$ replace "BETTER_AUTH_SECRET=" → "BETTER_AUTH_SECRET=<generated>" in %s\033[0m\n' "$ENV_PATH"
else
  if ! grep -qE '^BETTER_AUTH_SECRET=$' "$ENV_PATH"; then
    die "Expected empty BETTER_AUTH_SECRET= line not found in $ENV_PATH — refusing to proceed."
  fi
  # Line-based rewrite — no sed, no quoting edge cases. openssl rand -hex
  # produces only [0-9a-f], so interpolation into the line is safe.
  new_content=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "BETTER_AUTH_SECRET=" ]]; then
      new_content+="BETTER_AUTH_SECRET=$SECRET"$'\n'
    else
      new_content+="$line"$'\n'
    fi
  done < "$ENV_PATH"
  printf '%s' "$new_content" > "$ENV_PATH"
  chmod 600 "$ENV_PATH"
fi

log "Starting the stack"
if [[ "$DRY_RUN" -eq 1 ]]; then
  printf '    \033[2m$ (cd %s && docker compose up -d)\033[0m\n' "$INSTALL_DIR"
else
  (cd "$INSTALL_DIR" && docker compose up -d) || die "docker compose up failed"
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Dry run complete. No changes made."
  exit 0
fi

log "Waiting for Manifest to become healthy (up to 120s)"
HEALTH_URL="http://127.0.0.1:3001/api/v1/health"
for _ in $(seq 1 24); do
  if curl -sSf "$HEALTH_URL" >/dev/null 2>&1; then
    log "Manifest is up."
    cat <<EOF

  Open:   http://localhost:3001
  Setup:  the first visit walks you through creating your admin account.
  Config: $INSTALL_DIR/.env  (BETTER_AUTH_SECRET, OAuth keys, email provider)

  Note:   Port 3001 is bound to 127.0.0.1 only. To expose on your LAN,
          edit $INSTALL_DIR/docker-compose.yml and change the ports line
          from "127.0.0.1:3001:3001" to "3001:3001", then update
          BETTER_AUTH_URL in .env to match the host you'll access it on.

  Stop:  (cd $INSTALL_DIR && docker compose down)
  Wipe:  (cd $INSTALL_DIR && docker compose down -v)
EOF
    exit 0
  fi
  sleep 5
done

warn "Manifest did not become healthy within 120s. Check logs with:"
warn "  (cd $INSTALL_DIR && docker compose logs -f manifest)"
exit 1
