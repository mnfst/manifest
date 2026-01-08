# Feature Specification: Editable UI Interfaces

**Feature Branch**: `001-edit-uis`
**Created**: 2026-01-07
**Status**: Draft
**Input**: User description: "Let's make the interfaces editable. Each interface should have the default code of the component ready to show. However it should be possible to edit it using a live IDE. In that case we should store the modified version of the code somewhere (in the nodes prop?). Clicking on the 'edit' button of an UI node will bring us to an edit view that replaces all the canvas and shows a 'vibe-coding like' interface with a toggle between preview (default) and code on the main part of the page. The preview will show the component with the default data (dummy) and the code will be a codemirror view (with a custom theme copied from this VS Code theme extension i created https://github.com/mnfst/vscode-theme-manifest) that allows user to manually code. A validator should ensure that the code cannot be saved if it contains errors."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit UI Component Code (Priority: P1)

A flow builder user wants to customize the visual appearance and behavior of an Interface node beyond the default template. They click an "Edit" button on the UI node, which opens a full-screen code editor view replacing the canvas. The editor displays the component's source code with syntax highlighting using the Manifest theme. The user modifies the code and can toggle to a live preview to see their changes rendered with sample data. After making changes, they save and return to the canvas with their customizations persisted.

**Why this priority**: This is the core value proposition - enabling users to fully customize their UI components through code editing. Without this, users are limited to pre-built templates.

**Independent Test**: Can be fully tested by creating an Interface node, clicking Edit, modifying the code, saving, and verifying the customization persists on reload.

**Acceptance Scenarios**:

1. **Given** an Interface node exists on the canvas, **When** the user clicks the "Edit" button on the node, **Then** a full-screen code editor view replaces the canvas
2. **Given** the user is in the code editor view, **When** the view loads, **Then** the component's source code is displayed with Manifest theme syntax highlighting
3. **Given** the user has modified the code, **When** they save their changes, **Then** the modified code is persisted and the user is returned to the canvas view
4. **Given** the user is viewing an Interface node they previously customized, **When** they open the edit view again, **Then** they see their previously saved custom code

---

### User Story 2 - Preview Component with Sample Data (Priority: P2)

A user editing a UI component wants to see how their code changes will look when rendered. They toggle from the code view to the preview view to see their component rendered with dummy/sample data. This allows them to iterate on their design without leaving the editor.

**Why this priority**: Live preview is essential for a productive editing experience but depends on the code editing foundation being in place first.

**Independent Test**: Can be fully tested by opening the edit view, switching to preview mode, and verifying the component renders with sample data.

**Acceptance Scenarios**:

1. **Given** the user is in the code editor view, **When** they click the preview toggle, **Then** the main view area switches to show the rendered component
2. **Given** the preview view is active, **When** the component renders, **Then** it displays with pre-defined sample/dummy data
3. **Given** the preview view is active, **When** the user clicks the code toggle, **Then** the view switches back to showing the code editor

---

### User Story 3 - Code Validation Before Save (Priority: P3)

A user has made changes to a UI component's code and attempts to save. Before the save completes, the system validates the code for errors. If errors exist, the user is shown clear error messages and prevented from saving until the errors are fixed.

**Why this priority**: Validation prevents broken components from being saved, ensuring flow reliability. It enhances the P1 story but the basic save flow can work without it.

**Independent Test**: Can be fully tested by introducing a syntax error in the code and attempting to save, verifying the save is blocked with a clear error message.

**Acceptance Scenarios**:

1. **Given** the user has modified code with syntax errors, **When** they attempt to save, **Then** the save is prevented and error messages are displayed
2. **Given** error messages are displayed, **When** the user reviews them, **Then** each error shows the line number and description of the issue
3. **Given** the user has fixed all errors in the code, **When** they attempt to save again, **Then** the save succeeds and they return to the canvas

---

### User Story 4 - View Default Component Code (Priority: P4)

A user creating a new Interface node with a selected layout template can immediately see the default code for that template when entering the edit view. This provides a starting point for customization and helps users learn the component structure.

**Why this priority**: This enhances discoverability and learning but is not strictly required for the core editing workflow.

