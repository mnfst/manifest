# Implementation Plan: User Authentication & Authorization

**Branch**: `001-auth` | **Date**: 2026-01-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-auth/spec.md`

## Summary

Implement user authentication using better-auth library with email/password strategy. The feature adds User entity and UserAppRole join table for many-to-many user-app relationships with owner/admin roles. Frontend will have a login/signup page replacing the home page for unauthenticated users, real user profile in sidebar with logout, and a user management tab for app owners/admins.

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js >= 18.0.0
**Primary Dependencies**:
- Backend: NestJS 10.4.15, better-auth, @thallesp/nestjs-better-auth, TypeORM 0.3.20
- Frontend: React 18.3.1, better-auth/react, react-router-dom 7.1.1
**Storage**: SQLite (better-sqlite3 11.7.0) via TypeORM
**Testing**: Jest + @nestjs/testing (backend auth tests required per spec)
**Target Platform**: Web application (desktop browsers)
**Project Type**: Monorepo with packages/backend and packages/frontend
**Performance Goals**: N/A (POC - deferred per constitution)
**Constraints**: Standalone operation (no external auth services), cookie-based sessions
**Scale/Scope**: Single-tenant POC with minimal user data

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & SOLID | PASS | Auth module follows NestJS module pattern (SRP, DI) |
| II. Testing Standards | PARTIAL | Backend auth tests required per user request |
| III. UX Consistency | PASS | Reusing existing UI patterns (tabs, forms, sidebar) |
| IV. Performance Requirements | DEFERRED | POC phase - no performance targets |
| V. Documentation & Readability | PASS | Following existing code conventions |

**Gate Status**: PASS - No violations requiring justification.

**POC Scope Note**: The constitution explicitly defers "authentication/security" to post-POC. However, this feature IS the authentication implementation requested by the user, so it represents a deliberate progression of the POC toward production readiness.

## Security Design

### Privacy-First Authorization

To prevent information leakage about resource existence:

- **404 over 403**: When a user attempts to access an app/flow they don't have permission for, return 404 (Not Found) instead of 403 (Forbidden)
- **Consistent responses**: Unauthorized access and non-existent resources return identical responses
- **No enumeration**: Prevents attackers from discovering which resources exist

### Endpoint Protection

| Endpoint Pattern | Protection | Reason |
|------------------|------------|--------|
| `/api/auth/*` | Public | Authentication endpoints |
| `/api/*` | Authenticated | All other API endpoints |
| `/servers/*` | Public | MCP endpoints for external clients |
| All other routes | Authenticated | Default protection |

### Authorization Checks

1. **Global Auth Guard**: Applied to all routes, skipped for `@Public()` decorated endpoints
2. **App Access Check**: Before any app/flow operation, verify user has UserAppRole for that app
3. **Return 404**: If access check fails, return 404 to prevent information disclosure

## Project Structure

### Documentation (this feature)

```text
specs/001-auth/
├── plan.md              # This file
├── research.md          # Phase 0 output - better-auth research
├── data-model.md        # Phase 1 output - User, UserAppRole entities
├── quickstart.md        # Phase 1 output - setup guide
├── contracts/           # Phase 1 output - API endpoints
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
packages/backend/
├── src/
│   ├── auth/                    # NEW: Auth module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.guard.ts
│   │   ├── app-access.guard.ts  # NEW: App-level access check (returns 404)
│   │   ├── user.entity.ts
│   │   ├── user-app-role.entity.ts
│   │   └── decorators/
│   │       ├── current-user.decorator.ts
│   │       └── public.decorator.ts
│   ├── app/
│   │   └── app.entity.ts        # MODIFY: Add users relation
│   ├── seed/
│   │   └── seed.service.ts      # MODIFY: Seed admin user
│   └── main.ts                  # MODIFY: Global auth guard
├── tests/
│   ├── auth/                    # NEW: Auth tests
│   │   ├── auth.guard.spec.ts
│   │   ├── app-access.guard.spec.ts
│   │   └── auth.e2e-spec.ts
│   └── app/
│       └── app.controller.spec.ts  # MODIFY: Add auth tests

packages/frontend/
├── src/
│   ├── lib/
│   │   └── auth-client.ts       # NEW: better-auth React client
│   ├── components/
│   │   ├── auth/                # NEW: Auth components
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SignupForm.tsx
│   │   │   └── AuthTabs.tsx
│   │   ├── layout/
│   │   │   └── UserAvatar.tsx   # MODIFY: Real user data + logout
│   │   └── app/
│   │       └── UserManagement.tsx # NEW: User management tab
│   ├── pages/
│   │   ├── AuthPage.tsx         # NEW: Login/Signup page
│   │   └── Home.tsx             # MODIFY: Filter by user access
│   ├── hooks/
│   │   └── useAuth.ts           # NEW: Auth hook wrapper
│   └── App.tsx                  # MODIFY: Auth routing
└── tests/
```

**Structure Decision**: Web application (Option 2) - matches existing monorepo with separate backend/frontend packages.

## Complexity Tracking

> No violations - table not needed.
