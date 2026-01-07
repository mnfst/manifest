# flows-and-nodes Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-06

## Active Technologies
- SQLite (better-sqlite3 11.7.0) (088-dynamic-node-library)
- SQLite (better-sqlite3 11.7.0) via TypeORM (001-io-schemas)
- TypeScript 5.7.2 + NestJS 10.x (backend), React 18.3.1 (frontend), @xyflow/react 12.10.0 (canvas), pnpm 9.15.4 (monorepo) (001-ui-selection)
- SQLite via better-sqlite3 (existing) (001-ui-selection)

- TypeScript 5.7.2 + NestJS 10.4.15 (backend), React 18.3.1 (frontend), @xyflow/react 12.10.0 (canvas), TypeORM 0.3.20 (ORM) (001-trigger-node-refactor)

## Project Structure

```text
src/
tests/
```

## Commands

pnpm test && pnpm lint

## Code Style

TypeScript 5.7.2: Follow standard conventions

## Recent Changes
- 001-ui-selection: Added TypeScript 5.7.2 + NestJS 10.x (backend), React 18.3.1 (frontend), @xyflow/react 12.10.0 (canvas), pnpm 9.15.4 (monorepo)
- 001-io-schemas: Added TypeScript 5.7.2
- 029-multiple-triggers: Added TypeScript 5.7.2 + NestJS 10.4.15 (backend), React 18.3.1 (frontend), @xyflow/react 12.10.0 (canvas), TypeORM 0.3.20 (ORM)


<!-- MANUAL ADDITIONS START -->

## Development Server Guidelines

**IMPORTANT**: When starting dev servers, ALWAYS use random high ports (40000-60000 range) to avoid conflicts with other instances running on common ports (3000, 3001, 4000, 5173, etc.).

### Starting Servers

```bash
# Generate random ports
BACKEND_PORT=$((RANDOM % 10000 + 40000))
FRONTEND_PORT=$((RANDOM % 10000 + 50000))

# Update backend .env
echo "PORT=$BACKEND_PORT" >> packages/backend/.env

# Start backend
cd packages/backend && pnpm dev

# Start frontend with API URL pointing to backend
cd packages/frontend && VITE_API_URL=http://localhost:$BACKEND_PORT pnpm dev --port $FRONTEND_PORT
```

### Database Reset

To reset the database and re-seed:
```bash
rm -f packages/backend/data/app.db
```

### Rebuild Nodes Package

After modifying node definitions, rebuild and restart:
```bash
cd packages/nodes && rm -rf dist && pnpm build
# Then restart backend
```
<!-- MANUAL ADDITIONS END -->
