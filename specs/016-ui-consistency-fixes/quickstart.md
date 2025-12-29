# Quickstart: UI Consistency Fixes

**Feature**: 016-ui-consistency-fixes
**Date**: 2025-12-28

## Overview

This guide provides step-by-step implementation instructions for the UI consistency fixes. All changes are frontend-only and require no backend modifications.

## Prerequisites

- Node.js >=18.0.0
- pnpm 9.0.0+
- Running development environment: `pnpm dev` from repository root

## Implementation Sequence

The changes should be implemented in the following order to maintain a working application throughout:

1. **SidebarAppSelector** - Create the new component first
2. **Sidebar** - Integrate the selector and remove Apps nav
3. **App.tsx routing** - Update routing to handle home redirect
4. **Remove Header** - Remove header from pages
5. **AppDetail** - Add edit button and reposition create flow
6. **FlowDetail** - Center tabs, update icon, remove steps bar
7. **Cleanup** - Remove unused components

---

## 1. Create SidebarAppSelector Component

**File**: `packages/frontend/src/components/layout/SidebarAppSelector.tsx`

**Purpose**: Display current app with logo, name, and chevron; show dropdown with all apps and create option.

**Key Implementation Details**:

```typescript
// Required imports
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import type { App } from '@generator/shared';

// Component structure
interface SidebarAppSelectorProps {
  onCreateApp: () => void;
}

export function SidebarAppSelector({ onCreateApp }: SidebarAppSelectorProps) {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [apps, setApps] = useState<App[]>([]);
  const [currentApp, setCurrentApp] = useState<App | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Refs and hooks
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { appId } = useParams();

  // ... implement dropdown logic following AppSwitcher pattern
}
```

**Visual Layout**:
```
┌─────────────────────────────────────┐
│ [App Logo]  App Name       [▼]      │  <- Clickable selector
└─────────────────────────────────────┘
     │
     ▼ (when open)
┌─────────────────────────────────────┐
│ [Logo] App 1                        │
│ [Logo] App 2                        │
│ [Logo] App 3                        │
├─────────────────────────────────────┤
│ [+] Create new app                  │
└─────────────────────────────────────┘
```

**Styling Classes**:
- Selector: `flex items-center gap-3 px-3 py-2 mx-2 rounded-lg hover:bg-nav-hover cursor-pointer`
- Logo: `w-8 h-8 rounded-lg object-cover bg-gray-200 flex-shrink-0`
- Name: `flex-1 font-medium truncate text-sm`
- Chevron: `w-4 h-4 text-gray-400 transition-transform` (rotate when open)
- Dropdown: `absolute left-0 right-0 mt-1 mx-2 bg-card rounded-lg shadow-lg border z-50`

---

## 2. Modify Sidebar Component

**File**: `packages/frontend/src/components/layout/Sidebar.tsx`

**Changes**:
1. Import and add `SidebarAppSelector` below the logo section
2. Remove the "Apps" navigation item from the nav list
3. Pass `onCreateApp` callback that opens CreateAppModal

**Before/After**:
```typescript
// BEFORE: Logo section
<div className="h-14 flex items-center px-4 border-b">
  <img src="..." alt="Manifest" />
</div>

// AFTER: Logo section + App Selector
<div className="h-14 flex items-center px-4 border-b">
  <img src="..." alt="Manifest" />
</div>
<div className="py-2 border-b">
  <SidebarAppSelector onCreateApp={() => setIsCreateModalOpen(true)} />
</div>
```

---

## 3. Update App.tsx Routing

**File**: `packages/frontend/src/App.tsx`

**Changes**:
1. Replace Home route with redirect logic
2. Remove Header component from layout

**Implementation**:
```typescript
// Create a redirect component
function HomeRedirect() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<App[]>([]);

  useEffect(() => {
    api.listApps().then(apps => {
      if (apps.length > 0) {
        navigate(`/app/${apps[0].id}`, { replace: true });
      }
      setApps(apps);
    });
  }, [navigate]);

  if (apps.length === 0) {
    // Show create app prompt or open modal
    return <EmptyAppsPrompt />;
  }

  return null; // Redirecting...
}

// Update routes
<Route path="/" element={<HomeRedirect />} />
```

---

## 4. Remove Header from Pages

**Files to modify**:
- `packages/frontend/src/pages/AppDetail.tsx`
- `packages/frontend/src/pages/FlowDetail.tsx`
- `packages/frontend/src/pages/ViewEditor.tsx` (if exists)

**Change**: Remove `<Header />` component from each page's JSX.

```typescript
// BEFORE
return (
  <div className="flex-1 flex flex-col">
    <Header />
    <main>...</main>
  </div>
);

// AFTER
return (
  <div className="flex-1 flex flex-col">
    <main>...</main>
  </div>
);
```

---

## 5. Modify AppDetail Page

**File**: `packages/frontend/src/pages/AppDetail.tsx`

### 5a. Add Edit Button

**Location**: Next to app name in the header section

