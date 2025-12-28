# Data Model: App Detail Page Improvements

**Feature**: 012-app-detail-improvements
**Date**: 2025-12-28

## Entity Changes

### App Entity (Modified)

The existing `App` entity is modified to use `logoUrl` as the app icon URL. No schema migration needed - the field already exists but will now be populated by default on creation.

#### Current Schema (No Changes)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | Primary Key | Unique identifier |
| name | varchar(100) | Required | App display name |
| description | varchar(500) | Nullable | App description |
| slug | varchar | Unique | URL-safe identifier |
| themeVariables | JSON | Required | Theme configuration |
| status | varchar(20) | Default: 'draft' | 'draft' or 'published' |
| logoUrl | varchar(500) | Nullable | **Now used for app icon URL** |
| createdAt | timestamp | Auto | Creation timestamp |
| updatedAt | timestamp | Auto | Last update timestamp |

#### Behavior Changes

1. **On App Creation**: `logoUrl` is automatically populated with a random default icon path (one of 8 options)
2. **On Icon Upload**: `logoUrl` is updated to point to the uploaded file URL
3. **Display**: UI interprets `logoUrl` as the app icon URL

### Default Icons (Static Assets)

Not stored in database - static files in frontend public directory.

| Filename | Color | Hex Code |
|----------|-------|----------|
| icon-red.png | Red | #EF4444 |
| icon-orange.png | Orange | #F97316 |
| icon-yellow.png | Yellow | #EAB308 |
| icon-green.png | Green | #22C55E |
| icon-blue.png | Blue | #3B82F6 |
| icon-purple.png | Purple | #A855F7 |
| icon-pink.png | Pink | #EC4899 |
| icon-gray.png | Gray | #6B7280 |

**Location**: `packages/frontend/public/icons/`
**Dimensions**: 128x128 pixels
**Format**: PNG with transparency

## Type Updates

### Shared Types (packages/shared/src/types/app.ts)

```typescript
// App interface - logoUrl already exists, semantically becomes iconUrl
export interface App {
  id: string;
  name: string;
  description?: string;
  slug: string;
  themeVariables: ThemeVariables;
  status: AppStatus;
  logoUrl?: string;  // Used as app icon URL
  createdAt?: string;
  updatedAt?: string;
}

// UpdateAppRequest - logoUrl update already supported
export interface UpdateAppRequest {
  name?: string;
  description?: string;
  themeVariables?: Partial<ThemeVariables>;
  status?: AppStatus;
  logoUrl?: string | null;  // Used for icon URL updates
}
```

### Icon Upload Response (New)

```typescript
export interface IconUploadResponse {
  iconUrl: string;  // URL to the uploaded icon
}
```

## State Transitions

### App Icon State

```
[No Icon] --> (Create App) --> [Default Icon Assigned]
                                      |
                                      v
[Default Icon Assigned] --> (Upload Custom) --> [Custom Icon]
                                      ^              |
                                      |              v
                               (Upload New) <-- [Custom Icon]
```

## Validation Rules

### Icon Upload Validation

| Rule | Validation | Error Message |
|------|------------|---------------|
| File type | Must be PNG, JPG, GIF, or WebP | "Invalid file type. Supported formats: PNG, JPG, GIF, WebP" |
| File size | Maximum 5MB | "File too large. Maximum size is 5MB" |
| Dimensions | Minimum 128x128 pixels | "Image must be at least 128x128 pixels" |
| Aspect ratio | Must be square (1:1) | "Image must be square" |

### Client-side Pre-validation

- File type checked by accept attribute: `accept="image/png,image/jpeg,image/gif,image/webp"`
- Dimensions validated using browser Image API before upload
- Server-side validation mirrors client-side rules for security

## Migration Notes

**No database migration required** - Uses existing `logoUrl` field.

**Data backfill consideration**: Existing apps without `logoUrl` will display without an icon. A migration script could be created to assign random default icons to existing apps, but this is optional for POC.
