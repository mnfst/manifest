# Feature Specification: Agentic UI Toolkit Website

**Feature Branch**: `001-toolkit-website`
**Created**: 2025-12-05
**Status**: Draft
**Input**: User description: "Building a modern UI toolkit website for Agentic UIs (applications that fit on AI assistants like ChatGPT or Claude). There should be a home page, a blocks page that lists the blocks in categories in a sidebar. Clicking on a block shows the block page with example, how to install it and how to use it. Like shadcn/ui does."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse blocks by Category (Priority: P1)

A developer visits the Agentic UI Toolkit website to explore available blocks. They navigate to the Blocks page where they see a sidebar listing block categories (example: Payment, Products, Selection, Status & Progress, Lists & Tables, Miscellaneous, etc...). They click on a category to expand it and see the blocks within. They click on a block name to view its details. By default the first block of the sidebar is displayed

**Why this priority**: This is the core discovery flow - developers need to find blocks before they can use them. Without browsing capability, the toolkit has no discoverability.

**Independent Test**: Can be fully tested by navigating to /blocks, expanding categories, and clicking block names. Delivers immediate value by enabling block discovery.

**Acceptance Scenarios**:

1. **Given** a user is on the Blocks page, **When** they view the sidebar, **Then** they see all block categories listed with expandable/collapsible sections, expandedby default.
2. **Given** a category is collapsed, **When** the user clicks on it, **Then** it expands to show all blocks in that category
3. **Given** a category is expanded, **When** the user clicks on a block name, **Then** they see the block detail view in the main content area
4. **Given** a user is viewing a block, **When** they look at the sidebar, **Then** the current block is visually highlighted as active

---

### User Story 2 - View block Details with Live Preview (Priority: P1)

A developer selects a block from the sidebar to understand what it looks like and how it behaves. They see a live preview of the block rendered in an isolated container, allowing them to interact with it and observe its states.

**Why this priority**: Visual preview is essential for developers to evaluate if a block fits their needs before investing time in installation and implementation.

**Independent Test**: Can be tested by selecting any block and verifying the preview renders correctly with interactive functionality.

**Acceptance Scenarios**:

1. **Given** a user selects a block, **When** the block page loads, **Then** a live preview of the block is displayed in an isolated container
2. **Given** a block has interactive elements, **When** the user interacts with them, **Then** the block responds appropriately (selections, hover states, etc.)
3. **Given** a block supports light and dark themes, **When** displayed, **Then** it adapts to the current site theme

---

### User Story 3 - Get Installation Instructions (Priority: P2)

A developer decides to use a block and needs clear instructions on how to add it to their project. They find installation commands that they can copy with a single click.

**Why this priority**: After discovering a block, installation is the next critical step. Clear, copy-able instructions reduce friction and support adoption.

**Independent Test**: Can be tested by verifying installation commands are displayed and the copy functionality works correctly.

**Acceptance Scenarios**:

1. **Given** a user is viewing a block detail page, **When** they look for installation, **Then** they see a clear installation command (e.g., `npx shadcn add <block-name>`)
2. **Given** installation instructions are displayed, **When** the user clicks the copy button, **Then** the command is copied to their clipboard with visual confirmation
3. **Given** a block has dependencies, **When** viewing installation, **Then** required dependencies are clearly listed

---

### User Story 4 - Learn block Usage (Priority: P2)

A developer who has installed a block needs to understand how to use it in their code. They find usage examples showing import statements and basic implementation patterns.

**Why this priority**: Usage documentation completes the adoption journey. Without it, developers may struggle to implement blocks correctly.

**Independent Test**: Can be tested by verifying usage code examples are present and accurate for each block.

**Acceptance Scenarios**:

1. **Given** a user is viewing a block, **When** they scroll to usage section, **Then** they see import statements and basic code examples
2. **Given** code examples are displayed, **When** the user clicks copy, **Then** the code is copied to clipboard with confirmation
3. **Given** a block has multiple variants, **When** viewing usage, **Then** examples for different configurations are provided

---

