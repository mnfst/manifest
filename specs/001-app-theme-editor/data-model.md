# Data Model: App Theme Editor

**Feature**: 001-app-theme-editor
**Date**: 2026-01-13
**Status**: Complete

## Overview

This feature leverages **existing data structures** - no database schema changes required. The `themeVariables` column already exists on the `AppEntity` and the API already supports partial updates.

---

## Existing Entities

### AppEntity (No Changes Required)

**Location**: `packages/backend/src/app/app.entity.ts`

```typescript
@Entity('apps')
export class AppEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string;

  @Column({ type: 'varchar', unique: true })
  slug!: string;

  @Column({ type: 'simple-json' })
  themeVariables!: ThemeVariables;  // ← Theme editor targets this column

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: AppStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

---

### ThemeVariables Type (Existing)

**Location**: `packages/shared/src/types/theme.ts`

```typescript
export interface ThemeVariables {
  // Required color pairs
  '--primary': string;
  '--primary-foreground': string;
  '--background': string;
  '--foreground': string;
  '--muted': string;
  '--muted-foreground': string;
  '--accent': string;
  '--accent-foreground': string;

  // Optional color pairs
  '--card'?: string;
  '--card-foreground'?: string;
  '--popover'?: string;
  '--popover-foreground'?: string;
  '--secondary'?: string;
  '--secondary-foreground'?: string;
  '--destructive'?: string;
  '--destructive-foreground'?: string;

  // Optional utility variables
  '--border'?: string;
  '--input'?: string;
  '--ring'?: string;
  '--radius'?: string;

  // Extensibility
  [key: `--${string}`]: string | undefined;
}
```

**Value Format**: HSL color values as space-separated strings
- Example: `"222.2 47.4% 11.2%"`
- Format: `"{hue} {saturation}% {lightness}%"`
- Exception: `--radius` uses CSS length (e.g., `"0.5rem"`)

---

### DEFAULT_THEME_VARIABLES (Existing)

**Location**: `packages/shared/src/types/theme.ts`

```typescript
export const DEFAULT_THEME_VARIABLES: ThemeVariables = {
  '--primary': '222.2 47.4% 11.2%',
  '--primary-foreground': '210 40% 98%',
  '--background': '0 0% 100%',
  '--foreground': '222.2 47.4% 11.2%',
  '--muted': '210 40% 96.1%',
  '--muted-foreground': '215.4 16.3% 46.9%',
  '--accent': '210 40% 96.1%',
  '--accent-foreground': '222.2 47.4% 11.2%',
  '--card': '0 0% 100%',
  '--card-foreground': '222.2 47.4% 11.2%',
  '--border': '214.3 31.8% 91.4%',
  '--input': '214.3 31.8% 91.4%',
  '--ring': '222.2 47.4% 11.2%',
  '--radius': '0.5rem',
};
```

---

## Frontend Data Structures (New)

### HslObject

**Location**: `packages/frontend/src/lib/hsl-utils.ts` (to be created)

```typescript
/**
 * HSL color representation for react-colorful picker
 */
export interface HslObject {
  h: number;  // Hue: 0-360 degrees
  s: number;  // Saturation: 0-100 percent
  l: number;  // Lightness: 0-100 percent
}
```

### ThemeEditorState

**Location**: `packages/frontend/src/components/theme-editor/hooks/useThemeEditor.ts` (to be created)

```typescript
/**
 * Internal state for the theme editor component
 */
export interface ThemeEditorState {
  /** Current editing values (may differ from saved) */
  variables: ThemeVariables;

  /** Original saved values from database */
  savedVariables: ThemeVariables;

  /** Map of variable keys to validation error messages */
  errors: Map<string, string>;

  /** Whether a save operation is in progress */
  isSaving: boolean;
}
```

### ThemeVariableGroup

**Location**: `packages/frontend/src/components/theme-editor/types.ts` (to be created)

```typescript
/**
 * Groups related theme variables for UI organization
 */
export interface ThemeVariableGroup {
  /** Display name for the group */
  label: string;

  /** Variable keys in this group */
  variables: (keyof ThemeVariables)[];

  /** Optional description for the group */
  description?: string;
}

