# Quickstart: Chat-Style Component Renderer

**Feature Branch**: `008-chat-style-renderer`
**Date**: 2025-12-27

## Prerequisites

- Node.js >= 18.0.0
- pnpm (for monorepo workspaces)
- Project dependencies installed (`pnpm install` from root)

## Development Setup

### 1. Start the Development Servers

From the repository root:

```bash
pnpm dev
```

This starts:
- Backend: http://localhost:3001
- Frontend: http://localhost:5173

### 2. Access the View Editor

1. Open http://localhost:5173
2. Select or create an app
3. Navigate to a flow within the app
4. Click on a view to open the View Editor

The View Editor is where all changes for this feature will be visible.

---

## Feature Implementation Order

### Phase 1: Backend (App Entity)

**File**: `packages/backend/src/entities/app.entity.ts`

Add the logoUrl column:
```typescript
@Column({ type: 'varchar', length: 500, nullable: true })
logoUrl: string | null;
```

**File**: `packages/shared/src/types/app.ts`

Update the App interface to include logoUrl.

### Phase 2: Frontend Types

**New File**: `packages/shared/src/types/platform.ts`

Create PlatformStyle and ThemeMode types.

### Phase 3: Frontend Components

**New Components**:
- `packages/frontend/src/components/preview/ChatStyleWrapper.tsx`
- `packages/frontend/src/components/preview/AppAvatar.tsx`
- `packages/frontend/src/components/preview/PlatformStyleSelector.tsx`

### Phase 4: ViewEditor Refactor

**File**: `packages/frontend/src/pages/ViewEditor.tsx`

- Remove view info header (lines 211-227)
- Add platform style selector to toolbar
- Integrate ChatStyleWrapper around preview
- Add localStorage persistence

---

## Key Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/backend/src/entities/app.entity.ts` | Modify | Add logoUrl column |
| `packages/shared/src/types/app.ts` | Modify | Add logoUrl to interface |
| `packages/shared/src/types/platform.ts` | Create | Platform and theme types |
| `packages/frontend/src/pages/ViewEditor.tsx` | Modify | Major refactor for chat styling |
| `packages/frontend/src/components/preview/*.tsx` | Create | New preview components |

---

## Manual Testing Checklist

### Platform Style Switching
- [ ] ChatGPT style shows circular avatar + app name
- [ ] Claude style shows minimal design
- [ ] Switching between styles is instant (<1s)
- [ ] Style persists after page refresh

### Theme Mode Toggle
- [ ] Dark mode applies to chat chrome and component
- [ ] Light mode applies correctly
- [ ] Toggle is instant (<500ms)
- [ ] Theme persists after page refresh

### App Identity Display
- [ ] App with logo shows the logo image
- [ ] App without logo shows initial-based avatar
- [ ] Failed logo load shows fallback avatar
- [ ] App name displays correctly

### Clean Presentation
- [ ] No view name header above component
- [ ] No tool name above component
- [ ] No extra border around component
- [ ] Template name visible in toolbar

---

## Troubleshooting

### Database Column Not Added
If logoUrl column doesn't appear:
1. Stop the backend
2. Delete `packages/backend/data/app.db`
3. Restart backend (`pnpm dev`)
4. TypeORM will recreate schema with new column

### localStorage Not Persisting
Check browser DevTools > Application > Local Storage for:
- `generator:platformStyle`
- `generator:themeMode`

Clear localStorage and refresh if values are corrupted.

### Styles Not Applying
Ensure Tailwind CSS classes are in the safelist if using dynamic class generation.
Check that ThemeProvider is properly wrapping styled components.

---

## Quick Commands

```bash
# Start development
pnpm dev

# Type check all packages
pnpm type-check

# Lint all packages
pnpm lint

# Build all packages
pnpm build
```
