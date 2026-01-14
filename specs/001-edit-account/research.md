# Research: Edit Account Feature

**Feature Branch**: `001-edit-account`
**Created**: 2026-01-10
**Status**: Complete

## Research Topics

### 1. Better-Auth User Profile Update

**Decision**: Implement custom profile update endpoint

**Rationale**: Better-auth does not provide a built-in client-side method to update custom fields (`firstName`, `lastName`) or the core `name` field directly. While an Admin Plugin exists with `adminUpdateUser()`, it requires elevated permissions not suitable for user self-service.

**Alternatives Considered**:
- Enable Admin Plugin and use `adminUpdateUser()` - Rejected: Overcomplicates for self-service, requires admin role management
- Direct database modification - Rejected: Bypasses better-auth session validation
- Custom PATCH endpoint using better-auth's internal DB access - Selected: Follows existing pattern in user-management.controller.ts

**Implementation Notes**:
- Use existing better-sqlite3 database connection pattern from user-management.service.ts
- Validate session using `@CurrentUser()` decorator
- Return updated UserProfile type for consistency

---

### 2. Email Change Verification Flow

**Decision**: Implement custom email verification token system

**Rationale**: Better-auth's built-in email verification (`sendVerificationEmail()`, `verifyEmail()`) is designed for initial account verification, not email change verification. It doesn't support changing to a different email address.

**Alternatives Considered**:
- Use better-auth's email verification with workaround - Rejected: Not designed for email changes, would require hacks
- Store tokens in memory/cache - Rejected: Loses state on restart, not persistent
- TypeORM entity for verification tokens - Selected: Matches existing entity patterns, supports expiration, works with SQLite

**Implementation Notes**:
- Create `EmailVerificationToken` TypeORM entity
- Fields: `id`, `token` (UUID), `userId`, `newEmail`, `expiresAt`, `createdAt`, `usedAt`
- Token expiration: 24 hours (per FR-007)
- Invalidate previous tokens when new request made (per edge case)
- Verify new email not already registered before sending

---

### 3. Password Change Integration

**Decision**: Use better-auth's `changePassword()` method via client

**Rationale**: Better-auth provides built-in password change with current password verification. This handles hashing, session management, and security best practices.

**Alternatives Considered**:
- Custom password change endpoint with manual hashing - Rejected: Reinvents wheel, potential security issues
- Direct database update - Rejected: Bypasses password hashing
- Use better-auth client method - Selected: Built-in, secure, handles session revocation

**Implementation Notes**:
- Frontend calls `authClient.changePassword()` directly
- Parameters: `currentPassword`, `newPassword`, optional `revokeOtherSessions`
- Password validation: minimum 8 characters (per FR-011)
- Empty fields = no change (per FR-010)

---

### 4. Database Schema for User Fields

**Decision**: Use existing better-auth user table with custom fields

**Rationale**: Better-auth already manages the user table in SQLite. The `firstName` and `lastName` custom fields are already configured in auth.ts.

**Current Schema**:
```
user table:
- id: TEXT PRIMARY KEY
- name: TEXT (optional, display name)
- email: TEXT UNIQUE NOT NULL
- emailVerified: INTEGER (boolean)
- image: TEXT (optional)
- createdAt: TEXT (ISO date)
- updatedAt: TEXT (ISO date)
- firstName: TEXT NOT NULL (custom field)
- lastName: TEXT NOT NULL (custom field)
```

**Implementation Notes**:
- firstName and lastName are already separate columns (per FR-001)
- Use direct SQL via better-sqlite3 for updates (following existing pattern)
- Update `name` field as derived from firstName + lastName for display purposes

---

### 5. Frontend Navigation Pattern

**Decision**: Add menu item to existing UserAvatar dropdown

**Rationale**: The UserAvatar component already has a dropdown menu with "Sign Out". Adding "Edit Account" follows the established pattern.

**Alternatives Considered**:
- New sidebar navigation item - Rejected: Account settings should be in user context
- Settings page with new tab - Selected in addition: Account tab in Settings page for the form
- Floating profile button - Rejected: Not consistent with current design

**Implementation Notes**:
- UserAvatar.tsx: Add "Edit Account" menu item above "Sign Out"
- Navigate to `/settings` with `?tab=account` or similar
- SettingsPage.tsx: Add "Account" tab alongside existing "General" and "API Keys"

---

### 6. Email Template Pattern

**Decision**: Create new React Email template following existing patterns

**Rationale**: Existing email templates (password-reset.tsx, invitation.tsx) provide clear patterns for branding and layout.

**Template Structure**:
- Use BaseLayout, Header, Button, Footer components
- Match existing color scheme (Primary: #4F46E5)
- Include: userName, newEmail, verificationLink, expiresIn

**Implementation Notes**:
- Add new template type to EmailTemplateType enum
- Create email-change-verification.tsx in templates directory
- Add sendEmailChangeVerification() method to email.service.ts

---

## Resolved Clarifications

| Topic | Resolution |
|-------|------------|
| User profile update method | Custom endpoint using direct SQLite |
| Email change verification | Custom token entity + endpoints |
| Password change | better-auth client method |
| Navigation entry point | UserAvatar dropdown + Settings tab |
| Token storage | TypeORM entity in SQLite |

## Dependencies Identified

| Dependency | Purpose | Already Installed |
|------------|---------|-------------------|
| better-auth | User session, password change | Yes |
| better-sqlite3 | Direct database access | Yes |
| TypeORM | Entity management for tokens | Yes |
| @react-email/components | Email template | Yes |
| uuid | Token generation | Need to verify |

## Best Practices Applied

1. **Follow existing patterns**: Use same controller/service structure as user-management
2. **Type safety**: Define DTOs and interfaces in shared package
3. **Security**: Validate session on all endpoints, verify current password
4. **UX consistency**: Reuse existing UI components, follow form patterns
5. **Email reliability**: Follow existing email service patterns with provider abstraction
