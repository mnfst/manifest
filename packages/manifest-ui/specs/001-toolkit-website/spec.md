# Feature Specification: Manifest UI Website

**Feature Branch**: `001-toolkit-website`
**Created**: 2025-12-05
**Status**: Draft
**Input**: User description: "Building a modern UI toolkit website for Agentic UIs (applications that fit on AI assistants like ChatGPT or Claude). There should be a home page, a blocks page that lists the blocks in categories in a sidebar. Clicking on a block shows the block page with example, how to install it and how to use it. Like shadcn/ui does."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse blocks by Category (Priority: P1)

A developer visits the Manifest UI website to explore available blocks. They navigate to the Blocks page where they see a sidebar listing block categories (example: Payment, Products, Selection, Status & Progress, Lists & Tables, Miscellaneous, etc...). They click on a category to expand it and see the blocks within. They click on a block name to view its details. By default the first block of the sidebar is displayed

**Why this priority**: This is the core discovery flow - developers need to find blocks before they can use them. Without browsing capability, the toolkit has no discoverability.

**Independent Test**: Can be fully tested by navigating to /blocks, expanding categories, and clicking block names. Delivers immediate value by enabling block discovery.

**Acceptance Scenarios**:

1. **Given** a user is on the Blocks page, **When** they view the sidebar, **Then** they see all block categories listed with expandable/collapsible sections, expandedby default.
2. **Given** a category is collapsed, **When** the user clicks on it, **Then** it expands to show all blocks in that category
3. **Given** a category is expanded, **When** the user clicks on a block name, **Then** they see the block detail view in the main content area
4. **Given** a user is viewing a block, **When** they look at the sidebar, **Then** the current block is visually highlighted as active

---

### User Story 2 - View Block with All Variants (Priority: P1)

A developer selects a block from the sidebar to understand what it looks like and how it behaves. They see **all variants** of the block on a single page (e.g., "Post Card" shows Default, No Image, Compact, and Horizontal variants). Each variant has its own preview, code view, and install command.

**Why this priority**: Visual preview of all variants is essential for developers to evaluate which configuration fits their needs before investing time in installation.

**Independent Test**: Can be tested by selecting any block and verifying all variants render correctly with their individual previews and controls.

**Acceptance Scenarios**:

1. **Given** a user selects a block, **When** the block page loads, **Then** they see all variants of that block listed vertically on the page
2. **Given** a block has multiple variants (e.g., Default, No Image, Compact), **When** viewing the page, **Then** each variant is displayed with its own section containing preview and code tabs
3. **Given** a variant section is displayed, **When** the user clicks "Preview" tab, **Then** the live component is shown
4. **Given** a variant section is displayed, **When** the user clicks "Code" tab, **Then** the source code with syntax highlighting is shown
5. **Given** a block has interactive elements, **When** the user interacts with them, **Then** the block responds appropriately (selections, hover states, etc.)
6. **Given** a block supports light and dark themes, **When** displayed, **Then** it adapts to the current site theme

---

### User Story 3 - Get Installation Instructions per Variant (Priority: P2)

A developer decides to use a block variant and needs clear instructions on how to add it to their project. Each variant section displays install commands for **all 4 package managers** (npx, pnpm, yarn, bunx) that they can copy with a single click.

**Why this priority**: After discovering a block, installation is the next critical step. Supporting all package managers reduces friction for developers regardless of their tooling preference.

**Independent Test**: Can be tested by verifying installation commands are displayed for all 4 package managers and the copy functionality works correctly.

**Acceptance Scenarios**:

1. **Given** a user is viewing a variant section, **When** they look for installation, **Then** they see a package manager selector with 4 options: npx, pnpm, yarn, bunx
2. **Given** a package manager is selected, **When** viewing the command, **Then** the correct command format is shown:
   - npx: `npx shadcn@latest add @manifest/{name}`
   - pnpm: `pnpm dlx shadcn@latest add @manifest/{name}`
   - yarn: `npx shadcn@latest add @manifest/{name}`
   - bunx: `bunx --bun shadcn@latest add @manifest/{name}`
