# Quickstart: App Secrets Vault

**Feature**: 001-app-secrets-vault
**Date**: 2026-01-16

## Overview

This guide provides a quick reference for implementing the App Secrets Vault feature. It covers the key components, patterns, and integration points.

## Implementation Order

1. **Shared Types** - Define TypeScript interfaces
2. **Backend Entity** - Create AppSecret entity
3. **Backend Service** - Implement CRUD operations
4. **Backend Controller** - Expose API endpoints
5. **Backend Module** - Wire up dependencies
6. **Frontend API Client** - Add secret methods
7. **Frontend Components** - Build SecretsTab and SecretRow
8. **Frontend Pages** - Create AppSettingsPage
9. **Navigation Updates** - Update Sidebar and UserAvatar
10. **Route Configuration** - Add new route to App.tsx

## Key Files to Create

### Backend

```
packages/backend/src/secret/
├── secret.entity.ts      # TypeORM entity
├── secret.service.ts     # Business logic
├── secret.controller.ts  # HTTP endpoints
└── secret.module.ts      # NestJS module
```

### Frontend

```
packages/frontend/src/
├── pages/
│   └── AppSettingsPage.tsx     # New page
├── components/settings/
│   ├── SecretsTab.tsx          # Secrets list + add form
│   └── SecretRow.tsx           # Individual secret row
└── types/
    └── tabs.ts                  # Update with new tab types
```

### Shared

```
packages/shared/src/types/
└── secret.ts                    # AppSecret interfaces
```

## Key Files to Modify

| File | Change |
|------|--------|
| `packages/backend/src/app.module.ts` | Import SecretModule |
| `packages/frontend/src/App.tsx` | Add `/app/:appId/settings` route |
| `packages/frontend/src/lib/api.ts` | Add secret API methods |
| `packages/frontend/src/components/layout/Sidebar.tsx` | Update Settings link logic |
| `packages/frontend/src/components/layout/UserAvatar.tsx` | Rename "Edit Account" → "User Settings" |
| `packages/frontend/src/pages/SettingsPage.tsx` | Remove General tab |
| `packages/shared/src/types/index.ts` | Export secret types |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/apps/:appId/secrets` | List all secrets for app |
| POST | `/api/apps/:appId/secrets` | Create new secret |
| PATCH | `/api/secrets/:secretId` | Update secret |
| DELETE | `/api/secrets/:secretId` | Delete secret |

## Component Patterns

### SecretsTab Structure

```tsx
function SecretsTab({ appId }: { appId: string }) {
  // State: secrets[], newKey, newValue, loading, error
  // Fetch secrets on mount
  // Render: Add form at top + SecretRow list
}
```

### SecretRow Structure

```tsx
function SecretRow({ secret, onUpdate, onDelete }: Props) {
  // State: isRevealed, isEditing, editKey, editValue
  // Render: Key | MaskedValue | EyeIcon | CopyIcon | MenuIcon
}
```

### UI Components to Use

- `Button` from shadcn/ui
- `Input` from shadcn/ui
- `DropdownMenu` from shadcn/ui
- `Eye`, `EyeOff`, `Copy`, `MoreVertical`, `Trash2`, `Pencil` from lucide-react

## Validation Rules

### Secret Key
- Required
- 1-256 characters
- Pattern: `^[A-Za-z_][A-Za-z0-9_]*$` (env var naming)
- Unique per app

### Secret Value
- Required
- No length limit
- Any characters allowed

## Error Handling

| Scenario | Backend Response | Frontend Display |
|----------|------------------|------------------|
| Duplicate key | 400 Bad Request | Inline error message |
| Empty fields | N/A (disabled button) | Validation on submit |
| Not found | 404 Not Found | Toast notification |
| Unauthorized | 401/403 | Redirect to login |

## Testing Checklist

After implementation, verify:

- [ ] User avatar dropdown shows "User Settings" (not "Edit Account")
- [ ] User Settings page shows Account and API Keys tabs (no General)
- [ ] Sidebar Settings link goes to `/app/:appId/settings` when app selected
- [ ] App Settings page shows with Secrets tab
- [ ] Can add a new secret
- [ ] Secrets appear with masked values
- [ ] Eye icon reveals/hides value
- [ ] Copy icon copies value and shows feedback
- [ ] Three-dot menu shows Edit and Delete options
- [ ] Can edit secret key and value
- [ ] Delete shows confirmation and removes secret
- [ ] Duplicate key shows error
- [ ] Empty state shows helpful message

## Run the App

After implementation, start the app for testing:

```bash
.specify/scripts/bash/serve-app.sh
```

This finds random ports and starts both backend and frontend.
