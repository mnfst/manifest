#!/usr/bin/env bash
set -euo pipefail

if ! command -v fly >/dev/null 2>&1; then
  echo "fly CLI is required. Install it from https://fly.io/docs/flyctl/install/" >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate Manifest secrets." >&2
  exit 1
fi

if ! fly auth whoami >/dev/null 2>&1; then
  echo "Run 'fly auth login' before deploying." >&2
  exit 1
fi

APP_NAME="${FLY_APP_NAME:-manifest-$(openssl rand -hex 3)}"
POSTGRES_APP_NAME="${FLY_POSTGRES_APP_NAME:-${APP_NAME}-db}"
REGION="${FLY_REGION:-cdg}"
ORG="${FLY_ORG:-personal}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$(mktemp "${TMPDIR:-/tmp}/manifest-fly.XXXXXX.toml")"

cleanup() {
  rm -f "$CONFIG_FILE"
}
trap cleanup EXIT

secret_exists() {
  local secret_name="$1"
  fly secrets list --app "$APP_NAME" | awk 'NR > 1 { print $1 }' | grep -Fxq "$secret_name"
}

sed \
  -e "s/manifest-example/${APP_NAME}/g" \
  -e "s/primary_region = \"cdg\"/primary_region = \"${REGION}\"/" \
  "$SCRIPT_DIR/fly.toml" > "$CONFIG_FILE"

echo "Creating Fly app ${APP_NAME} in org ${ORG}..."
if ! fly status --app "$APP_NAME" >/dev/null 2>&1; then
  fly apps create "$APP_NAME" --org "$ORG" -y
else
  echo "Fly app ${APP_NAME} already exists."
fi

echo "Creating Fly Postgres app ${POSTGRES_APP_NAME} in ${REGION}..."
if ! fly status --app "$POSTGRES_APP_NAME" >/dev/null 2>&1; then
  fly postgres create \
    --name "$POSTGRES_APP_NAME" \
    --org "$ORG" \
    --region "$REGION" \
    --initial-cluster-size 1 \
    --vm-cpu-kind shared \
    --vm-cpus 1 \
    --vm-memory 512 \
    --volume-size 1
else
  echo "Fly Postgres app ${POSTGRES_APP_NAME} already exists."
fi

echo "Attaching Postgres to ${APP_NAME}..."
fly postgres attach "$POSTGRES_APP_NAME" \
  --app "$APP_NAME" \
  --database-name manifest \
  --database-user manifest \
  --yes

echo "Setting Manifest secrets..."
manifest_secret_args=(--app "$APP_NAME" --stage)

if secret_exists "BETTER_AUTH_SECRET"; then
  echo "BETTER_AUTH_SECRET already exists; leaving it unchanged."
else
  manifest_secret_args+=("BETTER_AUTH_SECRET=$(openssl rand -hex 32)")
fi

if secret_exists "MANIFEST_ENCRYPTION_KEY"; then
  echo "MANIFEST_ENCRYPTION_KEY already exists; leaving it unchanged."
else
  manifest_secret_args+=("MANIFEST_ENCRYPTION_KEY=$(openssl rand -hex 32)")
fi

if [ "${#manifest_secret_args[@]}" -gt 3 ]; then
  fly secrets set "${manifest_secret_args[@]}"
else
  echo "Manifest secrets already exist."
fi

echo "Deploying Manifest..."
fly deploy --app "$APP_NAME" --config "$CONFIG_FILE"

echo
echo "Manifest URL: https://${APP_NAME}.fly.dev"
echo "Health check: https://${APP_NAME}.fly.dev/api/v1/health"
