# Research: NPM to pnpm Migration

**Feature**: 017-npm-to-pnpm
**Date**: 2025-12-29

## Summary

This document captures research findings for migrating from npm workspaces to pnpm workspaces in this monorepo.

---

## 1. pnpm-workspace.yaml Configuration

**Decision**: Create `pnpm-workspace.yaml` in repository root

**Rationale**: pnpm uses this file as its primary workspace configuration, replacing npm's `workspaces` field in package.json.

**Configuration**:
```yaml
packages:
  - 'packages/*'
```

**Alternatives considered**:
- Keep using package.json workspaces field: Rejected - pnpm prefers its own config file; having both causes confusion

---

## 2. packageManager Field Format

**Decision**: Update to `pnpm@9.15.4` (current stable version)

**Rationale**:
- Turborepo 2.0+ requires the `packageManager` field
- Format must be exact version `<name>@<version>` (no ranges like `^9.x`)
- Only needed in root package.json

**Current**: `"packageManager": "npm@10.2.0"`
**Updated**: `"packageManager": "pnpm@9.15.4"`

**Alternatives considered**:
- Use older pnpm version: Rejected - 9.x is current stable with best workspace support

---

## 3. Workspace Protocol for Dependencies

**Decision**: Use `workspace:*` for inter-package dependencies

**Rationale**:
- Explicitly marks dependencies as local workspace packages
- pnpm will refuse to resolve from registry, preventing accidental external resolution
- Compatible with private packages (no publishing concerns)

**Current**: `"@chatgpt-app-builder/shared": "*"`
**Updated**: `"@chatgpt-app-builder/shared": "workspace:*"`

**Files to update**:
- `packages/backend/package.json`
- `packages/frontend/package.json`

**Alternatives considered**:
- `workspace:^`: Rejected - unnecessary for private packages
- Keep `*`: Rejected - doesn't guarantee local resolution with pnpm

---

## 4. Command Syntax Differences

**Decision**: Replace `npm` with `pnpm` in all scripts and documentation

**Key differences**:

| npm Command | pnpm Equivalent | Notes |
|-------------|-----------------|-------|
| `npm install` | `pnpm install` | Same |
| `npm run <script>` | `pnpm <script>` | Can omit `run` |
| `npm run dev` | `pnpm dev` | Shorthand works |
| `npm test` | `pnpm test` | Same |
| `npx <cmd>` | `pnpm exec <cmd>` | For local packages |

**Rationale**: pnpm commands are mostly compatible; shorthand syntax preferred for simplicity.

**Alternatives considered**:
- Keep `pnpm run` instead of `pnpm`: Either works; shorthand is more concise

---

## 5. Workspaces Field in package.json

**Decision**: Remove the `workspaces` field from root package.json

**Rationale**:
- pnpm uses `pnpm-workspace.yaml` exclusively
- The `workspaces` field is an npm/yarn convention
- Having both causes confusion and potential inconsistency

**Current**:
```json
"workspaces": [
  "packages/*"
]
```

**Updated**: Remove entirely (workspace defined in pnpm-workspace.yaml)

---

## 6. Migration Steps

**Decision**: Use pnpm import to convert lockfile

**Rationale**: `pnpm import` reads package-lock.json and generates pnpm-lock.yaml with equivalent resolution.

**Steps**:
1. Create `pnpm-workspace.yaml`
2. Update root `package.json` (packageManager, remove workspaces)
3. Update inter-package dependencies to use `workspace:*`
4. Run `pnpm import` to convert lockfile
5. Delete `package-lock.json` and `node_modules`
6. Run `pnpm install` to verify

**Alternatives considered**:
- Fresh install without import: Rejected - may resolve different versions; import preserves lockfile resolution

---

## 7. Potential Issues

### Native Dependencies
- Project uses `better-sqlite3` and `sharp` (native bindings)
- pnpm handles these correctly; test after migration

### Strict Dependency Resolution
- pnpm does not hoist dependencies like npm
- Any undeclared dependencies will fail
- This is beneficial: surfaces hidden issues

### Turborepo Compatibility
- Fully compatible with pnpm workspaces
- No changes needed to turbo.json

---

## Files Requiring Updates

| File | Change |
|------|--------|
| `/package.json` | Update packageManager, remove workspaces |
| `/pnpm-workspace.yaml` | NEW: Define workspace packages |
| `/packages/backend/package.json` | Update shared dep to workspace:* |
| `/packages/frontend/package.json` | Update shared dep to workspace:* |
| `/README.md` | Update all npm → pnpm references |
| `/CLAUDE.md` | Update command references |
| `/.specify/scripts/bash/serve-app.sh` | Update npm run → pnpm |
| `/.specify/scripts/bash/update-agent-context.sh` | Update npm references |
| `/specs/*/quickstart.md` | Update all 17 files |
