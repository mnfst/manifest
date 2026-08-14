#!/usr/bin/env bash
# worktree-stack.sh — Per-worktree disposable Manifest Docker stacks.
#
# Every feature worktree gets its OWN isolated Manifest stack by default so
# parallel lanes never interfere with each other or with the always-on
# Prod (2099) / Dev (2100) stacks.
#
#   worktree-stack.sh up <worktree-dir> [--slug <name>] [--snapshot|--no-snapshot] [--rebuild]
#   worktree-stack.sh down <slug> [--purge-volume]
#   worktree-stack.sh rebuild <slug>
#   worktree-stack.sh status [slug]
#   worktree-stack.sh logs <slug>
#   worktree-stack.sh help
#
# Isolation scheme (per slug):
#   project     mnfst-wt-<slug>              (container names mnfst-wt-<slug>-*-1)
#   image       manifestdotbuild/manifest:<slug>
#   volumes     manifest_wt_<slug>_pgdata, manifest_wt_<slug>_request_recordings
#   manifest    http://<HOST_BIND_ADDRESS>:2100+N   (lowest free N in 2..99)
#   healer      <HOST_BIND_ADDRESS>:3100+N
#
# State: docker/.worktree-stacks.json (gitignored), guarded with flock so
# concurrent agents cannot collide on slot allocation.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCKER_DIR="$REPO_DIR/docker"
STATE_FILE="$DOCKER_DIR/.worktree-stacks.json"
DEFAULT_BIND="100.69.158.7"
SLUG_RE='^[a-z0-9][a-z0-9-]*$'

# ── helpers ──────────────────────────────────────────────────────────────

die() { echo "ERROR: $*" >&2; exit 1; }

slugify() {
  local s="$1"
  s="$(printf '%s' "$s" | tr '[:upper:]' '[:lower:]')"
  s="$(printf '%s' "$s" | sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-*//; s/-*$//')"
  printf '%s' "$s"
}

validate_slug() {
  local s="$1"
  [[ -n "$s" ]] || die "empty slug"
  [[ "$s" =~ $SLUG_RE ]] || die "invalid slug '$s' (must match [a-z0-9-])"
}

# port_bound <port> — 0 if something is listening on <port> (any interface).
port_bound() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    if ss -ltnH 2>/dev/null | awk -v p="$port" '{ n=split($4,a,":"); if (a[n]==p) { found=1 } } END { exit !found }'; then
      return 0
    fi
    return 1
  fi
  # fallback: raw connect attempts on loopback and the default bind address
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then return 0; fi
  if (exec 3<>"/dev/tcp/$DEFAULT_BIND/$port") 2>/dev/null; then return 0; fi
  return 1
}

# ── state file (docker/.worktree-stacks.json) ────────────────────────────
# Structure: { "slots": { "<slug>": { "manifest_port": N, "healer_port": N,
#   "worktree": "/abs/path", "branch": "name", "project": "mnfst-wt-<slug>",
#   "created": "<iso>" } } }

state_get() {  # $1 slug → prints the slot JSON (or nothing)
  python3 - "$STATE_FILE" "$1" <<'PY'
import json, sys
try:
    with open(sys.argv[1]) as f:
        d = json.load(f)
except Exception:
    sys.exit(0)
s = d.get("slots", {}).get(sys.argv[2])
if s:
    print(json.dumps(s))
PY
}

state_set() {  # $1 slug, $2 slot JSON object, or "null" to delete the entry
  python3 - "$STATE_FILE" "$1" "$2" <<'PY'
import json, os, sys
path, slug, slot = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    with open(path) as f:
        d = json.load(f)
except Exception:
    d = {}
d.setdefault("slots", {})
if slot == "null":
    d["slots"].pop(slug, None)
else:
    d["slots"][slug] = json.loads(slot)
tmp = path + ".tmp"
with open(tmp, "w") as f:
    json.dump(d, f, indent=2, sort_keys=True)
    f.write("\n")
# Write in place (no rename): the flock in this script is held on the inode
# opened by lock_state, so a rename here would silently drop the lock.
# Opening "w" truncates in place, preserving the same inode.
with open(path, "w") as f:
    f.write(open(tmp).read())
os.unlink(tmp)
PY
}

