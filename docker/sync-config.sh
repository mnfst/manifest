#!/usr/bin/env bash
# sync-config.sh — Copy WIP config (users, agents, providers, routing) to DR.
#
# Usage:
#   ./sync-config.sh              # dry run (show what would copy)
#   ./sync-config.sh --apply      # actually copy
#
# Safe to run multiple times. Only copies config tables, not telemetry/billing.

set -euo pipefail
cd "$(dirname "$0")"

WIP_PROJECT="mnfst"
DR_PROJECT="mnfst-dr"
WIP_DB="mnfst-postgres-1"
DR_DB="mnfst-dr-postgres-1"
DB_USER="manifest"
DB_NAME="manifest"

# Tables to copy, in foreign-key order
# Skipped: requests, agent_messages, migrations, install_metadata,
#          billing_*, notification_*, cost_snapshots, backfill_state,
#          email_provider_configs (instance-specific)
TABLES=(
  tenants
  "user"
  account
  session
  api_keys
  agents
  agent_api_keys
  tenant_providers
  agent_enabled_providers
  tier_assignments
  header_tiers
  agent_model_params
  custom_providers
)

red()   { printf '\033[1;31m%s\033[0m\n' "$*"; }
green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[1;33m%s\033[0m\n' "$*"; }
dim()   { printf '\033[2m%s\033[0m\n' "$*"; }

# ── Preflight ──────────────────────────────────────────────────────────────

check_running() {
  if ! docker ps --format '{{.Names}}' | grep -q "^${WIP_DB}$"; then
    red "✗  WIP postgres ($WIP_DB) not running"
    exit 1
  fi
  if ! docker ps --format '{{.Names}}' | grep -q "^${DR_DB}$"; then
    red "✗  DR postgres ($DR_DB) not running"
    exit 1
  fi
}

# ── Copy one table ─────────────────────────────────────────────────────────

copy_table() {
  local table="$1"
  local wip_count dr_count

  wip_count=$(docker exec "$WIP_DB" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM \"${table}\";" 2>/dev/null | tr -d ' ')

  if [[ -z "$wip_count" || "$wip_count" == "0" ]]; then
    dim "   ${table}: empty in WIP, skipping"
    return 0
  fi

  dr_count=$(docker exec "$DR_DB" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM \"${table}\";" 2>/dev/null | tr -d ' ')

  if [[ "$wip_count" == "$dr_count" ]]; then
    dim "   ${table}: ${wip_count} rows (already synced)"
    return 0
  fi

  if [[ "$DRY" == "1" ]]; then
    yellow "   ${table}: WIP=${wip_count} DR=${dr_count} → would copy"
    return 0
  fi

  # Truncate DR table (clear stale data) then import from WIP
  docker exec "$DR_DB" psql -U "$DB_USER" -d "$DB_NAME" -c \
    "TRUNCATE \"${table}\" CASCADE;" >/dev/null 2>&1

  docker exec "$WIP_DB" pg_dump -U "$DB_USER" -d "$DB_NAME" -t "${table}" --data-only 2>/dev/null \
    | docker exec -i "$DR_DB" psql -U "$DB_USER" -d "$DB_NAME" -q 2>&1 | grep -v "^$"

  green "   ${table}: ${wip_count} rows copied"
}

# ── Main ───────────────────────────────────────────────────────────────────

DRY=1
[[ "${1:-}" == "--apply" ]] && DRY=0

echo ""
if [[ "$DRY" == "1" ]]; then
  yellow "── DRY RUN (no changes) ──"
  dim "   Use --apply to actually copy"
else
  yellow "── SYNC WIP → DR ──"
fi
echo ""

check_running

echo ""
for table in "${TABLES[@]}"; do
  copy_table "$table"
done

echo ""
if [[ "$DRY" == "1" ]]; then
  dim "Run with --apply to execute"
else
  green "✓  Config synced. Restart DR manifest to pick up changes."
  dim "   docker compose -f docker-compose.dr.yml --env-file .env.dr restart manifest"
fi
echo ""
