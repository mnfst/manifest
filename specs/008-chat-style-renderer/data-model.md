# Data Model: Chat-Style Component Renderer

**Feature Branch**: `008-chat-style-renderer`
**Date**: 2025-12-27

## Entity Changes

### App Entity (Modified)

**Location**: `packages/backend/src/entities/app.entity.ts`

| Field | Type | Constraints | Change |
|-------|------|-------------|--------|
| id | UUID | PK, auto-generated | Existing |
| name | varchar(100) | NOT NULL | Existing |
| description | varchar(500) | NULLABLE | Existing |
| slug | varchar | UNIQUE, NOT NULL | Existing |
| themeVariables | JSON | NULLABLE | Existing |
| status | varchar(20) | DEFAULT 'draft' | Existing |
| **logoUrl** | varchar(500) | NULLABLE | **NEW** |
| createdAt | timestamp | auto-generated | Existing |
| updatedAt | timestamp | auto-generated | Existing |

**New Field Details**:
- `logoUrl`: Optional URL string for app logo/avatar image
- Supports external URLs (https://)
- Max length 500 characters (sufficient for most URLs)
- When null/empty, fallback avatar is generated from app name

---

## Frontend Types (New)

### PlatformStyle Enum

**Location**: `packages/shared/src/types/platform.ts` (new file)

```typescript
type PlatformStyle = 'chatgpt' | 'claude';
```

**Values**:
- `chatgpt`: ChatGPT visual styling (circular avatar, message containers)
- `claude`: Claude visual styling (minimal, softer design)

### ThemeMode Type

**Location**: `packages/shared/src/types/platform.ts` (new file)

```typescript
type ThemeMode = 'light' | 'dark';
```

### PreviewPreferences Interface

**Location**: `packages/shared/src/types/platform.ts` (new file)

```typescript
interface PreviewPreferences {
  platformStyle: PlatformStyle;
  themeMode: ThemeMode;
}
```

**Persistence**: localStorage with keys:
- `generator:platformStyle` → PlatformStyle value
- `generator:themeMode` → ThemeMode value

---

## Shared Types Updates

### App Interface (Modified)

**Location**: `packages/shared/src/types/app.ts`

```typescript
interface App {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  themeVariables: ThemeVariables | null;
  status: 'draft' | 'published';
  logoUrl: string | null;  // NEW
  createdAt: string;
  updatedAt: string;
}
```

### UpdateAppRequest Interface (Modified)

**Location**: `packages/shared/src/types/app.ts`

```typescript
interface UpdateAppRequest {
  name?: string;
  description?: string;
  themeVariables?: ThemeVariables;
  logoUrl?: string | null;  // NEW - allow setting/clearing
}
```

---

## Component State (Frontend Only)

### ViewEditor State

**Location**: `packages/frontend/src/pages/ViewEditor.tsx`

| State Variable | Type | Default | Persistence |
|----------------|------|---------|-------------|
| platformStyle | PlatformStyle | 'chatgpt' | localStorage |
| isDarkMode | boolean | false | localStorage (as 'light'/'dark') |
| deviceSize | DeviceSize | 'desktop' | Session only (existing) |

---

## Validation Rules

### logoUrl Field
- Optional (null allowed)
- If provided, must be a valid URL format (https:// preferred)
- Max length: 500 characters
- No file upload - URL only for POC

### PlatformStyle
- Must be exactly 'chatgpt' or 'claude'
- Default to 'chatgpt' if invalid value in localStorage

### ThemeMode
- Must be exactly 'light' or 'dark'
- Default to 'light' if invalid value in localStorage

---

## Migration Notes

### Database Migration

**SQLite Migration** (TypeORM auto-sync will handle):
```sql
ALTER TABLE app ADD COLUMN logoUrl VARCHAR(500) NULL;
```

**Note**: POC uses `synchronize: true`, so column will be added automatically. For production, create proper migration file.

### Data Migration

No data migration required - new field is optional with null default.

---

## Entity Relationships

```
App (1) ──────< Flow (*)
  │               │
  │               └──< View (*)
  │
  └── logoUrl (new field)
```

No new relationships introduced. The logoUrl is a simple attribute on App.