state_all() {  # prints tab-separated lines: slug mp hp branch wt created
  python3 - "$STATE_FILE" <<'PY'
import json, sys
try:
    with open(sys.argv[1]) as f:
        d = json.load(f)
except Exception:
    sys.exit(0)
for slug, s in sorted(d.get("slots", {}).items()):
    print("\t".join([slug,
                     str(s.get("manifest_port", "")),
                     str(s.get("healer_port", "")),
                     str(s.get("branch", "")),
                     str(s.get("worktree", "")),
                     str(s.get("created", ""))]))
PY
}

slot_field() {  # $1 slug, $2 field → prints value (or nothing)
  local json
  json="$(state_get "$1")"
  [[ -n "$json" ]] || return 0
  python3 -c 'import json,sys; d=json.loads(sys.argv[1]); print(d.get(sys.argv[2], ""))' "$json" "$2"
}

slot_worktree() { slot_field "$1" worktree; }

slot_taken_by_other() {  # $1 slug, $2 manifest port → 0 if another slug holds it
  local slug="$1" mp="$2"
  python3 - "$STATE_FILE" "$slug" "$mp" <<'PY'
import json, sys
try:
    with open(sys.argv[1]) as f:
        d = json.load(f)
except Exception:
    sys.exit(1)
needle = int(sys.argv[3])
for s, v in d.get("slots", {}).items():
    if s != sys.argv[2] and int(v.get("manifest_port", 0)) == needle:
        sys.exit(0)
sys.exit(1)
PY
}

lock_state() { exec 9<>"$STATE_FILE"; flock 9; }  # <> = O_RDWR|O_CREAT, no truncate
unlock_state() { flock -u 9 2>/dev/null || true; }

# allocate_slot <slug> — prints "manifest_port healer_port"; reuses the slug's
# recorded slot if present, otherwise picks the lowest free N in 2..99 where
# neither 2100+N nor 3100+N is bound on the host or taken by another slug.
allocate_slot() {
  local slug="$1" n mp hp cur
  cur="$(state_get "$slug")"
  if [[ -n "$cur" ]]; then
    mp="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("manifest_port", ""))' "$cur")"
    hp="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("healer_port", ""))' "$cur")"
    printf '%s %s' "$mp" "$hp"
    return 0
  fi
  for ((n=2; n<=99; n++)); do
    mp=$((2100+n)); hp=$((3100+n))
    port_bound "$mp" && continue
    port_bound "$hp" && continue
    slot_taken_by_other "$slug" "$mp" && continue
    printf '%s %s' "$mp" "$hp"
    return 0
  done
  die "no free port slot in 2102..2199 / 3102..3199 — all taken or bound on host"
}

# ── env / compose file helpers ───────────────────────────────────────────

# find_env_dev <wt> — the gitignored .env.dev is only present in the repo's
# main checkout; fall back to it when the worktree lacks one.
find_env_dev() {
  local wt="$1"
  if [[ -f "$wt/docker/.env.dev" ]]; then
    printf '%s\n' "$wt/docker/.env.dev"
    return 0
  fi
  local main
  main="$(git -C "$wt" worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p' | head -n1 || true)"
  if [[ -n "$main" && -f "$main/docker/.env.dev" ]]; then
    echo "NOTE: $wt/docker/.env.dev not found; using base env $main/docker/.env.dev" >&2
    printf '%s\n' "$main/docker/.env.dev"
    return 0
  fi
  return 1
}

# resolve_bind_address — the host IP test stacks publish on. Prefers the live
# Tailscale IP so test containers are reachable over the tailnet (not just
# localhost); falls back to the pinned DEFAULT_BIND with a warning.
resolve_bind_address() {
  local ip=""
  if command -v tailscale >/dev/null 2>&1; then
    ip="$(tailscale ip -4 2>/dev/null | head -n1 || true)"
  fi
  if [[ -z "$ip" ]]; then
    echo "WARNING: no Tailscale IP detected — binding to $DEFAULT_BIND; test stacks will be unreachable over the tailnet if that interface is down." >&2
    printf '%s\n' "$DEFAULT_BIND"
    return 0
  fi
  printf '%s\n' "$ip"
}

