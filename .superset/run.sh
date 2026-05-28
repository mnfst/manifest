#!/usr/bin/env bash
set -euo pipefail

# Start backend and frontend in parallel (cloud mode, as required by CLAUDE.md)
MANIFEST_MODE=cloud npx turbo run dev --parallel 2>/dev/null || {
  # Fallback: start both manually if turbo dev doesn't work
  cd packages/backend && NODE_OPTIONS='-r dotenv/config' npx nest start --watch &
  cd packages/frontend && npx vite &
  wait
}
