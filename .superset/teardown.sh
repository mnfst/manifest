#!/usr/bin/env bash
set -euo pipefail

# Drop the workspace-specific database
if [ -f .superset/.db_name ]; then
  DB_NAME=$(cat .superset/.db_name)
  docker exec postgres_db psql -U myuser -d postgres \
    -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
  echo "Dropped database: $DB_NAME"
fi
