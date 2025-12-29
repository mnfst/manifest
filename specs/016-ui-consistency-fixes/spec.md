# Feature Specification: UI Consistency Fixes

**Feature Branch**: `016-ui-consistency-fixes`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "I want to make few changes and fixes to the UI. First, remove the top header in some views. The app selection dropdown comes now to the sidebar below the manifest logo. It should include the app logo and name. Clicking on it shows all the apps and a link to create a new one. Remove the app list then. Then there is an issue, we cannot edit the app once created, where is the edit button? In app detail, pass the create new flow button on top of the list, as in other lists. Generally, make sure that we have a consistency between different views. In the flow edition view, center the 3 tabs menu and replace the usage icon by a chart or something that represent metrics. Remove the steps bar with the add step button as we can only add a step from another one."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - App Selection from Sidebar (Priority: P1)

Users need quick access to switch between apps without navigating through a separate app list page. The app switcher should be prominently located in the sidebar below the logo for constant visibility.

**Why this priority**: This is the core navigation change that removes the separate app list view and consolidates app selection into the sidebar, fundamentally changing how users navigate between apps.

**Independent Test**: Can be fully tested by clicking the app selector in the sidebar and verifying all apps are shown with their logos and names, and that users can switch apps or create a new one.

**Acceptance Scenarios**:

1. **Given** a user is on any page, **When** they look at the sidebar below the Manifest logo, **Then** they see an app selector showing the current app's logo and name (or a prompt to select/create an app if none selected)
2. **Given** a user has multiple apps, **When** they click the app selector, **Then** a dropdown appears showing all apps with their logos and names, plus a "Create new app" link
3. **Given** a user is viewing the app selector dropdown, **When** they click on a different app, **Then** they are navigated to that app's detail page
4. **Given** a user is viewing the app selector dropdown, **When** they click "Create new app", **Then** the create app modal opens

---

### User Story 2 - Top Header Removal (Priority: P1)

The top header bar with the app switcher is redundant once app selection moves to the sidebar. Removing it provides more vertical space for content.

**Why this priority**: Directly dependent on User Story 1 - once app selection is in the sidebar, the header becomes unnecessary clutter.

**Independent Test**: Can be tested by navigating to AppDetail, FlowDetail, and ViewEditor pages and verifying the top header bar is no longer displayed.

**Acceptance Scenarios**:

1. **Given** a user is on the App Detail page, **When** the page loads, **Then** there is no top header bar with the app switcher
2. **Given** a user is on the Flow Detail page, **When** the page loads, **Then** there is no top header bar with the app switcher
3. **Given** a user is on the View Editor page, **When** the page loads, **Then** there is no top header bar with the app switcher
4. **Given** the header is removed, **When** the user views any page, **Then** the content starts directly below any sub-header or at the top of the content area

---

### User Story 3 - App List View Removal (Priority: P1)

With app selection integrated into the sidebar, the dedicated app list page (Home route) becomes redundant.

**Why this priority**: Completes the navigation consolidation - once apps are accessible from the sidebar, users no longer need a separate list page.

