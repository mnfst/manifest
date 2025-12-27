# API Contracts: Manifest UI Blocks Integration

**Feature**: 006-manifest-ui-blocks
**Date**: 2025-12-27

## Overview

This feature does not introduce new API endpoints. All changes are internal:
- Frontend rendering layer (React components)
- Data transformation utilities
- MCP HTML template updates

## Existing Endpoints (No Changes)

The following endpoints remain unchanged:

### View API
- `GET /api/views/:id` - Returns ViewEntity with mockData
- `PUT /api/views/:id` - Updates ViewEntity mockData
- `POST /api/views/:flowId/message` - AI chat updates mockData

### MCP UI Endpoints
- `GET /servers/:slug/ui/:toolName/:layout.html` - Serves HTML (template changes only)

## Internal Contracts

### Mapping Function Contracts

```typescript
// packages/frontend/src/lib/manifest-mappers.ts

/**
 * Maps internal TableColumn to Manifest TableColumn
 * @param column - Internal column definition
 * @returns Manifest-compatible column with render function for typed columns
 */
function mapTableColumnToManifest(column: TableColumn): ManifestTableColumn

/**
 * Maps internal TableMockData to Manifest Table props
 * @param data - Internal table mock data
 * @returns Object with columns and data arrays for Manifest Table
 */
function mapTableMockDataToManifest(data: TableMockData): {
  columns: ManifestTableColumn[]
  data: Record<string, unknown>[]
}

/**
 * Maps internal PostItem to Manifest BlogPost
 * @param post - Internal post item
 * @returns Manifest-compatible BlogPost with author object
 */
function mapPostItemToManifestBlogPost(post: PostItem): ManifestBlogPost

/**
 * Maps internal PostListMockData to Manifest BlogPostList props
 * @param data - Internal post list mock data
 * @returns Object with posts array for Manifest BlogPostList
 */
function mapPostListMockDataToManifest(data: PostListMockData): {
  posts: ManifestBlogPost[]
}
```

## MCP HTML Template Contract

### Request
```
GET /servers/:slug/ui/:toolName/table.html
GET /servers/:slug/ui/:toolName/post-list.html
```

### Response (HTML with embedded data)
```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <link href="/manifest-ui.css" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script>
    const DATA = {{manifestData}};
    const THEME = {{themeVariables}};
    // Render Manifest component with DATA
  </script>
</body>
</html>
```

## No Breaking Changes

All existing API consumers continue to work:
- MockData format in database unchanged
- API response format unchanged
- Only the visual rendering differs
