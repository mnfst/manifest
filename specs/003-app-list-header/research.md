# Research: App List Home Page and Header Navigation

**Feature**: 003-app-list-header
**Date**: 2025-12-26

## Overview

This document captures research decisions for the app list home page and header navigation feature. The feature is frontend-focused with minimal backend changes.

## Research Items

### 1. App List Display Pattern

**Decision**: Grid layout with cards

**Rationale**:
- Consistent with existing FlowCard and ViewCard patterns in the codebase
- Grid provides good visual density for browsing multiple apps
- Cards allow for name, description, and status display
- Responsive-friendly (can adjust columns based on viewport)

**Alternatives Considered**:
- Table layout: Rejected - less visually appealing for POC, more appropriate for admin views
- Simple list: Rejected - doesn't showcase app information well

### 2. Create App Form Trigger

**Decision**: Modal dialog triggered by button

**Rationale**:
- Keeps app list visible while form is open
- Clear call-to-action with "Create new app" button
- Reuses existing AppForm component without modification
- Common pattern in modern web applications

**Alternatives Considered**:
- Inline form at top of list: Rejected - takes up space when not in use
- Separate /create page: Rejected - unnecessary navigation for POC
- Slide-out drawer: Rejected - more complex, not needed for simple form

### 3. Header Component Architecture

**Decision**: Reusable Header component with composition

**Rationale**:
- Single Header component used across all app-scoped pages
- Accepts currentApp prop to display app name
- Contains AppSwitcher and UserAvatar as child components
- Follows React composition patterns

**Alternatives Considered**:
- Layout wrapper component: Considered but adds unnecessary nesting
- Context-based app state: Overkill for POC, local state sufficient

### 4. App Switcher Dropdown Implementation

**Decision**: Custom dropdown with React state

**Rationale**:
- Lightweight, no additional dependencies needed
- Full control over styling to match existing UI
- Simple open/close state management
- Click-outside-to-close with useEffect

**Alternatives Considered**:
- Headless UI (@headlessui/react): Good option but adds dependency
- Radix UI: Good option but adds dependency
- Native select element: Poor UX, limited styling

### 5. Dummy User Display

**Decision**: Static hardcoded avatar and name

**Rationale**:
- POC requirement - no real authentication
- Simple circular avatar with initials
- Hardcoded name "Demo User"
- Non-interactive (no dropdown menu)

**Alternatives Considered**:
- Gravatar integration: Unnecessary for POC
- User menu with logout: Requires auth system not in POC scope

### 6. API Endpoint for Listing Apps

**Decision**: GET /api/apps returning array of App objects

**Rationale**:
- RESTful convention
- Returns full App objects (consistent with other endpoints)
- No pagination needed for POC (small number of apps expected)
- Sorted by createdAt descending (newest first)

**Alternatives Considered**:
- Paginated response: Overkill for POC
- Separate summary endpoint: Unnecessary - App object is already small

## Dependencies

No new dependencies required. All functionality can be implemented with:
- React 18 (existing)
- React Router 7 (existing)
- Tailwind CSS 3 (existing)
- TypeORM (existing, for backend query)

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Dropdown accessibility | Low | Medium | Follow ARIA patterns for dropdown |
| Header height affecting layouts | Low | Low | Use fixed header height, adjust page padding |
| App list performance with many apps | Low | Low | POC scope, can add pagination post-POC |

## Conclusion

The feature is well-defined with no blocking unknowns. All decisions align with existing codebase patterns and POC scope. Implementation can proceed to Phase 1.
