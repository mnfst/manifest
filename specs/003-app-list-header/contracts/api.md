# API Contract: App List Endpoint

**Feature**: 003-app-list-header
**Date**: 2025-12-26

## Overview

This feature requires one new API endpoint to list all apps. All other functionality is frontend-only.

---

## New Endpoint

### GET /api/apps

List all apps in the system.

**Request**

```http
GET /api/apps HTTP/1.1
Host: localhost:3000
Content-Type: application/json
```

No query parameters required (POC scope - no pagination/filtering).

**Response (200 OK)**

```json
[
  {
    "id": "uuid-1",
    "name": "My First App",
    "description": "A sample app",
    "slug": "my-first-app",
    "themeVariables": { ... },
    "status": "draft",
    "createdAt": "2025-12-26T10:00:00.000Z",
    "updatedAt": "2025-12-26T10:00:00.000Z"
  },
  {
    "id": "uuid-2",
    "name": "Another App",
    "description": null,
    "slug": "another-app",
    "themeVariables": { ... },
    "status": "published",
    "createdAt": "2025-12-25T09:00:00.000Z",
    "updatedAt": "2025-12-25T12:00:00.000Z"
  }
]
```

**Response (Empty - 200 OK)**

```json
[]
```

Returns empty array when no apps exist.

---

## Existing Endpoints Used

These existing endpoints are used by the feature but require no modifications:

### POST /api/apps

Create a new app. Used by the "Create new app" form.

### GET /api/apps/:appId

Get app by ID. Used by header to display current app name.

---

## TypeScript Types

No new types required. Existing types are sufficient:

```typescript
// From @chatgpt-app-builder/shared

interface App {
  id: string;
  name: string;
  description?: string;
  slug: string;
  themeVariables: ThemeVariables;
  status: 'draft' | 'published';
  createdAt?: string;
  updatedAt?: string;
}
```

---

## Frontend API Client Addition

```typescript
// packages/frontend/src/lib/api.ts

/**
 * List all apps
 * GET /api/apps
 */
async listApps(): Promise<App[]> {
  return fetchApi<App[]>('/apps');
}
```

---

## Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 200 | Success | Array of App objects |
| 500 | Server error | `{ "message": "Internal server error" }` |

Note: No 404 for empty list - empty array is valid response.