### User Story 5 - Explore Use Cases on Homepage (Priority: P3)

A first-time visitor lands on the homepage to understand what Agentic UI Toolkit offers. They see interactive demonstrations of blocks in realistic conversational contexts (ChatGPT-clone and Claude-clone interfaces) with tabs to switch between different use case scenarios.

**Why this priority**: Homepage creates first impressions and helps visitors understand the toolkit's value proposition. Important for adoption but not blocking core functionality.

**Independent Test**: Can be tested by loading the homepage, switching between tabs, and observing chat demonstrations.

**Acceptance Scenarios**:

1. **Given** a user visits the homepage, **When** the page loads, **Then** they see a clear headline explaining the toolkit's purpose, with subittle.
2. **Given** the homepage has use case tabs, **When** the user clicks a tab, **Then** the demo updates to show that specific scenario. The first tab is selected by default.
3. **Given** a demo is displayed, **When** viewing the chat interface, **Then** blocks are rendered inline within conversation messages
4. **Given** multiple AI interface styles exist, **When** viewing demos, **Then** both ChatGPT-style and Claude-style interfaces are available, from sub-tabs

---

### Edge Cases

- What happens when a block fails to render in the preview?
  - Display an error message with a retry option
- How does the system handle deep links to non-existent blocks?
  - Show a 404 state with navigation back to the blocks listing
- What happens when a user has JavaScript disabled?
  - Core navigation and content should be accessible; interactive previews gracefully degrade
- How does the site behave on slow network connections?
  - Show loading states for blocks; prioritize text content

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display a homepage with toolkit introduction and interactive demonstrations
- **FR-002**: System MUST provide a Blocks page with sidebar navigation organized by categories
- **FR-003**: Sidebar categories MUST be expandable and collapsible
- **FR-004**: System MUST display individual block pages when a block is selected
- **FR-005**: block pages MUST show a live, interactive preview of the block
- **FR-006**: block pages MUST display installation commands with copy-to-clipboard functionality
- **FR-007**: block pages MUST include usage examples with import statements and code snippets
- **FR-008**: Code blocks MUST have copy-to-clipboard functionality with visual confirmation
- **FR-009**: Homepage MUST feature tabbed use case demonstrations showing blocks in chat contexts
- **FR-010**: Homepage MUST display ChatGPT-clone interface for demonstrations
- **FR-011**: Homepage MUST display Claude-clone interface for demonstrations
- **FR-012**: Navigation MUST include links between homepage and Blocks page
- **FR-013**: Selected block MUST be visually highlighted in the sidebar
- **FR-014**: All pages MUST support light and dark theme modes
- **FR-015**: block previews MUST be isolated and self-contained

### Key Entities

- **block**: A reusable UI element with name, category, preview, installation command, usage examples, and dependencies
- **Category**: A grouping of related blocks (e.g., Payment, Products, Selection) with name and block list
- **Use Case**: A demonstration scenario showing blocks in conversational context with tab label, chat messages, and embedded blocks
- **Chat Message**: A message in the demo interface with role (user/assistant), text content, and optional embedded block

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can find and navigate to any block within 3 clicks from the homepage
- **SC-002**: Installation commands can be copied with a single click on any block page
- **SC-003**: 100% of blocks in the registry are browsable and have detail pages
- **SC-004**: Homepage loads and displays interactive demos within 3 seconds on standard connections
- **SC-005**: All block previews render correctly in both light and dark themes
- **SC-006**: Users can switch between use case tabs and see updated demos within 500ms
- **SC-007**: Each block page includes at minimum: live preview, installation command, and usage example

## Assumptions

- The block registry (`registry.json`) is the source of truth for available blocks
- blocks are already implemented and can be imported for live previews
- The site will be built with the existing Next.js 15 + Tailwind v4 stack (per existing codebase)
- Installation uses the shadcn CLI pattern (`npx shadcn add <name>`)
- Categories are predefined and match the existing structure: Payment, Products, Selection, Status & Progress, Lists & Tables, Miscellaneous. More categories wil be added.
