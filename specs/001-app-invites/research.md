# Research: App User Invitations

**Feature**: 001-app-invites
**Date**: 2026-01-10

## Overview

This document consolidates research findings for implementing the app invitation feature, covering secure token generation, invitation acceptance flows, and integration patterns with the existing codebase.

---

## 1. Secure Invitation Token Generation

### Decision: Use `crypto.randomBytes()` with base64url encoding

**Rationale:**
- Native Node.js crypto module - no external dependencies
- Cryptographically secure random number generator
- Aligns with OAuth 2.0 specification (128+ bits entropy)
- Base64url encoding is URL-safe (no padding issues)

**Alternatives Considered:**
| Alternative | Rejected Because |
|-------------|------------------|
| UUID v4 | Lower entropy (122 bits), predictable structure |
| `Math.random()` | Not cryptographically secure |
| JWT tokens | Overhead for simple use case, tokens don't need to be self-contained |
| External libs (nanoid) | Unnecessary dependency when native crypto suffices |

**Implementation:**
```typescript
import { randomBytes } from 'crypto';

export function generateInvitationToken(): string {
  // 32 bytes = 256 bits of entropy
  return randomBytes(32).toString('base64url');
}
```

### Decision: Hash tokens before database storage

**Rationale:**
- Prevents token compromise if database is breached
- Follows OWASP security guidelines
- Pattern consistent with password storage

**Implementation:**
```typescript
import * as bcrypt from 'bcrypt';

// Store hashed version
const hashedToken = await bcrypt.hash(token, 10);

// Validate by comparing
const isValid = await bcrypt.compare(providedToken, storedHash);
```

---

## 2. Token Storage Entity Design

### Decision: Create dedicated `PendingInvitationEntity`

**Rationale:**
- Follows Single Responsibility Principle (SRP)
- Separate lifecycle from active user-app relationships
- Enables unique constraints per email-app combination
- Pattern matches existing `UserAppRoleEntity`

**Entity Structure:**
```typescript
@Entity('pending_invitations')
@Unique(['email', 'appId'])
export class PendingInvitationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  email: string;  // Lowercase, case-insensitive

  @Column({ type: 'varchar' })
  token: string;  // Hashed token

  @Column({ type: 'varchar' })
  appId: string;

  @Column({ type: 'varchar' })
  inviterId: string;

  @Column({ type: 'varchar', length: 20 })
  role: AppRole;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => AppEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appId' })
  app: AppEntity;
}
```

---

## 3. Invitation Acceptance Flow

### Decision: Query parameter + sessionStorage preservation

**Rationale:**
- Query parameters make links shareable and debuggable
- SessionStorage preserves context through auth redirect (cleared on browser close)
- Pattern aligns with existing frontend auth flow

**Alternatives Considered:**
| Alternative | Rejected Because |
|-------------|------------------|
| URL-only state | Token gets logged in server access logs |
| localStorage | Persists too long; stale invitations |
| Backend session | Complicates stateless auth flow |
| Cookie storage | HttpOnly cookies can't be read by JS |

**Flow Implementation:**

1. **Email Link Format:**
   ```
   https://app.example.com/accept-invite?token=<TOKEN>&appId=<APP_ID>&email=<EMAIL>
   ```

2. **Frontend Handler (`/accept-invite`):**
   - Extract params from URL
   - Store in sessionStorage for auth redirect survival
   - If not authenticated → redirect to `/auth` with `returnTo` param
   - If authenticated → validate email match and call accept API

3. **Post-Auth Handling:**
   - Check sessionStorage for pending invitation
   - Auto-accept if email matches
   - Clear sessionStorage after success

---

## 4. Email Integration

### Decision: Adapt existing `invitation.tsx` template

**Rationale:**
- Template already exists with proper styling
- Email service infrastructure fully built out
- Only modification needed: construct acceptance link with token

**Existing Props Interface:**
```typescript
interface InvitationEmailProps {
  inviterName: string;
  appName: string;
  appLink: string;      // ← Include token here
  personalMessage?: string;
}
```

