# Data Model: Navigation Sidebar

**Feature Branch**: `007-sidebar`
**Created**: 2025-12-27

## Overview

This feature uses **existing entities only**. No database schema changes required.

## Existing Entities Used

### App (unchanged)

The sidebar links to the existing app list page. Apps are displayed in the "Apps" section target page.

**Key Fields Used**:
- `id: string` - Primary key for navigation URLs
- `name: string` - Display name (shown in Flows page as parent context)
- `slug: string` - Alternative identifier

**Relationship**: One App → Many Flows

### Flow (unchanged)

Flows are listed in the new "Flows" page with their parent app context.

**Key Fields Used**:
- `id: string` - Primary key for navigation URLs
- `appId: string` - Foreign key to parent App
- `name: string` - Display name
- `toolName: string` - Secondary display info
- `isActive: boolean` - Status indicator

**Relationship**: Many Flows → One App (via `appId`)

## New Type Definitions

### FlowWithApp (shared package)

Extends the existing `Flow` interface to include the parent `App` object for display purposes.

```typescript
// packages/shared/src/types/flow.ts

import type { App } from './app.js';

/**
 * Flow with parent app data included
 * Used for cross-app flow listings where app context is needed
 */
export interface FlowWithApp extends Flow {
  app: Pick<App, 'id' | 'name' | 'slug'>;
}
```

**Usage**: Returned by `GET /api/flows` endpoint for the Flows page.

## Data Fetching Patterns

### Flows Page

**Query**: All flows with their parent app data
**Backend**: TypeORM query with `relations: ['app']`
**Response**: `FlowWithApp[]`

```typescript
// Backend service method
async findAllWithApp(): Promise<FlowEntity[]> {
  return this.flowRepository.find({
    relations: ['app'],
    order: { createdAt: 'DESC' }
  });
}
```

### Sidebar (no data fetching)

The sidebar component requires no data fetching. It uses:
- Static navigation items (Apps, Flows)
- React Router's `useLocation()` for active state

## State Management

No new global state required. The sidebar uses:
- React Router location state for active highlighting
- Component-local state for responsive behavior (future)

## Validation Rules

No new validation rules. Existing Flow and App validations remain unchanged.

## Migration Notes

**Schema Changes**: None
**Data Migration**: None
**Backwards Compatibility**: Fully compatible - existing endpoints unchanged