**Independent Test**: Can be tested by navigating to the root URL and verifying it redirects to a sensible default (first app's detail or create app flow if no apps exist).

**Acceptance Scenarios**:

1. **Given** a user has at least one app, **When** they navigate to the root URL ("/"), **Then** they are redirected to the first app's detail page
2. **Given** a user has no apps, **When** they navigate to the root URL, **Then** they are shown a create app prompt or the create app modal
3. **Given** the sidebar app selector shows "Apps" navigation item previously, **When** the change is applied, **Then** the "Apps" navigation item is removed from the sidebar

---

### User Story 4 - App Edit Button in App Detail (Priority: P2)

Users cannot currently edit an app after creation. An edit button should be visible in the app detail view.

**Why this priority**: Important usability fix, but not part of the core navigation restructuring.

**Independent Test**: Can be tested by navigating to any app detail page and verifying an edit button is visible and functional.

**Acceptance Scenarios**:

1. **Given** a user is on the App Detail page, **When** they view the app header/info section, **Then** they see an edit button (pencil icon or similar)
2. **Given** a user clicks the app edit button, **When** the modal opens, **Then** they can modify the app name, description, and logo
3. **Given** a user saves app edits, **When** the save completes, **Then** the app detail page reflects the updated information

---

### User Story 5 - Create New Flow Button Positioning (Priority: P2)

The "Create New Flow" button should be at the top of the flow list, consistent with other list patterns in the application.

**Why this priority**: UI consistency improvement that aligns flow creation with app creation patterns.

**Independent Test**: Can be tested by viewing the app detail page and verifying the "Create New Flow" button appears above the flow list.

**Acceptance Scenarios**:

1. **Given** a user is on the App Detail page, **When** they view the Flows section, **Then** the "Create New Flow" button appears at the top of the section (before the flow list)
2. **Given** there are existing flows, **When** the user views the page, **Then** the create button is above the flow list, not below
3. **Given** there are no flows, **When** the user views the empty state, **Then** the create button remains in the empty state card as well as at the top

---

### User Story 6 - Flow Editor Tabs Centering (Priority: P3)

The three tabs (Build, Preview, Usage) in the flow editor should be horizontally centered for better visual balance.

**Why this priority**: Visual polish that improves the editor aesthetics.

**Independent Test**: Can be tested by opening any flow and verifying the tab bar is horizontally centered.

**Acceptance Scenarios**:

1. **Given** a user is on the Flow Detail page, **When** they view the tab bar, **Then** the three tabs are horizontally centered within the available width
2. **Given** the window is resized, **When** the tabs re-render, **Then** they remain centered

---

### User Story 7 - Usage Tab Icon Update (Priority: P3)

The "Usage" tab currently uses a BookOpen icon which doesn't represent metrics. It should use a chart or metrics-related icon.

**Why this priority**: Minor visual improvement for clarity.

**Independent Test**: Can be tested by viewing the Flow Detail tabs and verifying the Usage tab shows a chart/metrics icon.

**Acceptance Scenarios**:

1. **Given** a user is on the Flow Detail page, **When** they view the Usage tab, **Then** it displays a chart or metrics icon (such as BarChart, LineChart, or Activity)
2. **Given** the icon is changed, **When** compared to other icons, **Then** it visually represents analytics/metrics/usage data

---

### User Story 8 - Steps Bar Removal (Priority: P3)

The "Steps" header bar with the "Add Step" button should be removed since steps can only be added from existing steps in the flow diagram.

**Why this priority**: Removes redundant UI element that may confuse users about how to add steps.

**Independent Test**: Can be tested by opening a flow in the Build tab and verifying there is no "Steps" header bar with "Add Step" button.

**Acceptance Scenarios**:

1. **Given** a user is on the Flow Detail page in Build tab, **When** they view the canvas area, **Then** there is no "Steps" header bar or "Add Step" button at the top
2. **Given** the bar is removed, **When** a user wants to add a step, **Then** they do so by interacting with existing step nodes in the flow diagram

---

### Edge Cases

- What happens when a user has no apps and navigates to any route? They should be prompted to create an app.
- How does the sidebar app selector behave when the current app is deleted? It should show the next available app or the create prompt.
- What happens if an app has a very long name in the sidebar selector? The name should be truncated with ellipsis.
- What happens if an app has no logo? A placeholder or initials should be displayed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display an app selector in the sidebar below the Manifest logo
- **FR-002**: App selector MUST show the current app's logo (with fallback placeholder), name, and a chevron-down icon indicating dropdown availability
- **FR-003**: App selector dropdown MUST display all available apps with their logos and names
- **FR-004**: App selector dropdown MUST include a "Create new app" action link
- **FR-005**: System MUST remove the top header bar from AppDetail, FlowDetail, and ViewEditor pages
- **FR-006**: System MUST remove the standalone app list page (Home route with app grid)
- **FR-007**: System MUST redirect root URL ("/") to the current/first app's detail page or create flow
- **FR-008**: App Detail page MUST display an edit button for modifying app properties
- **FR-009**: App edit functionality MUST allow changing name, description, and logo
- **FR-010**: "Create New Flow" button MUST be positioned at the top of the Flows section in App Detail
- **FR-011**: Flow editor tabs (Build, Preview, Usage) MUST be horizontally centered
- **FR-012**: Usage tab MUST display a chart/metrics icon instead of BookOpen
- **FR-013**: System MUST remove the "Steps" header bar and "Add Step" button from Flow Detail Build tab
- **FR-014**: Sidebar MUST remove the "Apps" navigation item since app list is deprecated

### Key Entities

- **App**: Represents an application with name, description, logo URL, slug, flows, and publication status
- **Sidebar App Selector**: New UI component showing current app with dropdown for switching
- **Flow**: Associated with an App, displayed in the flow list within App Detail

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch between apps with no more than 2 clicks from any page (click app selector, click target app)
- **SC-002**: Zero additional page loads required to access app switching (dropdown loads in-place)
- **SC-003**: All pages have consistent layout structure (no header on content pages, sidebar always visible)
- **SC-004**: 100% of edit functionality accessible for both apps and flows from their respective detail pages
- **SC-005**: Visual consistency score: tab centering and button positioning match established patterns across all views
- **SC-006**: Navigation to app editing takes no more than 1 click from app detail page
