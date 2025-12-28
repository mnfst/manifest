# Feature Specification: Chat-Style Component Renderer

**Feature Branch**: `008-chat-style-renderer`
**Created**: 2025-12-27
**Status**: Draft
**Input**: User description: "Improve the view edit view and rendering of components with ChatGPT/Claude style options, light/dark mode, app logo and name display, remove view/tool name header and extra borders"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch Between Chat Platform Styles (Priority: P1)

As a user editing a view, I want to preview how my component will look when rendered in different chat platforms (ChatGPT or Claude) so I can ensure it provides an authentic chat experience for end users.

**Why this priority**: This is the core value proposition of the feature - allowing users to see their components as they would appear in real chat applications. Without this, the feature has no purpose.

**Independent Test**: Can be fully tested by selecting a platform style and verifying the visual presentation changes to match that platform's aesthetic. Delivers immediate visual feedback and platform-specific preview capability.

**Acceptance Scenarios**:

1. **Given** a user is on the view edit page with a component displayed, **When** they select "ChatGPT" from the platform style selector, **Then** the component preview updates to show ChatGPT-style rendering with the app logo and name displayed above the component
2. **Given** a user is on the view edit page with a component displayed, **When** they select "Claude" from the platform style selector, **Then** the component preview updates to show Claude-style rendering with appropriate visual styling
3. **Given** a user has selected a platform style, **When** they navigate away and return to the view edit page, **Then** their previously selected platform style is preserved

---

### User Story 2 - Toggle Light/Dark Mode (Priority: P1)

As a user editing a view, I want to toggle between light and dark mode independently of the platform style so I can preview how my component looks in both themes within any chat platform context.

**Why this priority**: Dark mode is an essential accessibility and user preference feature. Combined with platform styles, it provides complete preview coverage.

**Independent Test**: Can be fully tested by toggling the light/dark mode switch and verifying the component and surrounding chat UI updates appropriately. Delivers theme preview capability.

**Acceptance Scenarios**:

1. **Given** a user is on the view edit page with ChatGPT style selected, **When** they toggle dark mode on, **Then** the entire preview (including chat chrome and component) displays in dark mode colors
2. **Given** a user is on the view edit page with Claude style selected in dark mode, **When** they toggle light mode, **Then** the entire preview displays in light mode colors
3. **Given** a user has set a light/dark mode preference, **When** they change the platform style, **Then** their light/dark mode preference is maintained

---

### User Story 3 - Clean Component Presentation (Priority: P2)

As a user editing a view, I want the component to be displayed without redundant headers (view name, tool name) and extra borders so the preview looks like a real chat message rather than an editor interface.

**Why this priority**: This removes visual noise and makes the preview authentic. It's important but secondary to the core platform style switching functionality.

**Independent Test**: Can be fully tested by verifying the component preview area no longer shows view name, tool name headers, or the outer border that previously surrounded the component.

**Acceptance Scenarios**:

1. **Given** a user is on the view edit page, **When** the component preview loads, **Then** there is no view name or tool name displayed directly above the component
2. **Given** a user is on the view edit page, **When** the component preview loads, **Then** there is no additional border wrapping the component beyond what's part of the chat platform styling
3. **Given** a user wants to know which template is being used, **When** they look at the view edit interface, **Then** the template name is visible in an unobtrusive location (not directly above the component)

---

### User Story 4 - App Identity Display (Priority: P2)

As a user editing a view, I want to see the app's logo and name displayed above the rendered component (similar to how ChatGPT shows custom app branding) so I can preview the complete branded experience.

**Why this priority**: This completes the authentic chat experience by showing app branding, but depends on the platform style feature being in place first.

**Independent Test**: Can be fully tested by loading a view for an app that has a logo and name, and verifying both appear above the component in the chat-style header.

**Acceptance Scenarios**:

1. **Given** an app has a name and logo configured, **When** a user previews a view in ChatGPT style, **Then** the app logo appears as a circular avatar and the app name appears next to it above the component
2. **Given** an app has a name but no logo configured, **When** a user previews a view, **Then** the app name appears with a default placeholder icon above the component
3. **Given** a user is previewing in Claude style, **When** the component loads, **Then** the app identity is displayed in a manner consistent with Claude's visual design

---

### Edge Cases

- What happens when the app has no name configured? Display a default "App" label
- What happens when the logo image fails to load? Show a fallback icon with the app's first letter
- What happens when the user's system preference is dark mode but they select light mode in the preview? The preview setting takes precedence
- How does the platform style affect components with custom themes? The platform chrome (header, background) uses the selected platform style while the component respects its own theme settings

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a platform style selector with at least two options: "ChatGPT" and "Claude"
- **FR-002**: System MUST render a chat-style header above the component showing the app logo (or fallback) and app name
- **FR-003**: System MUST provide a light/dark mode toggle that works independently of the platform style selection
- **FR-004**: System MUST remove the view name and tool name that currently display directly above the component
- **FR-005**: System MUST remove the extra outer border that currently wraps the component preview
- **FR-006**: System MUST display the template name in an alternative location (not directly above the component)
- **FR-007**: System MUST persist the user's platform style selection for the current session
- **FR-008**: System MUST persist the user's light/dark mode selection for the current session
- **FR-009**: System MUST display a fallback icon when an app has no logo configured
- **FR-010**: System MUST handle logo image loading failures gracefully with a fallback display
- **FR-011**: ChatGPT style MUST visually match the ChatGPT custom app presentation (circular avatar, app name, message-style container)
- **FR-012**: Claude style MUST visually match Claude's conversation presentation aesthetic

### Key Entities

- **Platform Style**: Represents a chat platform visual theme (ChatGPT, Claude) with associated styling rules for header, background, borders, and typography
- **App Identity**: The app's name and optional logo URL used for branding display in the chat header
- **Theme Mode**: Light or dark color scheme applied to both the platform chrome and component rendering

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch between ChatGPT and Claude styles with visual feedback in under 1 second
- **SC-002**: Users can toggle light/dark mode with immediate visual update (under 500ms)
- **SC-003**: 100% of component previews display without the legacy view/tool name header
- **SC-004**: 100% of component previews display without the legacy outer border
- **SC-005**: App logo and name appear correctly above the component for all apps with configured names
- **SC-006**: Platform style and theme mode selections persist throughout a user session (no unexpected resets)
- **SC-007**: Logo loading failures result in graceful fallback display in 100% of cases

## Assumptions

- The app entity already has name and logo fields available (or the logo can be added as an optional field)
- Session storage or local storage can be used for persisting user preferences
- The visual styling for ChatGPT and Claude platforms can be implemented based on publicly visible UI patterns from both platforms
- The template name can be relocated to an existing UI element (e.g., sidebar, breadcrumb, or metadata panel) without requiring new UI real estate