# write_stack_files <wt> <slug> <manifest_port> <healer_port> <bind_addr>
write_stack_files() {
  local wt="$1" slug="$2" mp="$3" hp="$4" bind="$5"
  local base_env env_file override_file
  base_env="$(find_env_dev "$wt")" || die "no .env.dev found for $wt (needed for secrets/ports)"
  env_file="$wt/docker/.env.wt-$slug"
  override_file="$wt/docker/docker-compose.wt-$slug.yml"
  echo "Generating $env_file (base: $(basename "$base_env")) ..."
  cp "$base_env" "$env_file"
  for k in PORT HEALER_PORT MANIFEST_VERSION BETTER_AUTH_URL HOST_BIND_ADDRESS; do
    sed -i "/^${k}=/d" "$env_file"
  done
  {
    echo ""
    echo "# worktree-stack.sh overrides for slug '$slug'"
    echo "PORT=$mp"
    echo "HEALER_PORT=$hp"
    echo "MANIFEST_VERSION=$slug"
    echo "BETTER_AUTH_URL=http://$bind:$mp"
    echo "HOST_BIND_ADDRESS=$bind"
  } >> "$env_file"
  echo "Generating $override_file ..."
  cat > "$override_file" <<EOF
# Generated by worktree-stack.sh for slug '$slug' — do not edit.
# Renames the two pinned dev volumes so this stack is fully isolated.
# Project/ports/image flow through -p and the per-stack env file.
volumes:
  pgdata:
    name: manifest_wt_${slug}_pgdata
  recordings:
    name: manifest_wt_${slug}_request_recordings
EOF
}

# ensure_stack_files <slug> — regenerate per-stack files from state if missing.
ensure_stack_files() {
  local slug="$1" wt mp hp bind
  wt="$(slot_worktree "$slug")"
  mp="$(slot_field "$slug" manifest_port)"
  hp="$(slot_field "$slug" healer_port)"
  [[ -n "$wt" && -n "$mp" && -n "$hp" ]] || die "no usable state for slug '$slug'"
  if [[ ! -f "$wt/docker/.env.wt-$slug" || ! -f "$wt/docker/docker-compose.wt-$slug.yml" ]]; then
    echo "Regenerating stack files for $slug ..."
    bind="$(resolve_bind_address)"
    write_stack_files "$wt" "$slug" "$mp" "$hp" "$bind"
  fi
}

# wt_compose <slug> rest-args — the one true compose invocation for a stack.
# Echoes the full command when WT_VERBOSE=1.
wt_compose() {
  local slug="$1"; shift
  local wt
  wt="$(slot_worktree "$slug")"
  [[ -n "$wt" && -d "$wt" ]] || die "worktree for slug '$slug' not found ($wt)"
  local -a cmd=(docker compose \
    -f "$wt/docker/docker-compose.dev.yml" \
    -f "$wt/docker/docker-compose.wt-$slug.yml" \
    --env-file "$wt/docker/.env.wt-$slug" \
    --project-directory "$wt/docker" \
    -p "mnfst-wt-$slug" "$@")
  if [[ "${WT_VERBOSE:-0}" == "1" ]]; then
    printf '  + %q ' "${cmd[@]}"; echo
  fi
  "${cmd[@]}"
}

is_running() {  # $1 slug
  local slug="$1"
  docker ps -q -f "name=^mnfst-wt-$slug-manifest-1$" 2>/dev/null | grep -q .
}

wait_healthy() {  # <manifest_port> <bind_addr>
  local port="$1" bind_addr="$2" attempts="${3:-24}" i code="000"
  echo "Health check: http://$bind_addr:$port/api/v1/health ..."
  for ((i=1; i<=attempts; i++)); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://$bind_addr:$port/api/v1/health" 2>/dev/null || echo 000)"
    if [[ "$code" == "200" ]]; then
      echo "  ✓ healthy (HTTP 200) after ~$((i*5))s"
      return 0
    fi
    [[ "$i" -lt "$attempts" ]] && sleep 5
  done
  echo "ERROR: manifest not healthy on port $port (last HTTP $code)" >&2
  return 1
}

