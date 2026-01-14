# Quickstart: App User Invitations

**Feature**: 001-app-invites
**Date**: 2026-01-10

## Overview

This guide provides a quick reference for implementing the app user invitations feature. Follow the implementation order below for optimal development flow.

---

## Implementation Order

### 1. Backend: Entity & Database

**File**: `packages/backend/src/auth/pending-invitation.entity.ts`

Create the PendingInvitation entity following the pattern in `user-app-role.entity.ts`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { AppEntity } from '../app/app.entity';
import { AppRole } from '@flows-and-nodes/shared';

@Entity('pending_invitations')
@Unique(['email', 'appId'])
export class PendingInvitationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  token!: string;

  @Column({ type: 'varchar', length: 36 })
  appId!: string;

  @Column({ type: 'varchar', length: 36 })
  inviterId!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: AppRole;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => AppEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appId' })
  app!: AppEntity;
}
```

**Register entity** in `app.module.ts` TypeORM entities array.

---

### 2. Shared Types

**File**: `packages/shared/src/types/auth.ts`

Add new types:

```typescript
export interface PendingInvitation {
  id: string;
  email: string;
  role: AppRole;
  appId: string;
  invitedBy: string;
  inviterName?: string;
  createdAt: string;
}

export interface CreateInvitationRequest {
  email: string;
  role: AppRole;
}

export interface AcceptInvitationRequest {
  token: string;
}

export interface AppUserListItem {
  id: string;
  email: string;
  role: AppRole;
  createdAt: string;
  status: 'active' | 'pending';
  name?: string | null;
  isOwner?: boolean;
  invitedBy?: string;
  inviterName?: string;
}
```

---

### 3. Backend: Invitation Service

**File**: `packages/backend/src/auth/invitation.service.ts`

Core methods:
- `createInvitation(appId, email, role, inviterId)` - Creates invitation, sends email
- `listPendingInvitations(appId)` - Lists pending invitations for app
- `resendInvitation(invitationId)` - Regenerates token, resends email
- `revokeInvitation(invitationId)` - Deletes invitation
- `validateToken(token)` - Validates token, returns invitation details
- `acceptInvitation(token, userId)` - Accepts invitation, creates UserAppRole

Key implementation notes:
- Use `crypto.randomBytes(32).toString('base64url')` for token generation
- Hash token with bcrypt before storing
- Send token in email, store hash in database

---

### 4. Backend: Invitation Controller

**File**: `packages/backend/src/auth/invitation.controller.ts`

Endpoints (see `contracts/invitations-api.yaml` for full spec):

```typescript
@Controller('api')
export class InvitationController {
  @Post('apps/:appId/invitations')
  @UseGuards(AppAccessGuard)
  async createInvitation(/* ... */) {}

  @Get('apps/:appId/invitations')
  @UseGuards(AppAccessGuard)
  async listInvitations(/* ... */) {}

  @Post('apps/:appId/invitations/:invitationId/resend')
  @UseGuards(AppAccessGuard)
  async resendInvitation(/* ... */) {}

  @Delete('apps/:appId/invitations/:invitationId')
  @UseGuards(AppAccessGuard)
  async revokeInvitation(/* ... */) {}

  @Get('invitations/validate')
  @Public()
  async validateToken(/* ... */) {}

