# Manifest Package Guidelines

The `packages/manifest` package is a flow editor application with NestJS backend and React frontend.

## Active Technologies

| Layer       | Technology              | Version   |
| ----------- | ----------------------- | --------- |
| Language    | TypeScript              | 5.7.2     |
| Runtime     | Node.js                 | >= 22.0.0 |
| Backend     | NestJS                  | 10.4.15   |
| Frontend    | React                   | 18.3.1    |
| Bundler     | Vite                    | 6.0.5     |
| Styling     | TailwindCSS             | 3.4.17    |
| Database    | SQLite (better-sqlite3) | 11.7.0    |
| ORM         | TypeORM                 | 0.3.20    |
| Flow Editor | @xyflow/react           | 12.10.0   |
| Charts      | @tremor/react           | 3.18.7    |
| Code Editor | @uiw/react-codemirror   | 4.25.4    |
| Email       | React Email, Mailgun    | -         |

## First-Time Setup

Before running `pnpm dev` for the first time in a fresh clone:

```bash
# 1. Install dependencies
pnpm install

# 2. Build shared packages (backend depends on these)
pnpm --filter @manifest/shared build
pnpm --filter @manifest/nodes build

# 3. Create database directory (SQLite requires it)
mkdir -p packages/manifest/backend/data
```

The database file (`packages/manifest/backend/data/app.db`) is created automatically on first run. The seed service creates a default admin user (`admin@example.com`) and sample data.

## Development Server Ports

| Service  | Port | URL                                       |
| -------- | ---- | ----------------------------------------- |
| Backend  | 3847 | http://localhost:3847/api                 |
| Frontend | auto | http://localhost:5176 (or next available) |

**Port configuration files:**

- Backend: `packages/manifest/backend/.env` → `PORT=3847`
- Frontend: `packages/manifest/frontend/.env` → `VITE_API_URL=http://localhost:3847`

## API URL Configuration (CRITICAL)

**NEVER use Vite proxy for backend API calls.** Always call the backend directly:

```typescript
// CORRECT - Direct call
const API_BASE = `${BACKEND_URL}/api`; // e.g., http://localhost:3847/api

// WRONG - Do NOT use proxy
// vite.config.ts proxy: { '/api': { target: '...' } }
```

**CRITICAL: Use `??` not `||` for fallback logic!**

```typescript
// CORRECT - Nullish coalescing: only falls back for undefined/null
export const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3847';

// WRONG - Logical or: falls back for empty string too (breaks production!)
export const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3847';
```

| Environment         | VITE_API_URL                | Result                                 |
| ------------------- | --------------------------- | -------------------------------------- |
| Production (Docker) | `""` (empty string)         | Same-origin relative URLs (`/api/...`) |
| Development         | undefined (not set)         | Falls back to `http://localhost:3847`  |
| Custom deployment   | `"https://api.example.com"` | Uses explicit URL                      |

## Data Model

- Nodes stored as JSON arrays in Flow entity
- FlowExecution entity for execution tracking
- ThemeVariables JSON column on AppEntity

## Code Organization Guidelines (CRITICAL)

### No Inline Types in Service Files

**Service files (`.service.ts`, `.tool.ts`, `.controller.ts`) must NOT define interfaces, types, constants, or helper functions inline.** Extract them to dedicated files:

| What to extract | Where it goes | Naming convention |
|---|---|---|
| Interfaces/types used only in backend | `<module>/<module>.types.ts` | e.g., `node/node.types.ts` |
| Interfaces/types shared across packages | `shared/src/types/<domain>.ts` | Re-export from `shared/src/index.ts` |
| Helper/utility functions | `<module>/utils/<name>.utils.ts` | e.g., `app/utils/default-icons.utils.ts` |
| Constants | `<module>/utils/<name>.utils.ts` or `shared/src/constants/<domain>.ts` | Backend-only → utils file; shared → constants file |
| Error classes | `<module>/errors/<name>.error.ts` | e.g., `mcp/errors/mcp-inactive-tool.error.ts` |
| Crypto/security utilities | `<module>/crypto/<name>.utils.ts` | e.g., `secret/crypto/encryption.utils.ts` |

**Examples of what NOT to do:**

```typescript
// BAD - inline interface in service file
@Injectable()
export class MyService {
  interface MyParams { ... } // ❌ Extract to my.types.ts
  private helperFn() { ... } // ❌ Extract to utils/ if pure function
}
```

```typescript
// GOOD - imports from dedicated files
import type { MyParams } from './my.types';
import { helperFn } from './utils/my.utils';

@Injectable()
export class MyService { ... }
```

### When to Use Shared vs Backend-Local Types

- **Shared (`@manifest/shared`)**: Types used by both frontend and backend, or types that are part of the public API contract
- **Backend-local (`<module>/<module>.types.ts`)**: Types only used within the backend, or types that depend on backend-only packages (e.g., `@manifest/nodes`, TypeORM entities)

### Private Methods vs Standalone Functions

If a private method on a service class is a **pure function** (no `this` access, no dependency injection), extract it to a standalone utility function in a `utils/` subdirectory. This improves testability and reusability.

## shadcn/ui Components (DO NOT MODIFY)

**Location:** `packages/manifest/frontend/src/components/ui/shadcn/`

These are pristine shadcn/ui components installed via `npx shadcn@latest add`.

**Rules:**

- **NEVER modify files in the `shadcn/` folder directly**
- To update: `npx shadcn@latest add <component-name> --overwrite`
- For customizations: Create a wrapper in the parent `ui/` folder

**ALWAYS use shadcn/ui components for these UI elements:**

| Element        | shadcn Component                | Import                            |
| -------------- | ------------------------------- | --------------------------------- |
| Buttons        | `Button`                        | `@/components/ui/shadcn/button`   |
| Form inputs    | `Input`                         | `@/components/ui/shadcn/input`    |
| Labels         | `Label`                         | `@/components/ui/shadcn/label`    |
| Textareas      | `Textarea`                      | `@/components/ui/shadcn/textarea` |
| Checkboxes     | `Checkbox`                      | `@/components/ui/shadcn/checkbox` |
| Dialogs/Modals | `Dialog`, `DialogContent`, etc. | `@/components/ui/shadcn/dialog`   |
| Error alerts   | `Alert variant="destructive"`   | `@/components/ui/shadcn/alert`    |
| Tabs           | `Tabs`, `TabsList`, etc.        | `@/components/ui/shadcn/tabs`     |

**Button variants:**

- `default` - Primary actions (Save, Submit, Create)
- `destructive` - Delete/remove actions
- `outline` - Secondary actions (Cancel)
- `ghost` - Tertiary/icon buttons
- `link` - Text links styled as buttons

**Dialog pattern:**

```tsx
<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Optional description</DialogDescription>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={onSubmit}>Submit</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Alert pattern:**

```tsx
{
  error && (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}
```

**Import patterns:**

```typescript
// shadcn components - import from shadcn subfolder
import { Button } from '@/components/ui/shadcn/button';
import { Dialog } from '@/components/ui/shadcn/dialog';

// Custom components - import from ui folder directly
import { Select } from '@/components/ui/select';
import { Stats } from '@/components/ui/stats';
```