# snapshot_from_prod <slug> — copy prod DB into this stack (read-only on prod).
snapshot_from_prod() {
  local slug="$1"
  local ctr="mnfst-wt-$slug-manifest-1" pg="mnfst-wt-$slug-postgres-1"
  local dump="/tmp/wt-$slug-prod.dump"
  docker inspect mnfst-postgres-1 >/dev/null 2>&1 || die "prod postgres (mnfst-postgres-1) not running — cannot snapshot"
  echo "Snapshot: prod DB (mnfst-postgres-1) → $ctr (read-only on prod)"
  echo "  Stopping $ctr ..."
  docker stop "$ctr" >/dev/null 2>&1 || true
  sleep 2
  echo "  Dumping prod DB (pg_dump -Fc) ..."
  docker exec mnfst-postgres-1 pg_dump -U manifest -Fc manifest > "$dump"
  echo "  Copying dump into $pg ..."
  docker cp "$dump" "$pg:/tmp/prod.dump"
  echo "  Recreating manifest database ..."
  docker exec "$pg" psql -U manifest -d postgres -c "DROP DATABASE IF EXISTS manifest;"
  docker exec "$pg" psql -U manifest -d postgres -c "CREATE DATABASE manifest OWNER manifest;"
  echo "  Restoring ..."
  docker exec "$pg" pg_restore -U manifest -d manifest /tmp/prod.dump 2>/dev/null || true
  echo "  Starting $ctr ..."
  docker start "$ctr"
  rm -f "$dump"
}

stack_volume_names() {  # <slug> → actual volume names (from compose config)
  local slug="$1" wt names=""
  wt="$(slot_worktree "$slug")"
  if [[ -d "$wt" && -f "$wt/docker/docker-compose.wt-$slug.yml" && -f "$wt/docker/.env.wt-$slug" ]]; then
    if command -v jq >/dev/null 2>&1; then
      names="$(docker compose -f "$wt/docker/docker-compose.dev.yml" -f "$wt/docker/docker-compose.wt-$slug.yml" \
        --env-file "$wt/docker/.env.wt-$slug" --project-directory "$wt/docker" -p "mnfst-wt-$slug" \
        config --format json 2>/dev/null | jq -r '.volumes[].name' | grep '^manifest_wt_' || true)"
    else
      names="$(docker compose -f "$wt/docker/docker-compose.dev.yml" -f "$wt/docker/docker-compose.wt-$slug.yml" \
        --env-file "$wt/docker/.env.wt-$slug" --project-directory "$wt/docker" -p "mnfst-wt-$slug" \
        config 2>/dev/null | grep -E '^    name: manifest_wt_' | awk '{print $2}' || true)"
    fi
  fi
  if [[ -z "$names" ]]; then
    names="manifest_wt_${slug}_pgdata manifest_wt_${slug}_request_recordings"
  fi
  printf '%s\n' "$names"
}

stack_container_status() {  # <slug> <wt> → "svc=status svc=status ..."
  local slug="$1" wt="$2" out=""
  if [[ -d "$wt" && -f "$wt/docker/docker-compose.wt-$slug.yml" && -f "$wt/docker/.env.wt-$slug" ]]; then
    out="$(docker compose -f "$wt/docker/docker-compose.dev.yml" -f "$wt/docker/docker-compose.wt-$slug.yml" \
      --env-file "$wt/docker/.env.wt-$slug" --project-directory "$wt/docker" -p "mnfst-wt-$slug" \
      ps --format '{{.Service}}={{.Status}}' 2>/dev/null | tr '\n' ' ' || true)"
  fi
  if [[ -z "$out" ]]; then
    out="$(docker ps -f "name=^mnfst-wt-$slug-" --format '{{.Names}}={{.Status}}' | tr '\n' ' ' || true)"
  fi
  printf '%s' "$out"
}

# ── commands ─────────────────────────────────────────────────────────────