3. **Given** installation command is displayed, **When** the user clicks the copy button, **Then** the command is copied to their clipboard with visual confirmation
4. **Given** a block has dependencies, **When** viewing installation, **Then** the dependencies are automatically included in the shadcn install

---

### User Story 4 - View Source Code per Variant (Priority: P2)

A developer who wants to understand or customize a block can view its source code directly on the page. Each variant's "Code" tab shows the component source with syntax highlighting.

**Why this priority**: Code visibility helps developers understand implementation and make informed decisions about customization.

**Independent Test**: Can be tested by verifying code is displayed with proper syntax highlighting for each variant.

**Acceptance Scenarios**:

1. **Given** a user is viewing a variant, **When** they click the "Code" tab, **Then** they see the source code with TypeScript/TSX syntax highlighting
2. **Given** code is displayed, **When** the user clicks copy, **Then** the code is copied to clipboard with confirmation
3. **Given** multiple variants exist, **When** viewing code for each, **Then** the code shows the specific props/configuration for that variant

---

### User Story 5 - Explore Use Cases on Homepage (Priority: P3)

A first-time visitor lands on the homepage to understand what Manifest UI offers. They see interactive demonstrations of blocks in realistic conversational contexts (ChatGPT-clone and Claude-clone interfaces) with tabs to switch between different use case scenarios.

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
- **FR-005**: Block pages MUST show ALL variants of a block on a single page (e.g., Default, No Image, Compact, Horizontal)
- **FR-006**: Each variant section MUST have its own "Preview" and "Code" tabs
- **FR-007**: Each variant section MUST display install commands for all 4 package managers (npx, pnpm, yarn, bunx)
- **FR-008**: Install command MUST show package manager selector inline with the tabs
- **FR-009**: Code view MUST display source code with syntax highlighting and copy functionality
- **FR-010**: Code blocks MUST have copy-to-clipboard functionality with visual confirmation
- **FR-011**: Homepage MUST feature tabbed use case demonstrations showing blocks in chat contexts
- **FR-012**: Homepage MUST display ChatGPT-clone interface for demonstrations
- **FR-013**: Homepage MUST display Claude-clone interface for demonstrations
- **FR-014**: Navigation MUST include links between homepage and Blocks page
- **FR-015**: Selected block MUST be visually highlighted in the sidebar
- **FR-016**: All pages MUST support light and dark theme modes
- **FR-017**: Block previews MUST render directly without unnecessary wrapper containers
- **FR-018**: UI MUST be minimal - no nested containers, no excessive borders or backgrounds

### Key Entities

- **Block**: A reusable UI element from the registry with name, dependencies, and source files
- **BlockGroup**: A logical grouping of a block with all its variants (e.g., Post Card with Default, No Image, Compact, Horizontal variants)
- **BlockVariant**: A specific configuration of a block with its own preview and props
- **Category**: A grouping of related block groups (e.g., Blogging, Payment, Products) with name and block list
- **Use Case**: A demonstration scenario showing blocks in conversational context with tab label, chat messages, and embedded blocks
- **Chat Message**: A message in the demo interface with role (user/assistant), text content, and optional embedded block

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can find and navigate to any block within 3 clicks from the homepage
- **SC-002**: Installation commands can be copied with a single click for any of the 4 package managers
- **SC-003**: 100% of blocks in the registry are browsable and have detail pages with all variants
- **SC-004**: Homepage loads and displays interactive demos within 3 seconds on standard connections
- **SC-005**: All block previews render correctly in both light and dark themes
- **SC-006**: Users can switch between use case tabs and see updated demos within 500ms
- **SC-007**: Each variant section includes: live preview, code view, and install commands for all 4 package managers
- **SC-008**: Block pages display all variants without redundant UI elements (no nested tabs, no extra containers)

## Assumptions

- The block registry (`registry.json`) is the source of truth for available blocks
- blocks are already implemented and can be imported for live previews
- The site will be built with the existing Next.js 15 + Tailwind v4 stack (per existing codebase)
- Installation uses the shadcn CLI pattern (`npx shadcn add <name>`)
- Categories are predefined and match the existing structure: Payment, Products, Selection, Status & Progress, Lists & Tables, Miscellaneous. More categories wil be added.
