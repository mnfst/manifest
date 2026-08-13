---
name: manifest-dev
description: Manage the Manifest Prod/Dev dual-stack setup (prod 2099 / dev 2100). Use when the user asks to switch between prod and dev, snapshot the database, check stack status, rebuild containers, or anything related to the dev environment protocol.
---

# Manifest Dev Protocol

Two Manifest instances run side-by-side on the same host:

| Stack | Port | Healer | DB Volume | Docker Project |
|-------|------|--------|-----------|----------------|
| Prod  | 2099 | 3100   | `manifest_pgdata` | `mnfst` |
| Dev   | 2100 | 3101   | `manifest_dev_pgdata` | `mnfst-dev` |

**Rule:** All development happens on Dev (2100). Prod (2099) is stable and snapshotted into Dev when ready.

## File Locations

```
/root/.paseo/worktrees/1p7riqru/evil-husky/
├── docker/
│   ├── docker-compose.yml       # prod compose
│   ├── docker-compose.dev.yml   # dev compose
│   ├── .env                     # prod env (gitignored)
│   └── .env.dev                 # dev env (gitignored)
├── scripts/
│   └── switch-manifest.sh       # management script
└── healer/                      # healer source (shared by both stacks)
```

## Switch Script

Location: `scripts/switch-manifest.sh` (relative to repo root)

```bash
# Check both stacks + active OpenCode preset
./scripts/switch-manifest.sh status

# Switch OpenCode preset (restart OpenCode after)
./scripts/switch-manifest.sh dev      # → manifest-dev preset (2100)
./scripts/switch-manifest.sh prod     # → manifest preset (2099)

# Copy prod DB into Dev (replaces entire Dev database)
./scripts/switch-manifest.sh snapshot

# Lifecycle
./scripts/switch-manifest.sh up       # start both
./scripts/switch-manifest.sh down     # stop both
./scripts/switch-manifest.sh rebuild  # rebuild image + restart both

# Help
./scripts/switch-manifest.sh help
```

## OpenCode Config

Provider definitions in `~/.config/opencode/opencode.jsonc`:
- `manifest` → `http://100.69.158.7:2099/v1` (prod)
- `manifest-dev` → `http://100.69.158.7:2100/v1` (dev)

Preset definitions in `~/.config/opencode/oh-my-opencode-slim.jsonc`:
- `manifest` — tiered models (auto-simple/standard/complex/vision) via prod
- `manifest-dev` — same tiered models via Dev
- `opencode-go` — fallback direct provider

## Docker Commands (Direct)

If the switch script isn't available, run from the repo root:

```bash
REPO=/root/.paseo/worktrees/1p7riqru/evil-husky

# Prod
docker compose -f $REPO/docker/docker-compose.yml \
  --project-directory $REPO/docker --env-file $REPO/docker/.env up -d

# Dev
docker compose -f $REPO/docker/docker-compose.dev.yml \
  --project-directory $REPO/docker --env-file $REPO/docker/.env.dev up -d

# Dev postgres is on the same host port as prod (5432 is internal only).
# Both stacks use isolated Docker networks (mnfst_internal vs mnfst-dev_internal).
```

## Typical Workflow

1. **Start developing:** `switch-manifest.sh dev` → restart OpenCode
2. **Test changes:** send requests to `http://100.69.158.7:2100/v1`
3. **When stable:** `switch-manifest.sh snapshot` or promote
4. **After code changes:** `switch-manifest.sh rebuild`

## Snapshot Details

The snapshot uses `pg_dump -Fc` (custom format) for reliable binary transfer:
1. Stops Dev manifest (releases DB connections)
2. Dumps prod DB to `/tmp/prod.dump`
3. Copies dump into Dev postgres container
4. Drops + recreates Dev database
5. Restores via `pg_restore`
6. Starts Dev manifest + health check