cmd_up() {
  local wt_dir="" slug="" do_snapshot=1 do_rebuild=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --slug)
        shift
        [[ $# -gt 0 ]] || die "--slug requires a value"
        slug="$1"
        ;;
      --snapshot)      do_snapshot=1 ;;
      --no-snapshot)   do_snapshot=0 ;;
      --rebuild)       do_rebuild=1 ;;
      -h|--help)       cmd_help; return 0 ;;
      -*)              die "unknown option: $1" ;;
      *)
        if [[ -z "$wt_dir" ]]; then wt_dir="$1"; else die "unexpected argument: $1"; fi
        ;;
    esac
    shift
  done
  [[ -n "$wt_dir" ]] || die "usage: worktree-stack.sh up <worktree-dir> [--slug <name>] [--snapshot|--no-snapshot] [--rebuild]"

  local WT
  WT="$(cd "$wt_dir" 2>/dev/null && pwd)" || die "worktree directory not found: $wt_dir"
  [[ -f "$WT/docker/docker-compose.dev.yml" ]] || die "no docker/docker-compose.dev.yml in $WT — not a Manifest checkout?"
  [[ -n "$slug" ]] || slug="$(slugify "$(basename "$WT")")"
  validate_slug "$slug"

  local bind_addr mp hp alloc was_running=0
  bind_addr="$(resolve_bind_address)"

  # Allocate/reuse the slot under flock so concurrent agents cannot collide.
  lock_state
  is_running "$slug" && was_running=1
  if [[ "$was_running" == 1 && "$do_rebuild" == 0 ]]; then
    unlock_state
    die "stack mnfst-wt-$slug is already running — use --rebuild to rebuild it, or 'down $slug' first"
  fi

  if [[ -n "$(state_get "$slug")" ]]; then
    mp="$(slot_field "$slug" manifest_port)"
    hp="$(slot_field "$slug" healer_port)"
    if [[ "$was_running" == 0 ]] && { port_bound "$mp" || port_bound "$hp"; }; then
      unlock_state
      die "recorded ports $mp/$hp for '$slug' are bound by another process — run 'down $slug' to release the slot first"
    fi
  else
    alloc="$(allocate_slot "$slug")"
    [[ -n "$alloc" ]] || die "port allocation failed for '$slug'"
    mp="${alloc%% *}"; hp="${alloc##* }"
  fi

  state_set "$slug" "{\"manifest_port\": $mp, \"healer_port\": $hp, \"worktree\": \"$WT\", \"branch\": \"$(git -C "$WT" branch --show-current 2>/dev/null || echo unknown)\", \"project\": \"mnfst-wt-$slug\", \"created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
  unlock_state

  # Build the manifest image from this worktree's source (skip if present).
  if [[ "$do_rebuild" == 1 ]] || ! docker image inspect "manifestdotbuild/manifest:$slug" >/dev/null 2>&1; then
    echo "Building image manifestdotbuild/manifest:$slug from $WT ..."
    docker build -f "$WT/docker/Dockerfile" -t "manifestdotbuild/manifest:$slug" "$WT"
  else
    echo "Image manifestdotbuild/manifest:$slug already exists (use --rebuild to rebuild)."
  fi

  write_stack_files "$WT" "$slug" "$mp" "$hp" "$bind_addr"

  echo "Starting stack mnfst-wt-$slug (manifest :$mp, healer :$hp) ..."
  WT_VERBOSE=1 wt_compose "$slug" up -d
  wait_healthy "$mp" "$bind_addr"

  if [[ "$do_snapshot" == 1 ]]; then
    if [[ "$was_running" == 0 ]]; then
      snapshot_from_prod "$slug"
      wait_healthy "$mp" "$bind_addr"
    else
      echo "Skipping snapshot (stack was already running; its DB is preserved)."
    fi
  fi
  echo "✓ Stack mnfst-wt-$slug is up: http://$bind_addr:$mp (healer :$hp)"
}

