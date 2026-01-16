# flows-and-nodes Development Guidelines

## Active Technologies
- TypeScript 5.7.2, Node.js >= 18.0.0 + NestJS 10.4.15 (backend), React 18.3.1 (frontend), Vite 6.0.5, TailwindCSS 3.4.17 (001-app-secrets-vault)
- SQLite via better-sqlite3 11.7.0, TypeORM 0.3.20 (001-app-secrets-vault)

### Core Stack
- **TypeScript** 5.7.2 (Node.js >= 18.0.0, strict mode)
- **SQLite** via better-sqlite3 11.7.0, TypeORM 0.3.20

### Backend
- **NestJS** 10.4.15
- **Jest** + @nestjs/testing (unit tests)
- **React Email** (@react-email/components, @react-email/render)
- **Mailgun** (mailgun.js, nodemailer)

### Frontend
- **React** 18.3.1
- **Vite** 6.0.5
- **TailwindCSS** 3.4.17
- **@xyflow/react** 12.10.0 (canvas/flow editor)
- **@tremor/react** 3.18.7 (charts/analytics)
- **@uiw/react-codemirror** 4.25.4 (code editor)

### Data Model
- Nodes stored as JSON arrays in Flow entity
- FlowExecution entity for execution tracking
- ThemeVariables JSON column on AppEntity

## Project Structure

```text
packages/
├── backend/    # NestJS API
├── frontend/   # React SPA
├── shared/     # Shared types and utilities
└── nodes/      # Node type definitions
```

## Commands

```bash
pnpm test       # Run all tests
pnpm lint       # Run linter
pnpm dev        # Start dev servers
pnpm build      # Production build
```

## Code Style

- TypeScript strict mode enabled
- Follow standard conventions
- Max 300 lines per file, 50 lines per function

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

## UI Components Structure

### shadcn/ui Components (DO NOT MODIFY)

**Location:** `packages/frontend/src/components/ui/shadcn/`

These are pristine shadcn/ui components installed via `npx shadcn@latest add`.

**Rules:**
- **NEVER modify files in the `shadcn/` folder directly**
- To update: `npx shadcn@latest add <component-name> --overwrite`
- For customizations: Create a wrapper in the parent `ui/` folder
- See `shadcn/README.md` for full documentation

### Custom Components (CAN MODIFY)

**Location:** `packages/frontend/src/components/ui/`

These are project-specific components that can be freely modified:
- `select.tsx` - Custom native select with `options` array prop
- `stats.tsx` - Statistics display component

### Import Patterns

```typescript
// shadcn components - import from shadcn subfolder
import { Button } from '@/components/ui/shadcn/button';
import { Dialog } from '@/components/ui/shadcn/dialog';

// Custom components - import from ui folder directly
import { Select } from '@/components/ui/select';
import { Stats } from '@/components/ui/stats';
```

<!-- MANUAL ADDITIONS END -->

## Recent Changes
- 001-app-secrets-vault: Added TypeScript 5.7.2, Node.js >= 18.0.0 + NestJS 10.4.15 (backend), React 18.3.1 (frontend), Vite 6.0.5, TailwindCSS 3.4.17
