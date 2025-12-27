# Research: App & Flow Management

**Feature**: 005-app-flow-management
**Date**: 2025-12-26

## Overview

This research documents the existing patterns in the codebase that will be extended for the App & Flow Management feature. No external research was required as all functionality builds on established patterns.

## Existing Patterns Analysis

### 1. CRUD Operations Pattern

**Decision**: Follow existing service/controller patterns

**Existing Implementation**:
- `AppService.create()` - Creates apps with auto-generated slugs
- `AppService.update()` - Updates app properties (already exists at `packages/backend/src/app/app.service.ts:115`)
- `FlowService.create()` - Creates flows for apps
- `FlowService.update()` - Updates flow properties (already exists)
- `FlowService.delete()` - Deletes flows (already exists at `packages/backend/src/flow/flow.service.ts:66`)

**Gap Analysis**:
- ❌ `AppService.delete()` - Missing, needs to be added
- ❌ App delete endpoint - Missing, needs to be added
- ✅ Flow delete endpoint - Already exists (`DELETE /api/flows/:flowId`)

**Rationale**: Extending the existing pattern ensures consistency and leverages TypeORM's cascade delete already configured in the entity relationships.

### 2. Modal Pattern

**Decision**: Reuse CreateAppModal pattern for EditAppModal

**Existing Implementation** (`packages/frontend/src/components/app/CreateAppModal.tsx`):
- Portal-based modal overlay
- Escape key handler
- Backdrop click to close
- Form submission with loading state
- Error display

**Adaptation for Edit**:
- Pre-populate form fields with existing app data
- Pass app object as prop
- Call update API instead of create

**Rationale**: Users expect consistent modal behavior. Reusing the pattern reduces cognitive load and development effort.

### 3. Card Actions Pattern

**Decision**: Add edit/delete actions to AppCard similar to FlowCard pattern

**Existing Implementation** (`packages/frontend/src/components/flow/FlowCard.tsx`):
- Delete button in action bar
- Loading state during deletion
- `onDelete` callback prop
- Click handler for navigation

**Adaptation for AppCard**:
- Add edit icon button
- Add delete icon button with confirmation
- Pass `onEdit` and `onDelete` callbacks

**Rationale**: FlowCard already implements the action pattern we need; AppCard should match.

### 4. Confirmation Dialog Pattern

**Decision**: Create reusable DeleteConfirmDialog component

**Existing Implementation** (inline in `AppDetail.tsx` and `FlowDetail.tsx`):
- Two-click confirmation (first click shows warning, second confirms)
- Warning message about cascade effects
- Cancel/Confirm buttons

**Improvement**:
- Extract to reusable component
- Support custom warning messages
- Handle loading state

**Rationale**: DRY principle - confirmation dialogs are needed in multiple places.

### 5. Flow Count Display

**Decision**: Include flowCount in App response from backend

**Options Considered**:

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| A (Selected) | Add flowCount field to App response | Single API call, consistent data | Requires backend change |
| B | Separate API call per app | No backend changes | N+1 query problem, slower |
| C | Load flows eagerly | Rich data available | Over-fetching for list view |

**Rationale**: Option A provides the best balance - minimal backend change, no N+1 queries, and clean frontend implementation.

### 6. Publish Button Disabled State

**Decision**: Disable publish button when flowCount === 0

**Existing Behavior**:
- Backend already validates: apps cannot be published without flows (`AppService.publish()` throws error)
- Frontend currently shows error after failed publish attempt

**Improvement**:
- Check flowCount before enabling publish button
- Show tooltip explaining requirement
- Prevent unnecessary API calls

**Rationale**: Proactive UX is better than reactive error handling.

### 7. Last Flow Deletion Warning

**Decision**: Check if deleting flow would leave published app with no flows

**Implementation Approach**:
1. Frontend fetches app to check status and flow count
2. If app is published AND this is the last flow, show enhanced warning
3. Warning explains app will need to be unpublished

**Rationale**: Users should understand the full impact of their actions before confirming.

## API Endpoint Patterns

**Existing Patterns**:
```
GET    /api/apps              - List all apps
POST   /api/apps              - Create app
GET    /api/apps/:appId       - Get single app
PATCH  /api/apps/:appId       - Update app (exists)
DELETE /api/apps/:appId       - Delete app (NEEDS ADDING)

GET    /api/apps/:appId/flows - List flows for app
POST   /api/apps/:appId/flows - Create flow
GET    /api/flows/:flowId     - Get single flow
PATCH  /api/flows/:flowId     - Update flow (exists)
DELETE /api/flows/:flowId     - Delete flow (exists)
```

**Addition Required**:
- `DELETE /api/apps/:appId` - Returns 204 No Content on success

## Summary of Decisions

| Area | Decision | Status |
|------|----------|--------|
| App Delete | Add delete method to AppService, expose via controller | Implement |
| Edit Modal | Reuse CreateAppModal pattern | Implement |
| Card Actions | Add edit/delete to AppCard matching FlowCard | Implement |
| Confirmation | Create reusable DeleteConfirmDialog | Implement |
| Flow Count | Add flowCount to App response | Implement |
| Publish Guard | Disable button when flowCount=0 | Implement |
| Last Flow Warning | Enhanced warning for published apps | Implement |

All decisions align with existing codebase patterns and constitution requirements.
