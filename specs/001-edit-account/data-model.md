# Data Model: Edit Account Feature

**Feature Branch**: `001-edit-account`
**Created**: 2026-01-10

## Entities

### User (Existing - Managed by better-auth)

The User entity is managed by better-auth and already exists. This feature uses the following fields:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string | PRIMARY KEY | Unique user identifier |
| email | string | UNIQUE, NOT NULL | User's login email address |
| name | string | nullable | Display name (derived from firstName + lastName) |
| firstName | string | NOT NULL | User's first name (custom field) |
| lastName | string | NOT NULL | User's last name (custom field) |
| emailVerified | boolean | default: false | Whether email has been verified |
| image | string | nullable | Profile image URL |
| createdAt | datetime | auto | Account creation timestamp |
| updatedAt | datetime | auto-update | Last modification timestamp |

**Validation Rules**:
- At least one of firstName or lastName must be non-empty (FR-004)
- Email must be valid email format
- Email must be unique across all users

**State Transitions**: None - standard CRUD operations

---

### EmailVerificationToken (New)

Stores verification tokens for email change requests.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string (UUID) | PRIMARY KEY | Unique token identifier |
| token | string | UNIQUE, NOT NULL, INDEX | Verification token value |
| userId | string | NOT NULL, FK → User.id | User requesting the change |
| currentEmail | string | NOT NULL | User's current email at time of request |
| newEmail | string | NOT NULL | Requested new email address |
| expiresAt | datetime | NOT NULL | Token expiration timestamp |
| createdAt | datetime | auto | Token creation timestamp |
| usedAt | datetime | nullable | When token was used (null if unused) |

**Validation Rules**:
- Token expires after 24 hours (FR-007)
- newEmail must not belong to another user (FR-008)
- Only one active (unused, unexpired) token per user
- Previous tokens invalidated when new request made

**State Transitions**:
```
CREATED → USED (verified)
CREATED → EXPIRED (time elapsed)
CREATED → INVALIDATED (new token requested)
```

**Indexes**:
- `token` - for quick lookup during verification
- `userId` - for finding user's pending requests
- `expiresAt` - for cleanup of expired tokens

---

## Relationships

```
User (1) ←──────── (0..1) EmailVerificationToken
         has pending
```

A User can have at most one active (pending) EmailVerificationToken at a time. When a new email change is requested, any previous pending token is invalidated.

---

## Type Definitions

### Shared Types (packages/shared/src/types/auth.ts)

```typescript
// Existing - extend with firstName/lastName
export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  image?: string | null;
  createdAt: string;
}

// New
export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  name?: string; // Derived, optional override
}

export interface ChangeEmailRequest {
  newEmail: string;
}

export interface VerifyEmailChangeRequest {
  token: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
}

export interface UpdateProfileResponse {
  user: UserProfile;
  message: string;
}

export interface ChangeEmailResponse {
  message: string;
  pendingEmail: string;
  expiresAt: string;
}

export interface VerifyEmailChangeResponse {
  user: UserProfile;
  message: string;
}

export interface ChangePasswordResponse {
  message: string;
}
```

### Email Types (packages/shared/src/types/email.ts)

```typescript
// Add to existing EmailTemplateType enum
export enum EmailTemplateType {
  PASSWORD_RESET = 'password-reset',
  INVITATION = 'invitation',
  EMAIL_CHANGE_VERIFICATION = 'email-change-verification', // New
}

// New
export interface EmailChangeVerificationEmailProps {
  userName: string;
  newEmail: string;
  verificationLink: string;
  expiresIn: string; // e.g., "24 hours"
}
```

---

## Database Migrations

### New Table: email_verification_token

```sql
CREATE TABLE email_verification_token (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  current_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_token ON email_verification_token(token);
CREATE INDEX idx_user_id ON email_verification_token(user_id);
CREATE INDEX idx_expires_at ON email_verification_token(expires_at);
```

**Note**: Using TypeORM entity with SQLite will auto-generate the migration.
