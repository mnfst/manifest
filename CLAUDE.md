# flows-and-nodes Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-06

## Active Technologies
- SQLite (better-sqlite3 11.7.0) (088-dynamic-node-library)
- SQLite (better-sqlite3 11.7.0) via TypeORM (001-io-schemas)
- TypeScript 5.7.2 + React 18.3.1, NestJS 10.4.15, @xyflow/react 12.10.0, CodeMirror 6 (to add), Vite 6.0.5 (001-edit-uis)
- SQLite via TypeORM 0.3.20 (nodes stored as JSON in Flow entity) (001-edit-uis)
- SQLite (better-sqlite3 11.7.0) via TypeORM - nodes stored as JSON arrays in Flow entity (089-transform-nodes)
- TypeScript 5.7.2 + React 18.3.1, NestJS 10.4.15, @xyflow/react 12.10.0, TypeORM 0.3.20 (090-ui-node-actions)
- SQLite (better-sqlite3 11.7.0) via TypeORM 0.3.20 - nodes stored as JSON in Flow entity (001-ui-edit-modal-merge)
- TypeScript 5.7.2 (Node.js >= 18.0.0) + NestJS 10.4.15 (backend), React 18.3.1 (frontend), @xyflow/react 12.10.0, TypeORM 0.3.20 (001-execution-metadata-ui)
- SQLite (better-sqlite3 11.7.0) via TypeORM - existing FlowExecution entity (001-execution-metadata-ui)
- SQLite (better-sqlite3 11.7.0) via TypeORM - nodes stored as JSON in Flow entity (091-post-list-action-handle)
- TypeScript 5.7.2 (Node.js >= 18.0.0) + NestJS 10.4.15, Jest, @nestjs/testing, TypeORM 0.3.20 (001-backend-test-suite)
- SQLite (better-sqlite3 11.7.0) via TypeORM - mocked for unit tests (001-backend-test-suite)

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
- 001-backend-test-suite: Added TypeScript 5.7.2 (Node.js >= 18.0.0) + NestJS 10.4.15, Jest, @nestjs/testing, TypeORM 0.3.20
- 001-execution-metadata-ui: Added TypeScript 5.7.2 (Node.js >= 18.0.0) + NestJS 10.4.15 (backend), React 18.3.1 (frontend), @xyflow/react 12.10.0, TypeORM 0.3.20
- 091-post-list-action-handle: Added TypeScript 5.7.2 + React 18.3.1, NestJS 10.4.15, @xyflow/react 12.10.0, TypeORM 0.3.20


<!-- MANUAL ADDITIONS START -->

## Pull Request Guidelines

**IMPORTANT: When creating a PR, ALWAYS include a well-formatted description.**

When using `gh pr create` or creating PRs, you MUST follow this format:

```markdown
## Summary

[1-3 sentences explaining what this PR does and why]

## Changes

- [List each significant change as a bullet point]
- [Be specific about files/components modified]
- [Mention any new dependencies or configurations]

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (no functional changes)
- [ ] Documentation update
- [ ] Tests (adding or updating tests)
- [ ] CI/CD (changes to build process or workflows)

## Testing

- [ ] Tests pass locally (`pnpm test`)
- [ ] Lint passes (`pnpm lint`)
- [Describe any manual testing performed]

## Related Issues

[Link any related issues: Fixes #123, Relates to #456]
```

**Rules for PR descriptions:**
1. NEVER create a PR with an empty description
2. Always analyze ALL commits in the branch to write a comprehensive summary
3. Check the type(s) of change that apply
4. List specific files/components that were modified
5. Include testing information

## Development Server Ports (edit-uis worktree)

This worktree uses unique ports to avoid conflicts with other instances:

| Service  | Port | URL                        |
|----------|------|----------------------------|
| Backend  | 3847 | http://localhost:3847/api  |
| Frontend | auto | http://localhost:5176 (or next available) |

### Starting the servers

```bash
# Start both (from repo root)
pnpm dev

# Or start individually:
cd packages/backend && pnpm dev   # Starts on port 3847
cd packages/frontend && pnpm dev  # Auto-selects available port
```

### Port configuration files
- Backend: `packages/backend/.env` → `PORT=3847`
- Frontend: `packages/frontend/.env` → `VITE_API_URL=http://localhost:3847`

### IMPORTANT: No Vite Proxy

**NEVER use Vite proxy for backend API calls.** Always call the backend directly:

```typescript
// CORRECT - Direct call
const API_BASE = `${BACKEND_URL}/api`;  // e.g., http://localhost:3847/api

// WRONG - Do NOT use proxy
// vite.config.ts proxy: { '/api': { target: '...' } }
```

Proxy creates caching issues and stale responses. The backend has CORS enabled, so direct calls work fine.

### Production vs Development API URL

The `VITE_API_URL` environment variable controls the backend URL:

| Environment | VITE_API_URL | Result |
|-------------|--------------|--------|
| Production (Docker) | `""` (empty string) | Same-origin relative URLs (`/api/...`) |
| Development | undefined (not set) | Falls back to `http://localhost:3847` |
| Custom deployment | `"https://api.example.com"` | Uses explicit URL |

**CRITICAL: Use `??` not `||` for fallback logic!**

```typescript
// CORRECT - Nullish coalescing: only falls back for undefined/null
export const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3847';

// WRONG - Logical or: falls back for empty string too (breaks production!)
export const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3847';
```

The Docker build sets `VITE_API_URL=""` so the frontend uses relative URLs. Using `||` would incorrectly fall back to localhost in production.

<!-- MANUAL ADDITIONS END -->
