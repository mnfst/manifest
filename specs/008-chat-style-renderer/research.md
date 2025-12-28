# Research: Chat-Style Component Renderer

**Feature Branch**: `008-chat-style-renderer`
**Date**: 2025-12-27

## Research Tasks & Findings

### 1. App Logo Field Availability

**Context**: Feature requires displaying app logo in chat-style header

**Finding**: The App entity **does NOT have a logo field**. Current fields are:
- id, name, description, slug, themeVariables, status, createdAt, updatedAt

**Decision**: Add optional `logoUrl` field to App entity
**Rationale**:
- Simple nullable string column for URL storage
- Optional field won't break existing apps
- Aligns with common avatar/logo patterns in web apps
**Alternatives Considered**:
- File upload with storage: Too complex for POC, deferred
- External avatar service (Gravatar-like): Adds dependency, deferred

---

### 2. View Name/Tool Name Header Location

**Context**: FR-004 requires removing view name and tool name from above component

**Finding**: Currently displayed in ViewEditor.tsx lines 211-227:
```tsx
<div className="px-4 py-3 border-b ...">
  <h2>{view.name || 'View Preview'}</h2>
  <p>{flow.toolName}</p>
  <span>{view.layoutTemplate}</span>
</div>
```

**Decision**: Remove this header section entirely; move template name to toolbar
**Rationale**:
- Template name is useful metadata for the editor user
- Toolbar already exists with device size and dark mode toggles
- Clean separation: toolbar = editor controls, preview = chat experience
**Alternatives Considered**:
- Move to sidebar: No sidebar currently exists in ViewEditor
- Move to breadcrumb: Would make breadcrumb too busy

---

### 3. Platform Style Visual Patterns

**Context**: Need to match ChatGPT and Claude visual aesthetics

**Finding**: Based on public interfaces:

**ChatGPT Style**:
- Circular avatar (logo) on left
- App name in bold, horizontal layout
- Light mode: white background (#ffffff), gray borders
- Dark mode: dark gray background (#343541), lighter text
- Message container has subtle shadow/border
- Sans-serif typography (system fonts)

**Claude Style**:
- More minimal, cleaner aesthetic
- Light mode: off-white/cream tones (#faf9f7)
- Dark mode: darker muted tones
- Rounded corners, softer shadows
- App identity displayed more subtly
- Serif accents possible in headings

**Decision**: Create platform-specific CSS/Tailwind configurations
**Rationale**:
- Tailwind classes can be conditionally applied based on platform
- CSS variables already used for theming (see ThemeProvider)
- No external dependencies needed
**Alternatives Considered**:
- Import platform CSS libraries: None exist, would add bundle size

---

### 4. Preference Persistence Mechanism

**Context**: FR-007 and FR-008 require persisting platform style and dark mode

**Finding**:
- Dark mode toggle already exists (useState in ViewEditor)
- No persistence currently implemented
- localStorage is available in browser environment

**Decision**: Use localStorage for preference persistence
**Rationale**:
- Session-scoped as per spec (persists across page navigations)
- Simple key-value storage: `generator:platformStyle`, `generator:themeMode`
- No backend changes required
- Standard web pattern
**Alternatives Considered**:
- sessionStorage: Would reset on new tabs (worse UX)
- Backend user preferences: No user auth in POC, overkill

---

### 5. Default Platform Style

**Context**: User clarification skipped; need default for first-time visitors

**Decision**: Default to ChatGPT style
**Rationale**:
- ChatGPT is the more widely recognized chat UI pattern
- Feature description mentions "ChatGPT app" first
- Represents the primary target platform for component rendering
- Can be easily changed via the platform selector

---

### 6. Logo Fallback Implementation

**Context**: FR-009 and FR-010 require graceful fallback for missing/failed logos

**Finding**: Common patterns in web apps:
- Initial-based avatar (first letter of app name)
- Generic icon placeholder
- Colored background based on name hash

**Decision**: Initial-based fallback with colored background
**Rationale**:
- Provides visual distinction between apps
- Simple to implement (first letter + hash-based color)
- Consistent with ChatGPT custom GPT patterns
- No external dependencies
**Alternatives Considered**:
- Generic icon: Less distinctive, boring
- DiceBear/Boring Avatars API: Adds external dependency

---

### 7. Component Border Removal

**Context**: FR-005 requires removing extra outer border

**Finding**: Border applied in ViewEditor.tsx line 231:
```tsx
<div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white border'}`}>
```

**Decision**: Remove the `border` class and adjust container styling
**Rationale**:
- Platform-specific styling will provide appropriate visual boundaries
- Chat message containers have their own visual treatment
- Cleaner, more immersive preview experience

---

## Technical Stack Confirmation

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.7.2 |
| **Frontend Framework** | React 18.3.1 + Vite 6.0.5 |
| **Backend Framework** | NestJS 10.4.15 |
| **Styling** | Tailwind CSS 3.4.17 |
| **Database** | SQLite via TypeORM 0.3.20 |
| **Testing** | None (POC) |
| **Target Platform** | Desktop browsers |

## Open Items Resolved

All NEEDS CLARIFICATION items have been resolved:
- ✅ Logo field: Add optional logoUrl to App entity
- ✅ Template name location: Move to toolbar
- ✅ Default platform style: ChatGPT
- ✅ Persistence mechanism: localStorage
- ✅ Fallback strategy: Initial-based avatar
