# Quickstart: App List Home Page and Header Navigation

**Feature**: 003-app-list-header
**Date**: 2025-12-26

## Prerequisites

- Node.js 18+
- pnpm 9+
- Git

## Setup

```bash
# Clone and checkout feature branch
git checkout 003-app-list-header

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

This starts:
- Backend: http://localhost:3000
- Frontend: http://localhost:5173

## Verification Workflow

### User Story 1: App List Home Page

1. Navigate to http://localhost:5173/
2. **Expected**: See list of existing apps (or empty state if none)
3. Click on any app card
4. **Expected**: Navigate to /app/:appId dashboard

### User Story 2: Create New App Button

1. On home page, click "Create new app" button
2. **Expected**: Modal with app creation form appears
3. Fill in "Name" and optionally "Description"
4. Click "Create"
5. **Expected**:
   - Modal closes
   - New app appears in list
   - Navigate to new app's dashboard

### User Story 3: App Switcher in Header

1. Navigate to any app: /app/:appId
2. **Expected**: Header shows current app name
3. Click on app name in header
4. **Expected**: Dropdown opens with list of all apps
5. Click on another app
6. **Expected**: Navigate to that app's dashboard

### User Story 4: Dummy User Avatar

1. On any page within /app/:appId/*
2. **Expected**: Top-right shows avatar with "DU" initials and "Demo User" name
3. Hover over avatar
4. **Expected**: No action (non-interactive in POC)

## API Testing

### List all apps

```bash
curl http://localhost:3000/api/apps
```

**Expected**: JSON array of apps

### Create app (for testing)

```bash
curl -X POST http://localhost:3000/api/apps \
  -H "Content-Type: application/json" \
  -d '{"name": "Test App", "description": "For testing"}'
```

## Troubleshooting

### Empty app list
This is expected on fresh database. Create apps using the form or API.

### Header not showing app name
Ensure you're on a route that matches `/app/:appId/*`. Home page does not show header.

### Database errors
Delete the SQLite database and restart:
```bash
rm packages/backend/data/app.db
pnpm dev
```

## Success Criteria Checklist

- [ ] SC-001: Users can view all apps from home page immediately
- [ ] SC-002: Users can create app in under 3 clicks (button → fill form → submit)
- [ ] SC-003: Users can switch apps in under 2 clicks (click header → click app)
- [ ] SC-004: All navigation paths remain functional
- [ ] SC-005: No regression in app creation/editing