export const THEME_VARIABLE_GROUPS: ThemeVariableGroup[] = [
  {
    label: 'Primary',
    variables: ['--primary', '--primary-foreground'],
    description: 'Main brand colors for buttons and links',
  },
  {
    label: 'Background',
    variables: ['--background', '--foreground'],
    description: 'Page background and default text',
  },
  {
    label: 'Muted',
    variables: ['--muted', '--muted-foreground'],
    description: 'Subdued backgrounds and secondary text',
  },
  {
    label: 'Accent',
    variables: ['--accent', '--accent-foreground'],
    description: 'Highlights and focus states',
  },
  {
    label: 'Card',
    variables: ['--card', '--card-foreground'],
    description: 'Card component colors',
  },
  {
    label: 'Popover',
    variables: ['--popover', '--popover-foreground'],
    description: 'Dropdown and popover colors',
  },
  {
    label: 'Secondary',
    variables: ['--secondary', '--secondary-foreground'],
    description: 'Secondary action colors',
  },
  {
    label: 'Destructive',
    variables: ['--destructive', '--destructive-foreground'],
    description: 'Error and danger states',
  },
  {
    label: 'Borders & Inputs',
    variables: ['--border', '--input', '--ring'],
    description: 'Form elements and dividers',
  },
  {
    label: 'Spacing',
    variables: ['--radius'],
    description: 'Border radius for rounded corners',
  },
];
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         AppDetail Page                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Theme Tab Content                       │ │
│  │                                                           │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐  │ │
│  │  │   Visual    │    │    Code     │    │   Preview    │  │ │
│  │  │   Pickers   │◄──►│   Editor    │───►│   Component  │  │ │
│  │  └──────┬──────┘    └──────┬──────┘    └──────────────┘  │ │
│  │         │                  │                              │ │
│  │         └────────┬─────────┘                              │ │
│  │                  │                                        │ │
│  │         ┌────────▼────────┐                               │ │
│  │         │ useThemeEditor  │                               │ │
│  │         │     (state)     │                               │ │
│  │         └────────┬────────┘                               │ │
│  │                  │                                        │ │
│  │         ┌────────▼────────┐                               │ │
│  │         │   Save Button   │                               │ │
│  │         └────────┬────────┘                               │ │
│  └──────────────────┼────────────────────────────────────────┘ │
│                     │                                           │
└─────────────────────┼───────────────────────────────────────────┘
                      │
                      │ PATCH /api/apps/:id
                      │ { themeVariables: {...} }
                      ▼
            ┌─────────────────┐
            │    Backend      │
            │  AppService     │
            │  .update()      │
            └────────┬────────┘
                     │
                     ▼
            ┌─────────────────┐
            │    SQLite DB    │
            │  apps.theme     │
            │  Variables      │
            └─────────────────┘
```

---

## Validation Rules

### HSL Color Values

| Rule | Pattern | Example Valid | Example Invalid |
|------|---------|---------------|-----------------|
| Hue | 0-360 (decimal allowed) | "222.2" | "-10", "400" |
| Saturation | 0-100% | "47.4%" | "120%" |
| Lightness | 0-100% | "11.2%" | "-5%" |
| Format | `{h} {s}% {l}%` | "222.2 47.4% 11.2%" | "hsl(222, 47%, 11%)" |

### Radius Value

| Rule | Pattern | Example Valid | Example Invalid |
|------|---------|---------------|-----------------|
| Format | Number + unit | "0.5rem", "8px" | "0.5", "rem" |
| Units | rem, px, em | "1rem" | "1vw" |

### Validation Implementation

```typescript
// packages/frontend/src/lib/hsl-utils.ts

const HSL_PATTERN = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/;
const RADIUS_PATTERN = /^(\d+(?:\.\d+)?)(rem|px|em)$/;

export function validateHslString(value: string): string | null {
  const match = value.match(HSL_PATTERN);
  if (!match) return 'Invalid HSL format. Expected: "hue saturation% lightness%"';

  const [, h, s, l] = match.map(Number);
  if (h < 0 || h > 360) return 'Hue must be between 0 and 360';
  if (s < 0 || s > 100) return 'Saturation must be between 0% and 100%';
  if (l < 0 || l > 100) return 'Lightness must be between 0% and 100%';

  return null; // Valid
}

export function validateRadius(value: string): string | null {
  if (!RADIUS_PATTERN.test(value)) {
    return 'Invalid radius. Expected format: "0.5rem" or "8px"';
  }
  return null; // Valid
}
```

---

## No Database Migration Required

This feature operates entirely within existing data structures:

1. **AppEntity.themeVariables** - Already stores theme as JSON
2. **UpdateAppRequest.themeVariables** - Already accepts partial updates
3. **AppService.update()** - Already merges theme variable updates
4. **API PATCH /apps/:id** - Already handles themeVariables in request body

The only changes are **frontend-only** - adding the theme editor UI components.
