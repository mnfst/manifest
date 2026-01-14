# Quickstart: Edit Account Feature

**Feature Branch**: `001-edit-account`
**Created**: 2026-01-10

## Overview

This feature adds an Edit Account page allowing users to update their profile (first name, last name), change their email (with verification), and change their password.

## Prerequisites

- Node.js >= 18.0.0
- pnpm 9.15+
- Running SQLite database (auto-created at `./data/app.db`)
- Email service configured (console provider for development)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev

# Backend: http://localhost:3847
# Frontend: http://localhost:5173 (or next available)
```

## Implementation Checklist

### Backend (packages/backend)

1. **Create EmailVerificationToken Entity**
   - File: `src/auth/entities/email-verification-token.entity.ts`
   - Register in TypeORM entities array

2. **Update User Management Service**
   - File: `src/auth/user-management.service.ts`
   - Add: `updateProfile()`, `requestEmailChange()`, `verifyEmailChange()`

3. **Update User Management Controller**
   - File: `src/auth/user-management.controller.ts`
   - Add: `PATCH /users/me`, `POST /users/me/email`, `POST /users/me/email/verify`

4. **Create Email Template**
   - File: `src/email/templates/email-change-verification.tsx`
   - Register in template engine

5. **Update Email Service**
   - File: `src/email/email.service.ts`
   - Add: `sendEmailChangeVerification()`

### Frontend (packages/frontend)

1. **Create AccountTab Component**
   - File: `src/components/settings/AccountTab.tsx`
   - Profile form, email change, password change sections

2. **Update SettingsPage**
   - File: `src/pages/SettingsPage.tsx`
   - Add "Account" tab to tabs array

3. **Update UserAvatar Dropdown**
   - File: `src/components/layout/UserAvatar.tsx`
   - Add "Edit Account" menu item with navigation

4. **Update API Client**
   - File: `src/lib/api.ts`
   - Add: `updateProfile()`, `requestEmailChange()`, `verifyEmailChange()`

### Shared (packages/shared)

1. **Update Auth Types**
   - File: `src/types/auth.ts`
   - Add: UpdateProfileRequest, ChangeEmailRequest, etc.

2. **Update Email Types**
   - File: `src/types/email.ts`
   - Add: EMAIL_CHANGE_VERIFICATION to enum

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user profile (existing) |
| PATCH | `/api/users/me` | Update profile (new) |
| POST | `/api/users/me/email` | Request email change (new) |
| POST | `/api/users/me/email/verify` | Verify email change (new) |
| POST | `/api/users/me/password` | Change password (new) |

## Testing

### Manual Testing Flow

1. **Access Edit Account**
   - Log in → Click user avatar in sidebar → Select "Edit Account"
   - Verify: Settings page opens with Account tab

2. **Update Name**
   - Change first name and/or last name → Save
   - Verify: Success message, sidebar displays updated name

3. **Change Email**
   - Enter new email → Save
   - Verify: "Verification email sent" message
   - Check console (development) for email content
   - Click verification link
   - Verify: Email updated, can log in with new email

4. **Change Password**
   - Enter current password and new password → Save
   - Verify: Success message
   - Log out → Log in with new password

## Key Files Reference

```
packages/backend/src/
├── auth/
│   ├── entities/
│   │   └── email-verification-token.entity.ts  # New
│   ├── user-management.controller.ts           # Modified
│   └── user-management.service.ts              # Modified
└── email/
    ├── email.service.ts                        # Modified
    └── templates/
        └── email-change-verification.tsx       # New

packages/frontend/src/
├── components/
│   ├── layout/
│   │   └── UserAvatar.tsx                      # Modified
│   └── settings/
│       └── AccountTab.tsx                      # New
├── pages/
│   └── SettingsPage.tsx                        # Modified
└── lib/
    └── api.ts                                  # Modified

packages/shared/src/types/
├── auth.ts                                     # Modified
└── email.ts                                    # Modified
```

## Environment Variables

No new environment variables required. Uses existing:

- `EMAIL_PROVIDER` - Email provider (console/mailgun)
- `EMAIL_FROM` - Sender email address
- `APP_URL` - Base URL for verification links
