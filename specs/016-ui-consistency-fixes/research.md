# Research: UI Consistency Fixes

**Feature**: 016-ui-consistency-fixes
**Date**: 2025-12-28

## Research Summary

This feature is primarily a UI refactoring task with no unknowns requiring external research. All patterns and technologies are already established in the codebase.

## Decision Log

### 1. Sidebar App Selector Component Pattern

**Decision**: Create a new `SidebarAppSelector.tsx` component following the existing `AppSwitcher.tsx` pattern

**Rationale**:
- Existing `AppSwitcher.tsx` in `components/layout/` already implements dropdown behavior with:
  - Click-outside detection via `useRef` and document event listener
  - Escape key support
  - Lazy loading of apps on dropdown open
  - Proper ARIA attributes (`aria-expanded`, `aria-haspopup`)
- New component will be similar but with different visual layout (sidebar context vs header context)

**Alternatives Considered**:
- Reusing `AppSwitcher.tsx` directly: Rejected because the visual requirements are different (logo + name + chevron in sidebar vs simpler header dropdown)
- Inline dropdown in Sidebar.tsx: Rejected to maintain single responsibility principle

### 2. Chevron Icon Selection

**Decision**: Use `ChevronDown` from lucide-react

**Rationale**:
- lucide-react 0.562.0 is already installed and used throughout the codebase
- `ChevronDown` is a standard icon for dropdown indicators
- Consistent with other dropdown patterns in the application

**Alternatives Considered**:
- Custom SVG: Rejected for consistency with existing icon library usage
- Other icons (CaretDown, ArrowDown): Rejected as ChevronDown is the conventional dropdown indicator

### 3. Home Route Replacement Strategy

**Decision**: Redirect "/" to first app's detail page, or show create app prompt if no apps exist

**Rationale**:
- Users with apps get immediate access to their most recent/first app
- Users without apps get a clear onboarding path
- Matches the spec requirement for removing the app list page

**Alternatives Considered**:
- Keep home page but hide from navigation: Rejected as it creates orphan route
- Redirect to a dedicated "no apps" page: Rejected as unnecessary complexity; inline prompt in sidebar suffices

### 4. App Edit Button Placement

**Decision**: Add edit button (pencil icon) next to app name in AppDetail header section

**Rationale**:
- Consistent with FlowDetail page which has edit/delete buttons
- Visible without hover (unlike AppCard which shows on hover)
- Uses existing `EditAppModal` component

**Alternatives Considered**:
- Hover-only button: Rejected for discoverability on detail pages
- Context menu: Rejected as too hidden for primary action

### 5. Create Flow Button Positioning

**Decision**: Move button to appear at the top of the Flows section, before the list

**Rationale**:
- Matches pattern used in Home page where "Create new app" is in the header
- More discoverable than current position at bottom of list
- Consistent action placement across the application

**Alternatives Considered**:
- Floating action button: Rejected as not matching existing UI patterns
- Inline with section header: Considered, may be implemented this way

### 6. Tab Centering Implementation

**Decision**: Add `justify-center` to the tabs container in FlowDetail

**Rationale**:
- Simple CSS change using existing Tailwind utilities
- No modification to the generic Tabs component needed
- Applied at the page level for this specific use case

**Alternatives Considered**:
- Add centering option to Tabs component: Rejected as over-engineering for single use case
- Wrapper component: Rejected as unnecessary abstraction

### 7. Usage Tab Icon

**Decision**: Replace `BookOpen` with `BarChart3` from lucide-react

**Rationale**:
- `BarChart3` clearly represents analytics/metrics/usage data
- Available in lucide-react (already in project dependencies)
- Visual metaphor matches "Usage" tab purpose better than "BookOpen"

**Alternatives Considered**:
- `LineChart`: Good but `BarChart3` is more recognizable at small sizes
- `Activity`: Too generic, doesn't clearly represent metrics
- `TrendingUp`: Implies growth rather than general usage data

### 8. Steps Bar Removal

**Decision**: Remove the entire steps header section including the "Add Step" button

**Rationale**:
- Steps can only be added from existing step nodes in the flow diagram
- The button was confusing as clicking it without a selected step wouldn't work as expected
- Cleaner interface focusing on the flow diagram itself

**Alternatives Considered**:
- Keep button but disable when no step selected: Rejected as still confusing UX
- Move button into flow diagram: Rejected as steps are added from nodes anyway

## Existing Patterns to Reuse

### Dropdown Pattern (from AppSwitcher.tsx)
```typescript
// State management
const [isOpen, setIsOpen] = useState(false);
const dropdownRef = useRef<HTMLDivElement>(null);

// Click outside handler
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);

// Escape key handler
useEffect(() => {
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setIsOpen(false);
  };
  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, []);
```

### Modal Pattern (from EditAppModal.tsx)
- Already exists and handles app editing
- Will be triggered from new edit button in AppDetail

### Icon Button Pattern (from FlowDetail.tsx)
```typescript
<button
  onClick={handleEdit}
  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
  title="Edit"
>
  <Pencil className="w-5 h-5" />
</button>
```

## No External Research Required

All technical questions can be answered from existing codebase patterns:
- Dropdown behavior: `AppSwitcher.tsx`
- Modal integration: `EditAppModal.tsx`, `CreateFlowModal.tsx`
- Icon usage: Throughout components using lucide-react
- Routing: `App.tsx` with react-router-dom
- API calls: `lib/api.ts` wrapper

## Next Steps

Proceed directly to Phase 1 (Design & Contracts). Since this is a UI-only feature with no data model changes or API modifications, the Phase 1 deliverables will be:
- `quickstart.md`: Implementation guide for each change
- No `data-model.md` needed (no schema changes)
- No `contracts/` needed (no API changes)