cmd_down() {
  local slug="" purge=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --purge-volume)  purge=1 ;;
      -h|--help)       cmd_help; return 0 ;;
      -*)              die "unknown option: $1" ;;
      *)               if [[ -z "$slug" ]]; then slug="$1"; else die "unexpected argument: $1"; fi ;;
    esac
    shift
  done
  [[ -n "$slug" ]] || die "usage: worktree-stack.sh down <slug> [--purge-volume]"
  validate_slug "$slug"

  local wt mp hp
  wt="$(slot_worktree "$slug")"
  [[ -n "$wt" ]] || die "no state entry for slug '$slug' (nothing to bring down)"
  mp="$(slot_field "$slug" manifest_port)"
  hp="$(slot_field "$slug" healer_port)"

  if [[ -d "$wt" ]]; then
    ensure_stack_files "$slug"
    echo "Tearing down stack mnfst-wt-$slug ..."
    WT_VERBOSE=1 wt_compose "$slug" down
  else
    echo "WARNING: worktree $wt is gone; skipping compose down."
  fi

  if [[ "$purge" == 1 ]]; then
    local vols
    vols="$(stack_volume_names "$slug")"
    echo "Removing stack volumes: $vols"
    # shellcheck disable=SC2086
    docker volume rm $vols 2>/dev/null || echo "  (volumes already gone)"
  fi

  rm -f "$wt/docker/.env.wt-$slug" "$wt/docker/docker-compose.wt-$slug.yml"

  lock_state
  state_set "$slug" null
  unlock_state

  if is_running "$slug"; then
    echo "WARNING: containers still running; remove manually:"
    echo "  docker rm -f mnfst-wt-$slug-manifest-1 mnfst-wt-$slug-healer-1 mnfst-wt-$slug-postgres-1"
  fi
  echo "✓ Stack mnfst-wt-$slug down; slot ${mp:+$mp/}$hp released."
  if [[ "$purge" == 1 ]]; then
    echo "  Volumes purged."
  fi
  return 0
}

cmd_rebuild() {
  local slug="${1:-}"
  [[ -n "$slug" ]] || die "usage: worktree-stack.sh rebuild <slug>"
  validate_slug "$slug"
  local wt mp bind
  wt="$(slot_worktree "$slug")"
  [[ -n "$wt" ]] || die "no state entry for slug '$slug'"
  [[ -d "$wt" ]] || die "recorded worktree $wt is gone — cannot rebuild"
  ensure_stack_files "$slug"
  echo "Rebuilding image manifestdotbuild/manifest:$slug from $wt ..."
  docker build -f "$wt/docker/Dockerfile" -t "manifestdotbuild/manifest:$slug" "$wt"
  echo "Recreating stack mnfst-wt-$slug ..."
  WT_VERBOSE=1 wt_compose "$slug" up -d --force-recreate
  mp="$(slot_field "$slug" manifest_port)"
  bind="$(resolve_bind_address)"
  wait_healthy "$mp" "$bind"
  echo "✓ Stack mnfst-wt-$slug rebuilt and healthy (DB volume retained)."
}

print_stack_row() {
  local row="$1" slug mp hp branch wt created health orphan=""
  IFS=$'\t' read -r slug mp hp branch wt created <<< "$row"
  health="$(stack_container_status "$slug" "$wt")"
  [[ -n "$health" ]] || health="down"
  if [[ ! -d "$wt" ]]; then
    orphan="⚠ ORPHAN (worktree gone) — run: down $slug"
  elif [[ -n "$branch" && "$branch" != "unknown" ]]; then
    if ! git -C "$wt" branch --list "$branch" 2>/dev/null | grep -q .; then
      orphan="⚠ ORPHAN (branch '$branch' gone) — run: down $slug"
    fi
  fi
  printf '  %-22s %s/%s   %-18s %-42s %s %s\n' "$slug" "$mp" "$hp" "$branch" "$wt" "$health" "$orphan"
}

cmd_status() {
  local filter="${1:-}"
  if [[ -n "$filter" ]]; then
    validate_slug "$filter"
    local row
    row="$(state_all | awk -F'\t' -v s="$filter" '$1==s')"
    if [[ -z "$row" ]]; then
      echo "No worktree stack with slug '$filter' (see 'worktree-stack.sh status')."
      return 0
    fi
    print_stack_row "$row"
    return 0
  fi

  echo "═══ Worktree stacks (mnfst-wt-*) ═══"
  local rows
  rows="$(state_all)"
  if [[ -z "$rows" ]]; then
    echo "  (none)"
  else
    printf '  %-22s %-10s %-18s %-42s %s\n' "SLUG" "PORTS" "BRANCH" "WORKTREE" "STATUS"
    while IFS= read -r row; do
      [[ -n "$row" ]] || continue
      print_stack_row "$row"
    done <<< "$rows"
  fi
  echo ""
  echo "═══ Prod / Dev (always-on) ═══"
  docker ps -a --format '{{.Names}} | {{.Status}}' | grep -E '^(mnfst-manifest-1|mnfst-dev-manifest-1) ' || echo "  neither prod nor dev present"
  echo ""
  echo "Run 'worktree-stack.sh help' for usage."
}

