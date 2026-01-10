# Research: User Authentication & Authorization

**Feature**: 001-auth
**Date**: 2026-01-10

## Research Tasks

### 1. Better-Auth Library Integration with NestJS

**Decision**: Use better-auth with @thallesp/nestjs-better-auth wrapper

**Rationale**:
- better-auth is a modern TypeScript-first authentication library (25K+ GitHub stars)
- Designed for standalone operation without external services
- Has official NestJS integration via community package
- Supports email/password authentication out of the box
- Cookie-based sessions work well with SQLite backend

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Passport.js | More complex setup, requires manual session management |
| Auth0/Firebase | External service dependency violates standalone requirement |
| Custom JWT implementation | Reinventing the wheel, security risks |
| NextAuth | Designed for Next.js, not suitable for NestJS |

**Integration Notes**:
- Install: `npm install @thallesp/nestjs-better-auth better-auth`
- Requires disabling NestJS body parser (`bodyParser: false` in main.ts)
- Use `@Session()` decorator to access authenticated user
- Use `@AllowAnonymous()` for public endpoints
- Global auth guard protects all routes by default

---

### 2. Database Schema Strategy

**Decision**: Use better-auth's built-in tables + custom UserAppRole entity

**Rationale**:
- better-auth creates 4 core tables: user, session, account, verification
- Our UserAppRole entity extends this with app-specific roles
- TypeORM can manage both better-auth tables and custom entities
- SQLite driver (better-sqlite3) already installed in project

**Schema Approach**:
```
better-auth managed:
├── user (id, email, name, emailVerified, image, createdAt, updatedAt)
├── session (id, userId, token, expiresAt, ipAddress, userAgent)
├── account (id, userId, provider, providerAccountId, ...)
└── verification (id, identifier, value, expiresAt)

Custom entities:
└── user_app_role (id, userId, appId, role, createdAt)
    └── role: 'owner' | 'admin'
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Custom User entity only | Loses better-auth session management benefits |
| Drizzle ORM | Project already uses TypeORM, would add complexity |
| Store roles in user JSON field | Harder to query, no referential integrity |

---

### 3. Session Management Strategy

**Decision**: Cookie-based sessions with "compact" encoding

**Rationale**:
- Cookie-based is better-auth's default and most secure approach
- "compact" encoding (Base64url + HMAC-SHA256) is smallest and efficient
- Sessions stored in database allow server-side invalidation
- 7-day expiry with 1-day refresh is reasonable for POC

**Session Configuration**:
```typescript
{
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // Refresh after 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5 // 5 minute cache
    }
  }
}
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| JWT tokens | More complex, harder to invalidate |
| "jwt" cookie encoding | Larger size, no benefit for internal use |
| Stateless sessions | Can't revoke sessions server-side |

---

### 4. Frontend Authentication Pattern

**Decision**: Use better-auth/react client with custom useAuth hook

**Rationale**:
- better-auth provides React-specific hooks and methods
- useSession() hook handles session state reactively
- AuthProvider pattern integrates with React Router
- Redirect-based auth flow matches existing UX patterns

**Integration Pattern**:
```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3847'
});

// hooks/useAuth.ts
export function useAuth() {
  const { data: session, isPending } = authClient.useSession();
  return {
    user: session?.user,
    isLoading: isPending,
    isAuthenticated: !!session?.user
  };
}
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Custom fetch-based auth | Loses reactive session updates |
| React Query for auth | Unnecessary complexity, better-auth handles caching |
| localStorage tokens | Less secure than HttpOnly cookies |

---

### 5. Route Protection Strategy

**Decision**: App-level auth check with redirect to /auth page

**Rationale**:
- Single auth page with Login/Signup tabs (matches spec FR-004)
- React Router's loader/redirect pattern for protected routes
- Auth state checked once at app level, passed down via context
- Simple and consistent with existing routing patterns

**Routing Structure**:
```
/auth           - Public: Login/Signup tabs
/               - Protected: Home (redirects to /auth if not logged in)
/app/:appId     - Protected: App detail with User Management tab
/app/:appId/... - Protected: All app sub-routes
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Per-route guards | More boilerplate, inconsistent protection |
| Separate /login and /signup routes | Spec requires single page with tabs |
| HOC-based protection | Outdated pattern, hooks are preferred |

---

### 6. User Management UI Pattern

**Decision**: New tab in AppDetail page with user list and add/remove actions

**Rationale**:
- Matches existing tab pattern in AppDetail (flows, settings, etc.)
- Owner/admin can see all users with roles
- Owner role shown but not removable (disabled state)
- Add user by email (must exist in system)

**UI Components**:
- UserManagement.tsx - Tab content component
- User list with email, role, remove button
- Add user form: email input + role dropdown
- Owner badge/indicator that cannot be removed

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Separate /app/:id/users page | Breaks tab-based navigation pattern |
| Modal-based user management | Less discoverable, inconsistent UX |
| Settings sub-section | User management is distinct from app settings |

---

## Key Technical Decisions Summary

| Decision | Choice | Key Reason |
|----------|--------|------------|
| Auth Library | better-auth + nestjs-better-auth | Standalone, TypeScript-first |
| Session Storage | Cookie-based (compact) | Secure, server-revocable |
| Database Tables | better-auth managed + custom UserAppRole | Best of both worlds |
| Frontend State | better-auth/react + useAuth hook | Reactive, minimal code |
| Route Protection | App-level redirect to /auth | Simple, consistent |
| User Management | Tab in AppDetail | Matches existing patterns |

## Dependencies to Install

### Backend
```bash
cd packages/backend
pnpm add better-auth @thallesp/nestjs-better-auth
```

### Frontend
```bash
cd packages/frontend
pnpm add better-auth
```

## Configuration Files Needed

1. **Backend**: better-auth configuration in auth.module.ts
2. **Backend**: Environment variables for auth secret
3. **Frontend**: auth-client.ts with API URL
4. **Shared**: User and role types in shared package
