# Quickstart: NPM to pnpm Migration

**Feature**: 017-npm-to-pnpm
**Branch**: `017-npm-to-pnpm`

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 9.15.0 (`npm install -g pnpm` or use corepack: `corepack enable`)

## Migration Steps

### 1. Create pnpm-workspace.yaml

Create `/pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
```

### 2. Update Root package.json

Update `/package.json`:
- Change `"packageManager": "npm@10.2.0"` → `"packageManager": "pnpm@9.15.4"`
- Remove the `"workspaces"` field entirely

### 3. Update Inter-Package Dependencies

In `/packages/backend/package.json`:
- Change `"@chatgpt-app-builder/shared": "*"` → `"@chatgpt-app-builder/shared": "workspace:*"`

In `/packages/frontend/package.json`:
- Change `"@chatgpt-app-builder/shared": "*"` → `"@chatgpt-app-builder/shared": "workspace:*"`

### 4. Convert Lockfile

```bash
pnpm import
```

### 5. Clean and Install

```bash
rm -rf node_modules packages/*/node_modules package-lock.json
pnpm install
```

### 6. Verify Installation

```bash
pnpm dev        # Start development servers
pnpm build      # Build all packages
pnpm lint       # Run linting
pnpm type-check # Run TypeScript checks
```

## Documentation Updates

Update these files to replace `npm` with `pnpm`:

- `/README.md` - All command examples
- `/CLAUDE.md` - Agent guidelines
- `/.specify/scripts/bash/serve-app.sh` - npm run → pnpm
- `/.specify/scripts/bash/update-agent-context.sh` - npm references
- All `/specs/*/quickstart.md` files (17 total)

## Command Reference

| Before (npm) | After (pnpm) |
|--------------|--------------|
| `npm install` | `pnpm install` |
| `npm run dev` | `pnpm dev` |
| `npm run build` | `pnpm build` |
| `npm run lint` | `pnpm lint` |
| `npm run type-check` | `pnpm type-check` |
| `npm test` | `pnpm test` |

## Verification Checklist

- [ ] `pnpm install` completes without errors
- [ ] `pnpm-lock.yaml` exists in repository root
- [ ] `package-lock.json` is deleted
- [ ] `pnpm dev` starts backend and frontend
- [ ] `pnpm build` completes for all packages
- [ ] `pnpm lint` runs without errors
- [ ] `pnpm type-check` passes