**Link Construction:**
```typescript
const appLink = `${FRONTEND_URL}/accept-invite?token=${token}&appId=${appId}&email=${encodeURIComponent(email)}`;
```

---

## 5. API Endpoint Design

### Decision: Create dedicated InvitationController

**Rationale:**
- Separates invitation logic from user management
- Follows Open/Closed principle
- Cleaner authorization boundaries

**Endpoints:**

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/apps/:appId/invitations` | Create invitation | AppAccessGuard |
| GET | `/api/apps/:appId/invitations` | List pending | AppAccessGuard |
| POST | `/api/apps/:appId/invitations/:id/resend` | Resend email | AppAccessGuard |
| DELETE | `/api/apps/:appId/invitations/:id` | Revoke | AppAccessGuard |
| POST | `/api/invitations/accept` | Accept invitation | Auth required |
| GET | `/api/invitations/validate` | Validate token | Public |

---

## 6. User List Integration

### Decision: Merge active users and pending invitations in single response

**Rationale:**
- Single API call for frontend
- Consistent sorting (active first, then pending)
- Clear distinction via `status` field

**Response Structure:**
```typescript
interface AppUserListItem {
  // Common fields
  id: string;
  email: string;
  role: AppRole;
  createdAt: string;

  // Discriminator
  status: 'active' | 'pending';

  // Active-only fields
  name?: string;
  isOwner?: boolean;

  // Pending-only fields
  invitedBy?: string;
}
```

---

## 7. Security Considerations

### Decisions Made:

| Concern | Decision |
|---------|----------|
| Token entropy | 256 bits (32 bytes) |
| Token storage | Hashed with bcrypt (cost 10) |
| Token comparison | Use `bcrypt.compare()` (timing-safe) |
| Token expiration | Non-expiring (per spec), with revocation |
| Email validation | Case-insensitive matching |
| HTTPS | Required for all invitation links |

### Validation Rules:

1. Token must exist in database (not already accepted)
2. Authenticated user's email must match invitation email
3. Token must belong to the specified appId
4. User must not already have access to the app

---

## 8. Edge Case Handling

| Scenario | Behavior |
|----------|----------|
| Duplicate invite (same email+app) | Return existing invitation, option to resend |
| User registers independently | Invitation still valid; clicking accepts |
| Email invited to multiple apps | Each invitation independent |
| App deleted | CASCADE delete removes invitations |
| Token reused after acceptance | 404 Not Found (token deleted) |

---

## 9. Frontend Components

### Decision: Create dedicated InviteUserModal component

**Rationale:**
- Follows pattern of EditAppModal, CreateAppModal
- Separation of concerns from UserManagement.tsx
- Reusable confirmation modal pattern

**Component Structure:**
```typescript
interface InviteUserModalProps {
  isOpen: boolean;
  email: string;
  appName: string;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  error?: string | null;
}
```

---

## 10. Implementation Dependencies

**Backend (new):**
- `bcrypt` - Already available (via better-auth dependencies)

**Frontend (existing):**
- All needed dependencies present

**Shared Types (new):**
```typescript
// Add to packages/shared/src/types/auth.ts
interface PendingInvitation {
  id: string;
  email: string;
  role: AppRole;
  appId: string;
  invitedBy: string;
  createdAt: string;
}

interface CreateInvitationRequest {
  email: string;
  role: AppRole;
}

interface AcceptInvitationRequest {
  token: string;
  appId: string;
}
```

---

## References

- Existing entity pattern: `packages/backend/src/auth/user-app-role.entity.ts`
- Email service: `packages/backend/src/email/email.service.ts`
- Email template: `packages/backend/src/email/templates/invitation.tsx`
- Modal pattern: `packages/frontend/src/components/app/EditAppModal.tsx`
- API client: `packages/frontend/src/lib/api.ts`
- Auth types: `packages/shared/src/types/auth.ts`
