# Data Model: App List Home Page and Header Navigation

**Feature**: 003-app-list-header
**Date**: 2025-12-26

## Overview

This feature does not require any changes to the existing data model. The App entity already contains all fields needed for listing and display.

## Existing Entity: App

The App entity already exists and is sufficient for this feature.

```typescript
interface App {
  id: string;           // UUID primary key
  name: string;         // App name (displayed in list and header)
  description?: string; // Optional description (displayed in card)
  slug: string;         // URL-friendly identifier
  themeVariables: ThemeVariables; // UI theming (not used in this feature)
  status: 'draft' | 'published'; // App status (could show badge in list)
  createdAt?: string;   // ISO timestamp (for sorting)
  updatedAt?: string;   // ISO timestamp (for "last modified" display)
}
```

### Fields Used by This Feature

| Field | Usage |
|-------|-------|
| `id` | Navigation URL parameter, React key |
| `name` | Card title, header display, dropdown item |
| `description` | Card subtitle |
| `slug` | Display in card (optional), could be used in breadcrumbs |
| `status` | Could display badge (draft/published) |
| `createdAt` | Sort order (newest first) |
| `updatedAt` | "Last modified" display in card |

## New Entity: None

No new entities are required for this feature.

## Dummy User (Non-Entity)

The user display is hardcoded for POC purposes and does not represent a database entity.

```typescript
// Hardcoded in UserAvatar component
const DUMMY_USER = {
  name: 'Demo User',
  initials: 'DU',
  // No avatar URL - use initials display
};
```

## Schema Changes

**None required.** The existing SQLite database schema is sufficient.

## Query Patterns

### List All Apps

```sql
SELECT * FROM apps ORDER BY created_at DESC
```

TypeORM equivalent in AppService:
```typescript
async findAll(): Promise<App[]> {
  const entities = await this.appRepository.find({
    order: { createdAt: 'DESC' }
  });
  return entities.map(e => this.entityToApp(e));
}
```

## Validation Rules

No new validation rules. Existing App creation validation remains unchanged:
- `name`: Required, max 100 characters
- `description`: Optional
- `themeVariables`: Optional, defaults applied