cmd_logs() {
  local slug="${1:-}"
  [[ -n "$slug" ]] || die "usage: worktree-stack.sh logs <slug>"
  validate_slug "$slug"
  [[ -n "$(slot_worktree "$slug")" ]] || die "no state entry for slug '$slug'"
  ensure_stack_files "$slug"
  wt_compose "$slug" logs --tail=100 -f manifest
}

cmd_help() {
  cat <<'EOF'
worktree-stack.sh — per-worktree disposable Manifest Docker stacks

Every feature worktree gets its OWN isolated stack (project mnfst-wt-<slug>)
so parallel lanes never interfere with each other or with the always-on
Prod (2099) / Dev (2100) stacks. Containers: mnfst-wt-<slug>-manifest-1,
mnfst-wt-<slug>-postgres-1, mnfst-wt-<slug>-healer-1.

USAGE
  worktree-stack.sh up <worktree-dir> [--slug <name>] [--snapshot|--no-snapshot] [--rebuild]
  worktree-stack.sh down <slug> [--purge-volume]
  worktree-stack.sh rebuild <slug>
  worktree-stack.sh status [slug]
  worktree-stack.sh logs <slug>
  worktree-stack.sh help

COMMANDS
  up <worktree-dir>
      Build image manifestdotbuild/manifest:<slug> from the worktree source,
      allocate a port slot, generate the per-stack env + compose override,
      start the isolated stack and health-check it.
      --slug <name>     Override the slug (default: sanitized dir basename).
      --snapshot        (DEFAULT) Copy the PROD database into this stack.
      --no-snapshot     Start with a fresh empty database.
      --rebuild         Rebuild the image even if the tag already exists.

  down <slug> [--purge-volume]
      Stop the stack, remove the generated env/override files, release the
      port slot. --purge-volume also deletes the stack's two volumes.

  rebuild <slug>
      Rebuild the image from the recorded worktree and recreate the stack.
      The database volume is kept (no data loss).

  status [slug]
      Table of active stacks (ports, branch, worktree, container health).
      Orphaned stacks (worktree or branch gone) are flagged. With no args
      also shows the always-on prod/dev one-liner.

  logs <slug>
      Follow the stack's manifest container logs (last 100 lines).

  help         Show this help.

PORTS & NAMING (slug = sanitized [a-z0-9-])
  project   mnfst-wt-<slug>          image     manifestdotbuild/manifest:<slug>
  volumes   manifest_wt_<slug>_pgdata, manifest_wt_<slug>_request_recordings
  manifest  <HOST_BIND_ADDRESS>:2100+N   healer  <HOST_BIND_ADDRESS>:3100+N
  N = lowest free slot in 2..99 not bound on the host and not taken by
  another active slug. State: docker/.worktree-stacks.json (gitignored),
  guarded with flock. The gitignored .env.dev is taken from the worktree's
  docker/ dir, falling back to the repo's main checkout.
  HOST_BIND_ADDRESS is forced to the host's live Tailscale IP
  (tailscale ip -4, fallback 100.69.158.7) so test stacks are reachable
  over the tailnet — never just localhost.
EOF
}

# ── main ─────────────────────────────────────────────────────────────────

case "${1:-help}" in
  up)       shift; cmd_up "$@" ;;
  down)     shift; cmd_down "$@" ;;
  rebuild)  shift; cmd_rebuild "$@" ;;
  status)   shift; cmd_status "$@" ;;
  logs)     shift; cmd_logs "$@" ;;
  help|-h|--help) cmd_help ;;
  *)
    echo "Unknown command: ${1:-}"
    echo "Run 'worktree-stack.sh help' for usage."
    exit 1
    ;;
esac
