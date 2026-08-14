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

## Worktree Stacks (Isolation by Default)

Three tiers of Manifest stacks coexist on the host:

| Tier | Project | Port | Image | DB Volume | Managed by |
|------|---------|------|-------|-----------|------------|
| Prod | `mnfst` | 2099 | `manifestdotbuild/manifest:latest` | `manifest_pgdata` | `switch-manifest.sh` |
| Dev | `mnfst-dev` | 2100 | `MANIFEST_VERSION` from `docker/.env.dev` | `manifest_dev_pgdata` | `switch-manifest.sh` |
| Feature worktree | `mnfst-wt-<slug>` | 2100+N | `manifestdotbuild/manifest:<slug>` | `manifest_wt_<slug>_pgdata` | `worktree-stack.sh` |

- **Prod 2099** — released main, untouched by feature work.
- **Dev 2100** — the always-on safe test bed and daily driver (`switch-manifest.sh dev`).
- **Feature worktrees** — EVERY feature worktree gets its own disposable, isolated stack by default, so parallel lanes never interfere with each other or with dev. Containers are `mnfst-wt-<slug>-manifest-1`, `mnfst-wt-<slug>-postgres-1`, `mnfst-wt-<slug>-healer-1`.

**Naming scheme:** slug = sanitized worktree-dir basename (`[a-z0-9-]`, `--slug` overrides). Port slot N is the lowest free integer in 2..99 (skipping bound/taken ports); manifest = `2100+N`, healer = `3100+N`. Volumes: `manifest_wt_<slug>_pgdata`, `manifest_wt_<slug>_request_recordings`. Slot allocation is recorded in `docker/.worktree-stacks.json` (gitignored) and guarded with `flock`; `down` frees the slot.

**Bind address:** `HOST_BIND_ADDRESS` is forced to the host's live Tailscale IP (`tailscale ip -4`, fallback `100.69.158.7`) in the generated per-stack env, so every test stack is reachable over the tailnet (e.g. `http://100.69.158.7:2102/v1`) — never just localhost, regardless of what a worktree's own `.env.dev` says.

**Commands** (run from the worktree's repo root):

```bash
# Start an isolated stack for a worktree (snapshot = DEFAULT: copies prod DB in)
./scripts/worktree-stack.sh up ../other-worktree --slug mylane            # with prod-DB snapshot
./scripts/worktree-stack.sh up ../other-worktree --slug mylane --no-snapshot  # fresh empty DB
./scripts/worktree-stack.sh up . --slug scratchtest --no-snapshot

# Rebuild image from the worktree source + recreate stack (DB volume retained)
./scripts/worktree-stack.sh rebuild mylane

# Status table (ports, branch, worktree, health; orphans flagged) + prod/dev one-liner
./scripts/worktree-stack.sh status

# Teardown — stops containers, removes generated files, frees the slot
./scripts/worktree-stack.sh down mylane
# ...and delete the stack's volumes too
./scripts/worktree-stack.sh down mylane --purge-volume

# Follow the stack's manifest logs
./scripts/worktree-stack.sh logs mylane

# Help
./scripts/worktree-stack.sh help
```

**Safety:** worktree stacks never touch prod/dev containers, volumes, or images; only the project names prefixed `mnfst-wt-` are ever created/managed. The gitignored `docker/.env.dev` is read from the worktree (falling back to the repo's main checkout) and copied into `docker/.env.wt-<slug>` with PORT / HEALER_PORT / MANIFEST_VERSION / BETTER_AUTH_URL / HOST_BIND_ADDRESS overridden.

**Login:** every stack (and Dev after each `snapshot`) is seeded with `admin@manifest.local` / `admin1234` (product enforces an 8-char min password). Override with `WT_ADMIN_EMAIL` / `WT_ADMIN_PASSWORD`; skip per-stack with `--no-admin`. Fresh DBs go through `POST /api/v1/setup/admin` (first admin); snapshotted DBs use `POST /api/auth/sign-up/email` since prod users already exist.

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