```typescript
// Import
import { Pencil } from 'lucide-react';
import { EditAppModal } from '../components/app/EditAppModal';

// State
const [isEditModalOpen, setIsEditModalOpen] = useState(false);

// In JSX, next to app name
<div className="flex items-center gap-2">
  <h1 className="text-2xl font-bold">{app.name}</h1>
  <button
    onClick={() => setIsEditModalOpen(true)}
    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
    title="Edit app"
  >
    <Pencil className="w-5 h-5" />
  </button>
</div>

// Modal at end of component
<EditAppModal
  isOpen={isEditModalOpen}
  onClose={() => setIsEditModalOpen(false)}
  app={app}
  onSave={handleAppUpdate}
/>
```

### 5b. Reposition Create Flow Button

**Change**: Move button from after FlowList to before it

```typescript
// BEFORE
<FlowList flows={flows} />
<button onClick={openCreateModal}>Create New Flow</button>

// AFTER
<div className="flex items-center justify-between mb-4">
  <h2 className="text-lg font-semibold">Flows ({flows.length})</h2>
  <button
    onClick={() => setIsCreateFlowModalOpen(true)}
    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
  >
    <Plus className="w-4 h-4" />
    Create New Flow
  </button>
</div>
<FlowList flows={flows} />
```

---

## 6. Modify FlowDetail Page

**File**: `packages/frontend/src/pages/FlowDetail.tsx`

### 6a. Remove Header
See step 4.

### 6b. Center Tabs

**Find the tabs container and add centering**:
```typescript
// BEFORE
<div className="px-6 bg-background">
  <Tabs ... />
</div>

// AFTER
<div className="px-6 bg-background flex justify-center">
  <Tabs ... />
</div>
```

### 6c. Update Usage Tab Icon

**Change import and icon reference**:
```typescript
// BEFORE
import { Hammer, Eye, BookOpen } from 'lucide-react';

const tabs = [
  { id: 'build', label: 'Build', icon: Hammer },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'usage', label: 'Usage', icon: BookOpen },
];

// AFTER
import { Hammer, Eye, BarChart3 } from 'lucide-react';

const tabs = [
  { id: 'build', label: 'Build', icon: Hammer },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'usage', label: 'Usage', icon: BarChart3 },
];
```

### 6d. Remove Steps Bar

**Find and remove the steps header section**:
```typescript
// REMOVE this entire section:
<div className="flex items-center justify-between px-6 py-3 border-b">
  <h3>Steps ({steps.length})</h3>
  <button onClick={addStep}>
    <Plus /> Add Step
  </button>
</div>
```

---

## 7. Cleanup

### 7a. Remove or Mark Header.tsx as Deprecated

**Option A**: Delete file if no longer used anywhere
```bash
rm packages/frontend/src/components/layout/Header.tsx
```

**Option B**: Add deprecation comment if keeping for reference
```typescript
/**
 * @deprecated This component is no longer used.
 * App switching is now handled by SidebarAppSelector.
 * Kept for reference during transition period.
 */
```

### 7b. Remove Home.tsx if Fully Replaced

If `HomeRedirect` is implemented inline in App.tsx:
```bash
rm packages/frontend/src/pages/Home.tsx
```

### 7c. Update Imports

Remove unused imports from files that no longer use Header:
```typescript
// Remove from pages that no longer use Header
- import { Header } from '../components/layout/Header';
```

---

## Testing Checklist

After implementation, verify:

- [ ] Sidebar shows app selector below logo with current app's logo, name, and chevron
- [ ] Clicking app selector opens dropdown with all apps
- [ ] Dropdown shows "Create new app" option with plus icon
- [ ] Selecting a different app navigates to that app's detail page
- [ ] Create new app opens the modal
- [ ] No top header bar on AppDetail, FlowDetail, ViewEditor pages
- [ ] Root URL "/" redirects to first app or shows create prompt
- [ ] AppDetail has visible edit button next to app name
- [ ] Edit button opens EditAppModal
- [ ] Create New Flow button is at top of flows section
- [ ] FlowDetail tabs are horizontally centered
- [ ] Usage tab shows bar chart icon instead of book
- [ ] No Steps header bar or Add Step button in Build tab
- [ ] App selector handles long app names (truncation)
- [ ] App selector shows placeholder for apps without logos

---

## Files Modified Summary

| File | Action | Changes |
|------|--------|---------|
| `components/layout/SidebarAppSelector.tsx` | CREATE | New app selector component |
| `components/layout/Sidebar.tsx` | MODIFY | Add selector, remove Apps nav |
| `components/layout/Header.tsx` | DELETE | No longer needed |
| `pages/Home.tsx` | DELETE/MODIFY | Replace with redirect |
| `pages/AppDetail.tsx` | MODIFY | Add edit button, reposition create flow |
| `pages/FlowDetail.tsx` | MODIFY | Remove header, center tabs, update icon, remove steps bar |
| `App.tsx` | MODIFY | Update routing |
