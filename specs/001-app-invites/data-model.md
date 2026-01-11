# Data Model: App User Invitations

**Feature**: 001-app-invites
**Date**: 2026-01-10

## Overview

This document defines the data entities required for the app invitation feature, including relationships with existing entities and validation rules.

---

## Entities

### PendingInvitation (NEW)

Represents an invitation sent to an email address that hasn't been accepted yet.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | Primary key | Unique identifier |
| email | VARCHAR(255) | NOT NULL, lowercase | Invited email address |
| token | VARCHAR(255) | NOT NULL, unique | Hashed invitation token |
| appId | VARCHAR(36) | NOT NULL, FK → App | Target app |
| inviterId | VARCHAR(36) | NOT NULL | User who sent the invitation |
| role | VARCHAR(20) | NOT NULL, CHECK(role IN ('admin')) | Role to assign on acceptance |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT now | When invitation was created |

**Indexes:**
- `UNIQUE(email, appId)` - Prevents duplicate invitations
- `INDEX(token)` - Fast token lookup for acceptance
- `INDEX(appId)` - Fast listing of pending invitations per app

**Relationships:**
- `ManyToOne → App` with CASCADE DELETE (invitations deleted when app deleted)

**Lifecycle:**
1. Created when admin invites non-existent user
2. Updated (new token) when invitation is resent
3. Deleted when accepted or revoked

---

### App (EXISTING - No changes)

Reference for relationship context.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR | App name |
| ... | ... | Other fields unchanged |

**New Relationship:**
- `OneToMany → PendingInvitation` (app can have many pending invitations)

---

### UserAppRole (EXISTING - No changes)

Reference for the target state after invitation acceptance.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| userId | VARCHAR | User ID (from better-auth) |
| appId | VARCHAR | App ID |
| role | VARCHAR | 'owner' or 'admin' |
| createdAt | TIMESTAMP | When access was granted |

---

### User (EXTERNAL - better-auth)

Users are managed by better-auth in a separate SQLite database.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR | User email (case-insensitive) |
| name | VARCHAR | Display name |
| ... | ... | Other auth fields |

---

## Validation Rules

### Email Validation
- Must be valid email format
- Stored as lowercase for case-insensitive matching
- Maximum length: 255 characters

### Token Validation
- Generated: 32 bytes crypto-random, base64url encoded
- Stored: bcrypt hash (cost factor 10)
- Token must be unique across all invitations

### Role Validation
- Only 'admin' role can be assigned via invitation
- 'owner' role is assigned only at app creation

### Business Rules

| Rule | Enforcement |
|------|-------------|
| No duplicate invitations | UNIQUE constraint on (email, appId) |
| User must not already have access | Check before creating invitation |
| Inviter must have canManageUsers permission | AppAccessGuard + service validation |
| Email must not belong to existing user | Check triggers invite flow vs direct add |

---

## State Transitions

### Invitation Lifecycle

```
[Not Invited]
    │
    ▼ (Admin enters email, user doesn't exist)
[Pending] ◄─────────────────────────┐
    │                               │
    ├── (Resend clicked) ───────────┘
    │
    ├── (Revoke clicked) ──► [Deleted]
    │
    ▼ (User clicks accept link)
[Accepted] ──► UserAppRole created ──► [PendingInvitation Deleted]
```

### User Addition Flow

```
Admin enters email
    │
    ▼
┌─────────────────────────────────┐
│ Does user exist in system?      │
└─────────────────────────────────┘
    │                    │
   YES                   NO
    │                    │
    ▼                    ▼
Add directly to      Show invite modal
UserAppRole          "Send invite?"
                         │
                        YES
                         │
                         ▼
                  Create PendingInvitation
                  Send invitation email
```

---

## Migration Strategy

### New Table: `pending_invitations`

```sql
CREATE TABLE pending_invitations (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  app_id VARCHAR(36) NOT NULL,
  inviter_id VARCHAR(36) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK(role IN ('admin')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  UNIQUE(email, app_id)
);

CREATE INDEX idx_pending_invitations_token ON pending_invitations(token);
CREATE INDEX idx_pending_invitations_app_id ON pending_invitations(app_id);
```

**Note:** TypeORM with `synchronize: true` (POC mode) will auto-create this table.

---

## TypeScript Interfaces

### Shared Types (packages/shared)

```typescript
// types/auth.ts additions

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
  // Active user fields
  name?: string | null;
  isOwner?: boolean;
  // Pending invitation fields
  invitedBy?: string;
  inviterName?: string;
}
```

### Backend Entity

```typescript
// auth/pending-invitation.entity.ts

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

---

## Entity Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────┐
│        User         │       │        App          │
│  (better-auth DB)   │       │                     │
├─────────────────────┤       ├─────────────────────┤
│ id: UUID (PK)       │       │ id: UUID (PK)       │
│ email: VARCHAR      │       │ name: VARCHAR       │
│ name: VARCHAR       │       │ ...                 │
└─────────────────────┘       └──────────┬──────────┘
         │                               │
         │                               │
         │ inviterId (ref)               │ 1:N
         │                               │
         ▼                               ▼
┌─────────────────────────────────────────────────────┐
│                PendingInvitation                     │
├─────────────────────────────────────────────────────┤
│ id: UUID (PK)                                        │
│ email: VARCHAR (invited user's email)                │
│ token: VARCHAR (hashed, unique)                      │
│ appId: VARCHAR (FK → App)                            │
│ inviterId: VARCHAR (ref to User)                     │
│ role: VARCHAR ('admin')                              │
│ createdAt: TIMESTAMP                                 │
├─────────────────────────────────────────────────────┤
│ UNIQUE(email, appId)                                 │
└─────────────────────────────────────────────────────┘
         │
         │ On accept
         ▼
┌─────────────────────────────────────────────────────┐
│                 UserAppRole                          │
├─────────────────────────────────────────────────────┤
│ id: UUID (PK)                                        │
│ userId: VARCHAR (now points to registered user)      │
│ appId: VARCHAR (FK → App)                            │
│ role: VARCHAR ('owner' | 'admin')                    │
│ createdAt: TIMESTAMP                                 │
├─────────────────────────────────────────────────────┤
│ UNIQUE(userId, appId)                                │
└─────────────────────────────────────────────────────┘
```
