# API Contracts: Chat-Style Component Renderer

**Feature Branch**: `008-chat-style-renderer`
**Date**: 2025-12-27

## Overview

This feature primarily involves **frontend changes** with a single backend modification:
adding the `logoUrl` field to the App entity.

No new API endpoints are required. Existing endpoints are modified to include the new field.

---

## Modified Endpoints

### PATCH /api/apps/:id

**Purpose**: Update app details (including new logoUrl field)

**Request Body** (partial update):
```json
{
  "name": "string (optional)",
  "description": "string | null (optional)",
  "themeVariables": "object | null (optional)",
  "logoUrl": "string | null (optional)"
}
```

**logoUrl Field**:
- Type: `string | null`
- Max Length: 500 characters
- Format: Valid URL (https:// preferred)
- Set to `null` to remove logo

**Response** (200 OK):
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string | null",
  "slug": "string",
  "themeVariables": "object | null",
  "status": "draft | published",
  "logoUrl": "string | null",
  "createdAt": "ISO 8601 datetime",
  "updatedAt": "ISO 8601 datetime"
}
```

**Errors**:
- `400 Bad Request`: logoUrl exceeds 500 characters or invalid format
- `404 Not Found`: App not found

---

### GET /api/apps/:id

**Purpose**: Get app details (now includes logoUrl)

**Response** (200 OK):
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string | null",
  "slug": "string",
  "themeVariables": "object | null",
  "status": "draft | published",
  "logoUrl": "string | null",
  "createdAt": "ISO 8601 datetime",
  "updatedAt": "ISO 8601 datetime"
}
```

---

### GET /api/apps

**Purpose**: List all apps (now includes logoUrl in each item)

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "name": "string",
    "slug": "string",
    "status": "draft | published",
    "logoUrl": "string | null",
    "flowCount": 0,
    "createdAt": "ISO 8601 datetime",
    "updatedAt": "ISO 8601 datetime"
  }
]
```

---

## Frontend State Contracts

### localStorage Keys

These are client-side only contracts for preference persistence.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `generator:platformStyle` | `'chatgpt' \| 'claude'` | `'chatgpt'` | Selected platform visual style |
| `generator:themeMode` | `'light' \| 'dark'` | `'light'` | Selected theme mode |

**Read Contract**:
```typescript
function loadPreferences(): PreviewPreferences {
  const platformStyle = localStorage.getItem('generator:platformStyle') as PlatformStyle;
  const themeMode = localStorage.getItem('generator:themeMode') as ThemeMode;

  return {
    platformStyle: platformStyle === 'claude' ? 'claude' : 'chatgpt',
    themeMode: themeMode === 'dark' ? 'dark' : 'light'
  };
}
```

**Write Contract**:
```typescript
function savePreferences(prefs: Partial<PreviewPreferences>): void {
  if (prefs.platformStyle) {
    localStorage.setItem('generator:platformStyle', prefs.platformStyle);
  }
  if (prefs.themeMode) {
    localStorage.setItem('generator:themeMode', prefs.themeMode);
  }
}
```

---

## Component Contracts

### ChatStyleWrapper Props

```typescript
interface ChatStyleWrapperProps {
  platformStyle: PlatformStyle;
  themeMode: ThemeMode;
  app: {
    name: string;
    logoUrl: string | null;
  };
  children: React.ReactNode;
}
```

**Behavior**:
- Renders chat-style header with app logo (or fallback) and name
- Applies platform-specific styling to container
- Applies theme mode styling

### AppAvatar Props

```typescript
interface AppAvatarProps {
  name: string;
  logoUrl: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

**Behavior**:
- If `logoUrl` is valid, render as `<img>` with error fallback
- If `logoUrl` is null/empty or fails to load, render initial-based avatar
- Initial avatar: First letter of name on colored background
- Color derived from hash of app name

---

## Platform Style Configurations

### ChatGPT Style

```typescript
const chatgptStyle = {
  light: {
    background: '#ffffff',
    headerBg: '#ffffff',
    border: '#e5e5e5',
    text: '#0d0d0d',
    secondaryText: '#6b7280',
  },
  dark: {
    background: '#343541',
    headerBg: '#343541',
    border: '#565869',
    text: '#ececf1',
    secondaryText: '#8e8ea0',
  }
};
```

### Claude Style

```typescript
const claudeStyle = {
  light: {
    background: '#faf9f7',
    headerBg: '#ffffff',
    border: '#e8e4df',
    text: '#1a1a1a',
    secondaryText: '#666666',
  },
  dark: {
    background: '#1a1a1a',
    headerBg: '#242424',
    border: '#3d3d3d',
    text: '#f5f5f5',
    secondaryText: '#a3a3a3',
  }
};
```

---

## Error Handling

### Logo Image Load Failure

When an `<img>` element fails to load the logoUrl:
1. Trigger `onError` handler
2. Replace with initial-based fallback avatar
3. No error logged to console (graceful degradation)

### Invalid localStorage Values

When reading preferences:
1. Check if value is valid enum member
2. If invalid, return default value
3. No error thrown - silent fallback