**Independent Test**: Can be fully tested by creating a new Interface node with a template, opening the edit view, and verifying the default template code is displayed.

**Acceptance Scenarios**:

1. **Given** a new Interface node is created with a layout template, **When** the user opens the edit view, **Then** the default code for that template is displayed in the editor
2. **Given** different layout templates exist (table, post-list), **When** a user creates nodes with each template, **Then** each shows its respective default code

---

### Edge Cases

- What happens when the user tries to navigate away from the edit view with unsaved changes? System prompts to confirm discarding changes.
- What happens when the code is valid but produces a runtime error in preview? Preview shows error boundary with helpful message instead of crashing.
- What happens when custom code is saved but later the underlying template system changes? Custom code is preserved; user must manually update if desired.
- What happens when the user deletes all code and tries to save? Validation prevents saving empty code.
- What happens when preview fails to render due to missing dependencies? Preview shows clear error message indicating what's missing.

## Requirements *(mandatory)*

### Functional Requirements

**Edit View Navigation**
- **FR-001**: System MUST display an "Edit" button on each Interface node in the canvas
- **FR-002**: System MUST replace the entire canvas area with the edit view when the Edit button is clicked
- **FR-003**: System MUST provide a way to return from the edit view back to the canvas (close/back button)
- **FR-004**: System MUST prompt for confirmation if the user attempts to leave the edit view with unsaved changes

**Code Editor**
- **FR-005**: System MUST display a code editor using the Manifest theme color scheme (background #1c1c24, foreground #f2c79c, comments #6688cc, strings #f7d7bc, numbers #ff9e9c, keywords #F2C79C, variables #a8efe0, functions #2be1b7)
- **FR-006**: System MUST provide syntax highlighting appropriate for the component code language
- **FR-007**: System MUST display line numbers in the code editor
- **FR-008**: System MUST support standard code editing features (undo/redo, find/replace, auto-indentation)

**Preview Mode**
- **FR-009**: System MUST provide a toggle to switch between code view and preview view
- **FR-010**: System MUST default to showing the preview view when entering the edit view
- **FR-011**: System MUST render the component with sample/dummy data in preview mode
- **FR-012**: System MUST display an error boundary with helpful message if the component fails to render

**Code Storage**
- **FR-013**: System MUST store custom code in the Interface node's parameters
- **FR-014**: System MUST distinguish between nodes using default template code and nodes with custom code
- **FR-015**: System MUST persist custom code across page reloads and session restarts

**Validation**
- **FR-016**: System MUST validate code for errors before allowing save
- **FR-017**: System MUST prevent saving code that contains errors
- **FR-018**: System MUST display error messages with line numbers when validation fails
- **FR-019**: System MUST validate that code is not empty

**Default Code**
- **FR-020**: System MUST provide default code for each layout template type (table, post-list)
- **FR-021**: System MUST display the appropriate default code when editing a new/unmodified Interface node

### Key Entities

- **Interface Node Parameters**: Extended to include optional custom code property. If custom code exists, it overrides the default template. Key attributes: layoutTemplate (string), customCode (string, optional), hasCustomCode (boolean flag).

- **Layout Template Defaults**: A registry mapping layout template types to their default component code. Each template has a unique identifier and corresponding source code.

- **Validation Result**: Represents the outcome of code validation. Contains: isValid (boolean), errors (array of error objects with line number, column, message).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open the edit view and see component code within 2 seconds of clicking Edit
- **SC-002**: Users can toggle between code and preview views within 500 milliseconds
- **SC-003**: 100% of code changes made by users are persisted across page reloads
- **SC-004**: Users with syntax errors cannot save until errors are resolved (0% of invalid code saved)
- **SC-005**: 90% of users can successfully customize a component on their first attempt without external help
- **SC-006**: Preview renders updated component within 1 second of toggling to preview mode
- **SC-007**: Error messages clearly identify the location and nature of the issue in all validation failures

## Assumptions

- Users have basic familiarity with code editing and the component syntax being used
- The Manifest theme colors from the VS Code extension are suitable for the code editor without modification
- Sample/dummy data for preview can be statically defined per layout template type
- The existing node parameter storage mechanism can accommodate the additional custom code property
- Code validation can be performed client-side without requiring server round-trips
