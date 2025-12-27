# Quickstart: Navigation Sidebar

**Feature Branch**: `007-sidebar`
**Created**: 2025-12-27

## Overview

This feature adds a persistent navigation sidebar to the application with:
- "Apps" shortcut → links to app list page ("/")
- "Flows" shortcut → links to new flows listing page ("/flows")

## Prerequisites

- Node.js >= 18.0.0
- Existing development environment set up
- Backend and frontend running (see main project README)

## Quick Verification

After implementation, verify the feature works:

1. **Start the application**
   ```bash
   # Terminal 1: Backend
   cd packages/backend && npm run start:dev

   # Terminal 2: Frontend
   cd packages/frontend && npm run dev
   ```

2. **Check sidebar visibility**
   - Navigate to http://localhost:5173
   - Sidebar should be visible on the left side
   - "Apps" and "Flows" navigation items should be present

3. **Test Apps navigation**
   - Click "Apps" in sidebar
   - Should navigate to "/" (app list page)
   - "Apps" item should be highlighted

4. **Test Flows navigation**
   - Click "Flows" in sidebar
   - Should navigate to "/flows" (flows listing page)
   - "Flows" item should be highlighted
   - Page should show all flows with parent app names

5. **Test persistence**
   - Navigate to an app detail page (click an app)
   - Sidebar should still be visible
   - Navigate to a flow detail page
   - Sidebar should still be visible

## Key Files

### Backend
- `packages/backend/src/flow/flow.controller.ts` - New `GET /api/flows` endpoint
- `packages/backend/src/flow/flow.service.ts` - New `findAllWithApp()` method

### Frontend
- `packages/frontend/src/components/layout/Sidebar.tsx` - Main sidebar component
- `packages/frontend/src/pages/FlowsPage.tsx` - New flows listing page
- `packages/frontend/src/App.tsx` - Layout integration
- `packages/frontend/src/lib/api.ts` - New `getAllFlows()` API method

### Shared
- `packages/shared/src/types/flow.ts` - New `FlowWithApp` interface

## API Endpoint

### GET /api/flows

Returns all flows with their parent app data.

**Response Example**:
```json
[
  {
    "id": "flow-uuid",
    "appId": "app-uuid",
    "name": "Get Customer Orders",
    "toolName": "getCustomerOrders",
    "isActive": true,
    "app": {
      "id": "app-uuid",
      "name": "E-Commerce App",
      "slug": "e-commerce-app"
    }
  }
]
```

## Styling Notes

The sidebar uses Tailwind CSS classes consistent with existing components:
- Fixed width on large screens
- Background: `bg-card` or `bg-background`
- Text: `text-foreground`
- Active state: highlighted background/border
- Hover state: subtle background change

## Empty States

- **No flows**: Shows message with link to Apps page
- **No apps**: Flows page inherently shows "No flows yet"

## Future Enhancements (Post-POC)

- Responsive collapse (icon-only on medium screens)
- Mobile hamburger menu
- Sidebar section collapsing
- Recent items section
