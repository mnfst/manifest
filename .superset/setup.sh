#!/usr/bin/env bash
set -euo pipefail

# ── Dependencies ──────────────────────────────────────
npm install

# ── PostgreSQL via Docker ─────────────────────────────
# Ensure the shared postgres_db container is running
docker start postgres_db 2>/dev/null || \
  docker run -d --name postgres_db \
    -e POSTGRES_USER=myuser \
    -e POSTGRES_PASSWORD=mypassword \
    -e POSTGRES_DB=mydatabase \
    -p 5432:5432 postgres:16

# Wait for PostgreSQL to accept connections
for i in $(seq 1 30); do
  docker exec postgres_db pg_isready -U myuser -q 2>/dev/null && break
  sleep 1
done

# Create a unique database for this workspace
DB_NAME="manifest_$(openssl rand -hex 4)"
docker exec postgres_db psql -U myuser -d postgres -c "CREATE DATABASE $DB_NAME;" >/dev/null

# ── Backend .env ──────────────────────────────────────
ENV_FILE="packages/backend/.env"

if [ -f "$SUPERSET_ROOT_PATH/packages/backend/.env" ]; then
  # Copy from root repo if it exists (preserves OAuth keys, etc.)
  cp "$SUPERSET_ROOT_PATH/packages/backend/.env" "$ENV_FILE"
  # Override DATABASE_URL to point to the fresh database
  if grep -q '^DATABASE_URL=' "$ENV_FILE"; then
    sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/$DB_NAME|" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
  else
    echo "DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/$DB_NAME" >> "$ENV_FILE"
  fi
else
  # Generate a fresh .env from scratch
  cat > "$ENV_FILE" <<EOF
PORT=3001
BIND_ADDRESS=127.0.0.1
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3001
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/$DB_NAME
API_KEY=dev-api-key-$(openssl rand -hex 8)
SEED_DATA=true
EOF
fi

# Persist the DB name for teardown
echo "$DB_NAME" > .superset/.db_name

echo "Setup complete. Database: $DB_NAME"