  @Post('invitations/accept')
  async acceptInvitation(/* ... */) {}
}
```

---

### 5. Backend: Update User List

**File**: `packages/backend/src/auth/user-management.service.ts`

Modify `listAppUsers()` to merge active users and pending invitations:

```typescript
async listAppUsersWithInvitations(appId: string): Promise<AppUserListItem[]> {
  const activeUsers = await this.listAppUsers(appId);
  const pendingInvitations = await this.invitationService.listPendingInvitations(appId);

  return [
    ...activeUsers.map(u => ({ ...u, status: 'active' as const })),
    ...pendingInvitations.map(i => ({
      id: i.id,
      email: i.email,
      role: i.role,
      createdAt: i.createdAt,
      status: 'pending' as const,
      invitedBy: i.invitedBy,
      inviterName: i.inviterName,
    })),
  ];
}
```

---

### 6. Frontend: API Client

**File**: `packages/frontend/src/lib/api.ts`

Add new methods:

```typescript
export const api = {
  // ... existing methods

  // Invitations
  async createInvitation(appId: string, request: CreateInvitationRequest): Promise<PendingInvitation> {
    return fetchApi(`/apps/${appId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async resendInvitation(appId: string, invitationId: string): Promise<void> {
    return fetchApi(`/apps/${appId}/invitations/${invitationId}/resend`, {
      method: 'POST',
    });
  },

  async revokeInvitation(appId: string, invitationId: string): Promise<void> {
    return fetchApi(`/apps/${appId}/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  },

  async validateInvitation(token: string): Promise<InvitationValidation> {
    return fetchApi(`/invitations/validate?token=${encodeURIComponent(token)}`);
  },

  async acceptInvitation(token: string): Promise<AcceptInvitationResponse> {
    return fetchApi('/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
};
```

---

### 7. Frontend: Invite Modal

**File**: `packages/frontend/src/components/app/InviteUserModal.tsx`

Follow the pattern from `EditAppModal.tsx`:

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

export function InviteUserModal({ isOpen, email, appName, onClose, onConfirm, isLoading, error }: InviteUserModalProps) {
  // Modal implementation with:
  // - Confirmation message: "{email} is not a Manifest user..."
  // - Cancel and Send Invite buttons
  // - Loading state
  // - Error display
}
```

---

### 8. Frontend: Update UserManagement

**File**: `packages/frontend/src/components/app/UserManagement.tsx`

Changes needed:
1. Modify add user flow to detect non-existent user → show InviteUserModal
2. Update user list to display pending invitations with:
   - Muted/disabled styling
   - "Pending Invite" badge
   - Mail icon (resend button)
   - Remove button (revoke)
3. Handle resend and revoke actions with toast feedback

---

### 9. Frontend: Accept Invitation Page

**File**: `packages/frontend/src/pages/AcceptInvite.tsx`

Create new route `/accept-invite`:

```typescript
export function AcceptInvitePage() {
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token');

  const { user, isAuthenticated, isLoading } = useAuth();
  const [validation, setValidation] = useState<InvitationValidation | null>(null);

  // 1. Validate token on mount
  // 2. If not authenticated, redirect to /auth with return URL
  // 3. If authenticated, show accept button
  // 4. On accept, call API and redirect to app
}
```

Add route in router configuration.

---

## Testing Flow

### Manual Test Checklist

1. **Create Invitation**
   - [ ] Enter non-existent email in Users tab
   - [ ] Verify invite modal appears
   - [ ] Click Send Invite
   - [ ] Verify email appears in list with "Pending" status

2. **View Pending Invitations**
   - [ ] Pending invites show muted styling
   - [ ] "Pending Invite" badge visible
   - [ ] Mail icon and remove button visible

3. **Resend Invitation**
   - [ ] Click mail icon
   - [ ] Verify success toast
   - [ ] Check email received (if email configured)

4. **Revoke Invitation**
   - [ ] Click remove button
   - [ ] Verify invitation removed from list

5. **Accept Invitation**
   - [ ] Click link in email
   - [ ] If logged out, redirect to auth
   - [ ] After login, verify access to app
   - [ ] Invitation should disappear from pending list

---

## Key Files Reference

| Category | File |
|----------|------|
| Entity | `packages/backend/src/auth/pending-invitation.entity.ts` |
| Service | `packages/backend/src/auth/invitation.service.ts` |
| Controller | `packages/backend/src/auth/invitation.controller.ts` |
| Types | `packages/shared/src/types/auth.ts` |
| API Client | `packages/frontend/src/lib/api.ts` |
| Modal | `packages/frontend/src/components/app/InviteUserModal.tsx` |
| User List | `packages/frontend/src/components/app/UserManagement.tsx` |
| Accept Page | `packages/frontend/src/pages/AcceptInvite.tsx` |
| Email Template | `packages/backend/src/email/templates/invitation.tsx` |

---

## Common Gotchas

1. **Token storage**: Store HASHED token in DB, send plain token in email
2. **Email case**: Always lowercase emails before comparison
3. **Cascade delete**: Ensure app deletion cascades to invitations
4. **Unique constraint**: Handle duplicate invitation gracefully (offer resend)
5. **Auth redirect**: Use sessionStorage to preserve invitation context through auth flow
