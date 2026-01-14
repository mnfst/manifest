# Feature Specification: App Theme Editor

**Feature Branch**: `001-app-theme-editor`
**Created**: 2026-01-13
**Status**: Draft
**Input**: User description: "Add a shadcn theme editor at the app level that will affect all the UIs below. In the app detail page add a new tab called 'Theme' with a theme editor containing visual controls, a code editor (CodeMirror), and a modular preview component. Save button persists theme settings to Theme Variables column."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit Theme Colors Visually (Priority: P1)

A user wants to customize their app's visual appearance by adjusting theme colors through an intuitive visual interface. They navigate to the app detail page, select the "Theme" tab, and use color pickers to modify primary, background, accent, and other theme colors. Changes appear immediately in the preview component, allowing them to see the effect before saving.

**Why this priority**: This is the core functionality of the theme editor. Without visual color editing, the feature has no primary value. Users expect a WYSIWYG experience when customizing themes.

**Independent Test**: Can be fully tested by opening the Theme tab, changing a color with the picker, verifying the preview updates, and saving to confirm persistence.

**Acceptance Scenarios**:

1. **Given** a user is on the app detail page, **When** they click the "Theme" tab, **Then** they see the theme editor with all editable theme variables displayed
2. **Given** the theme editor is open, **When** the user clicks a color picker for "--primary", **Then** a color selection interface appears with the current value pre-selected
3. **Given** the user has selected a new color, **When** the color picker closes, **Then** the preview component immediately reflects the new primary color
4. **Given** the user has made color changes, **When** they click "Save", **Then** the theme variables are persisted to the database and a success confirmation appears

---

### User Story 2 - Edit Theme via Code Editor (Priority: P2)

A power user or developer wants to edit the theme configuration directly as CSS/code rather than using visual controls. They switch to the code view showing a CodeMirror editor with the current theme variables. They can manually edit values, including copying/pasting theme configurations from external sources.

**Why this priority**: Provides an alternative workflow for technical users and enables bulk editing. Depends on P1 for the basic UI structure but adds significant value for advanced use cases.

**Independent Test**: Can be tested by switching to code view, manually editing a CSS variable value, verifying the preview updates, and saving to confirm persistence.

**Acceptance Scenarios**:

1. **Given** the theme editor is open, **When** the user views the code editor panel, **Then** they see all current theme variables displayed as editable CSS custom properties
2. **Given** the code editor is visible, **When** the user modifies a value (e.g., changes `--primary: 222.2 47.4% 11.2%` to `--primary: 200 50% 20%`), **Then** the preview component updates to reflect the change
3. **Given** the user enters invalid CSS syntax, **When** they attempt to save, **Then** the system displays a validation error indicating the problem
4. **Given** the user pastes a complete theme configuration, **When** the paste completes, **Then** the visual controls and preview update to match the pasted values

---

### User Story 3 - Preview Theme Changes (Priority: P3)

A user wants to see how their theme changes will look on actual UI components before committing to save. The preview component displays representative shadcn components (buttons, inputs, cards, etc.) styled with the current theme values in real-time.

**Why this priority**: Preview is essential for user confidence but is technically a supporting feature to the editing capabilities. The preview component should be modular/replaceable per requirements.

**Independent Test**: Can be tested by making any theme change and verifying the preview components visually update without requiring a save action.

**Acceptance Scenarios**:

1. **Given** the theme editor is open, **When** the page loads, **Then** a preview section displays sample UI components using the current theme
2. **Given** any theme variable is changed (via picker or code), **When** the change is made, **Then** the preview updates within 100ms to show the new appearance
3. **Given** the preview component is implemented, **When** a developer wants to replace it, **Then** they can swap in a different preview component without modifying the theme editor logic

---

### User Story 4 - Reset to Default Theme (Priority: P4)

A user has made several theme changes but wants to revert to the default theme configuration. They click a "Reset to Default" button which restores all theme variables to their original values.

**Why this priority**: Safety net feature that reduces user anxiety about making changes. Lower priority as it's not required for core editing functionality.

**Independent Test**: Can be tested by making changes, clicking reset, and verifying all values return to defaults.

**Acceptance Scenarios**:

1. **Given** the user has modified theme variables, **When** they click "Reset to Default", **Then** a confirmation dialog appears asking to confirm the reset
2. **Given** the user confirms the reset, **When** the action completes, **Then** all theme variables revert to the default values and the preview updates accordingly

---

### Edge Cases

- What happens when a user enters an invalid HSL value (e.g., "not-a-color")?
  - System displays inline validation error and prevents saving until corrected
- What happens when the user navigates away with unsaved changes?
  - System prompts with "You have unsaved changes. Discard changes?" dialog
- What happens when the save request fails due to network error?
  - System displays error message and retains the unsaved state for retry
- What happens when two users edit the same app's theme simultaneously?
  - Last-write-wins; the most recent save overwrites previous changes
- What happens when the code editor contains malformed CSS syntax?
  - System validates on blur/save and highlights the problematic line with an error message

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Theme" tab in the app detail page navigation alongside existing tabs (Flows, Analytics, Users)
- **FR-002**: System MUST provide visual color picker controls for all theme variables: primary, primary-foreground, background, foreground, muted, muted-foreground, accent, accent-foreground, card, card-foreground, popover, popover-foreground, secondary, secondary-foreground, border, input, ring, destructive, destructive-foreground
- **FR-003**: System MUST provide a radius control for the `--radius` variable (input field accepting rem/px values)
- **FR-004**: System MUST display a CodeMirror-based code editor showing the complete theme configuration as CSS custom properties
- **FR-005**: System MUST synchronize changes bidirectionally between visual controls and code editor (changes in one reflect in the other)
- **FR-006**: System MUST render a preview component that updates in real-time as theme values change
- **FR-007**: The preview component MUST be architecturally independent and replaceable without modifying the theme editor core logic
- **FR-008**: System MUST provide a "Save" button that persists theme changes to the app's themeVariables column
- **FR-009**: System MUST provide a "Reset to Default" button that restores default theme values after user confirmation
- **FR-010**: System MUST validate theme values before saving and display clear error messages for invalid entries
- **FR-011**: System MUST warn users with a confirmation dialog when navigating away with unsaved changes
- **FR-012**: System MUST display the current saved state vs unsaved changes indicator (dirty state)

### Key Entities

- **ThemeVariables**: Configuration object containing CSS custom property key-value pairs (already exists in database as JSON column on App entity)
- **App**: Parent entity that owns the theme configuration (existing entity with themeVariables column)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can modify any theme color and see the preview update within 200ms of the change
- **SC-002**: Users can complete a full theme customization (modify 5+ colors and save) in under 3 minutes
- **SC-003**: Theme changes persist correctly across page reloads and browser sessions
- **SC-004**: The code editor accepts and correctly parses theme configurations pasted from external sources
- **SC-005**: The preview component can be replaced by a developer in under 30 minutes without modifying theme editor logic
- **SC-006**: 100% of invalid theme values are caught by validation before reaching the database

## Assumptions

- The existing `themeVariables` JSON column structure and API endpoints are sufficient; no database schema changes required
- HSL color format (e.g., "222.2 47.4% 11.2%") will continue to be the standard format for color values
- CodeMirror 6 will be added as a new dependency for the code editor functionality
- The preview component will initially show a representative set of shadcn components (buttons, inputs, cards, switches) but the specific components shown can be decided during implementation
- Dark mode toggle is out of scope for this feature; the editor edits the light theme variables only
