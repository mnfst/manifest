# Research: Navigation Sidebar

**Feature Branch**: `007-sidebar`
**Created**: 2025-12-27

## Research Summary

This feature has no NEEDS CLARIFICATION items. Research focuses on implementation patterns and best practices for the sidebar navigation feature.

---

## 1. Sidebar Layout Integration

**Question**: How should the sidebar integrate with the existing layout structure?

**Decision**: Wrap the app content in a flex container with the sidebar as a fixed-width sibling.

**Rationale**:
- The existing `App.tsx` uses React Router for page routing
- The `Header` component is rendered outside the route content
- Following this pattern, the `Sidebar` should also be rendered outside route content
- A flex layout with `flex-row` provides a natural sidebar + main content structure

**Alternatives Considered**:
- CSS Grid layout: More complex, not needed for simple two-column layout
- Absolute positioning: Would require manual margin adjustments on main content
- Nested routes with layout route: More complex, existing pattern is simpler

**Implementation Approach**:
```
<div className="flex min-h-screen">
  <Sidebar />
  <div className="flex-1 flex flex-col">
    <Header />
    <main>{routes}</main>
  </div>
</div>
```

---

## 2. Route-Based Active State Detection

**Question**: How should the sidebar detect which section is active?

**Decision**: Use React Router's `useLocation` hook to match current pathname.

**Rationale**:
- React Router 7.1.1 provides `useLocation()` for accessing current route
- Pattern matching on pathname prefix (e.g., `/flows` prefix for Flows section)
- Consistent with how other components detect route state

**Patterns**:
- `/` and `/app/*` routes → "Apps" section active
- `/flows` and `/flows/*` routes → "Flows" section active

**Implementation Notes**:
- Use `pathname.startsWith('/flows')` for Flows section
- Default to "Apps" for all other routes (since it's the home section)

---

## 3. Flows API Endpoint Pattern

**Question**: How should the new "get all flows" endpoint be structured?

**Decision**: Add `GET /api/flows` endpoint returning all flows with their parent app data.

**Rationale**:
- Follows existing REST patterns in the codebase
- Existing `GET /api/apps/:appId/flows` gets flows for one app
- New endpoint follows collection pattern without parent scope
- Include app relation in query for frontend display needs

**Existing Pattern Reference**:
- `GET /api/apps` returns all apps with flow counts
- `GET /api/flows/:flowId` returns single flow with app relation

**Response Shape**:
```typescript
// Array of flows with app data included
Flow[] // where Flow.app is populated
```

---

## 4. Responsive Sidebar Behavior

**Question**: How should the sidebar behave on narrow screens?

**Decision**: Collapse to icon-only mode on medium screens, hide behind hamburger menu on small screens.

**Rationale**:
- Desktop browsers are the primary target (per constitution)
- Tailwind CSS provides responsive breakpoints (`sm`, `md`, `lg`)
- Icon-only mode preserves navigation while saving horizontal space
- Hamburger menu pattern is familiar for mobile web

**Breakpoints**:
- `>= lg` (1024px): Full sidebar with labels
- `>= md` (768px): Icon-only sidebar
- `< md`: Hidden sidebar with hamburger toggle (optional for POC)

**POC Simplification**: For POC, implement full sidebar only. Responsive behavior can be enhanced post-POC.

---

## 5. Sidebar Navigation Items

**Question**: What icons and labels should be used for navigation items?

**Decision**: Use simple, recognizable icons with clear labels.

**Items**:
1. **Apps**: Grid/dashboard icon + "Apps" label → links to "/"
2. **Flows**: Workflow/branch icon + "Flows" label → links to "/flows"

**Rationale**:
- Two items keep the sidebar simple and focused
- Icons provide quick visual recognition
- Labels provide clarity for new users

**Icon Options** (inline SVG or Heroicons pattern):
- Apps: `grid-2x2` or `squares-2x2` style icon
- Flows: `arrows-split` or `git-branch` style icon

---

## 6. Empty State for Flows Page

**Question**: What should the empty state show when no flows exist?

**Decision**: Show a centered message with guidance to create apps and flows.

**Rationale**:
- Follows existing empty state pattern from Home page (app list)
- Provides actionable guidance rather than just "No flows found"
- Links to app list to encourage creating apps first

**Message Pattern**:
```
No flows yet
Create an app and add flows to see them here.
[Go to Apps →]
```

---

## 7. Flow Card Design for Flows Page

**Question**: How should individual flows be displayed in the flows listing?

**Decision**: Card-based layout showing flow name, parent app name, and navigation action.

**Rationale**:
- Consistent with existing `FlowCard` component pattern
- Parent app context is critical per spec requirements
- Click-to-navigate matches existing interaction patterns

**Card Contents**:
- Flow name (primary text)
- Parent app name (secondary text, badge or prefix)
- Tool name (tertiary info, if space allows)
- Click action: Navigate to `/app/:appId/flow/:flowId`

---

## Research Conclusion

All patterns align with existing codebase conventions. No clarifications needed from user. Ready to proceed with Phase 1 design artifacts.
