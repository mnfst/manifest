# Feature Specification: Manifest UI Blocks Integration

**Feature Branch**: `006-manifest-ui-blocks`
**Created**: 2025-12-27
**Status**: Draft
**Input**: User description: "Improve view edition to use Manifest UI blocks toolkit for table and post list layouts. Use blocks from https://ui.manifest.build/blocks registry only."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Displays with Manifest Table Component (Priority: P1)

When a user creates or views a flow with a table layout, the system displays data using the official Manifest UI Table component instead of the current custom implementation. The table should support all features available in the Manifest component including sorting, row selection, and responsive mobile view.

**Why this priority**: The table is the most commonly used layout. Replacing it with the official Manifest component ensures visual consistency with the ChatGPT app and provides production-ready features out of the box.

**Independent Test**: Create a flow with table layout, verify the rendered table matches Manifest UI Table styling and supports sorting headers.

**Acceptance Scenarios**:

1. **Given** a flow with table layout and mock data, **When** the user views the flow, **Then** the table is rendered using Manifest UI Table component with proper styling
2. **Given** a table with sortable columns, **When** the user clicks a column header, **Then** the data is sorted ascending/descending
3. **Given** a table viewed on mobile, **When** the viewport is small, **Then** the table displays in responsive card view

---

### User Story 2 - View Displays with Manifest Blog Post List Component (Priority: P1)

When a user creates or views a flow with a post-list layout, the system displays data using the official Manifest UI BlogPostList component. The component should support list, grid, and carousel variants.

**Why this priority**: The post-list is the second supported layout type. Using the Manifest component provides visual consistency and advanced display options.

**Independent Test**: Create a flow with post-list layout, verify posts render using Manifest UI BlogPostList styling.

**Acceptance Scenarios**:

1. **Given** a flow with post-list layout, **When** the user views the flow, **Then** posts are rendered using Manifest UI BlogPostList component
2. **Given** a post-list with multiple posts, **When** displayed in list variant, **Then** posts show with proper card styling, author info, and category badges
3. **Given** a post-list component, **When** viewing on different screen sizes, **Then** the layout responds appropriately

---

### User Story 3 - Data Mapping to Manifest Component Props (Priority: P1)

The system transforms stored mock data into the format expected by Manifest UI components. Column definitions map to TableColumn props, and post items map to BlogPost props with proper field alignment.

**Why this priority**: Without proper data mapping, components cannot render correctly. This is foundational to making the integration work.

**Independent Test**: Verify existing mock data renders correctly in Manifest components without errors.

**Acceptance Scenarios**:

1. **Given** TableMockData with columns and rows, **When** passed to Manifest Table, **Then** columns map to TableColumn[] and rows map to data array
2. **Given** PostListMockData with posts, **When** passed to Manifest BlogPostList, **Then** posts map to BlogPost[] with author object structure
3. **Given** mock data with missing optional fields, **When** rendered, **Then** component handles gracefully without errors

---

### User Story 4 - AI Generates Manifest-Compatible Mock Data (Priority: P2)

When the AI generates or updates mock data for views, it produces data structures that are directly compatible with Manifest UI component props without requiring transformation.

**Why this priority**: Ensures new content created via AI chat is immediately usable. Depends on understanding the exact Manifest component schemas.

**Independent Test**: Use AI chat to modify view data, verify output matches Manifest schema.

**Acceptance Scenarios**:

1. **Given** a user requests new table data via chat, **When** AI generates response, **Then** data structure matches Manifest Table expected format
2. **Given** a user requests new post content via chat, **When** AI generates response, **Then** data structure includes author object with name/avatar fields
3. **Given** AI-generated data, **When** rendered in view, **Then** no transformation errors occur

---

### User Story 5 - MCP Server Renders Manifest Components (Priority: P2)

When a published app serves UI through the MCP endpoint, the HTML output uses Manifest UI components rendered server-side or via CDN-hosted scripts.

**Why this priority**: The end goal is that ChatGPT app users see Manifest UI components. This ensures the production experience matches the builder preview.

**Independent Test**: Publish an app and access the MCP UI endpoint, verify HTML contains Manifest component rendering.

**Acceptance Scenarios**:

1. **Given** a published app with table view, **When** accessing /servers/{slug}/ui/{tool}/table.html, **Then** response contains properly rendered Manifest Table
2. **Given** a published app with post-list view, **When** accessing the UI endpoint, **Then** response contains Manifest BlogPostList rendering
3. **Given** MCP server HTML, **When** viewed in browser, **Then** Manifest styling is properly applied

---

### Edge Cases

- What happens when mock data has extra fields not in Manifest schema? (Ignore extra fields, pass through what's needed)
- How does system handle invalid column types? (Fall back to text rendering)
- What if Manifest component CDN is unavailable? (Graceful degradation to basic HTML table/list)
- How are empty data arrays handled? (Show Manifest component's built-in empty state)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render table layouts using Manifest UI Table component
- **FR-002**: System MUST render post-list layouts using Manifest UI BlogPostList component
- **FR-003**: System MUST transform TableMockData to Manifest Table props format (columns -> TableColumn[], rows -> data[])
- **FR-004**: System MUST transform PostListMockData to Manifest BlogPostList props format (posts -> BlogPost[] with author object)
- **FR-005**: System MUST support Table selection modes (none, single, multi) based on configuration
- **FR-006**: System MUST support BlogPostList variants (list, grid, carousel)
- **FR-007**: AI-generated mock data MUST conform to Manifest component schemas
- **FR-008**: MCP server HTML responses MUST render using Manifest UI components
- **FR-009**: System MUST handle dark mode rendering for Manifest components
- **FR-010**: System MUST gracefully handle missing optional fields in mock data

### Key Entities

- **TableColumn (Manifest)**: header (string), accessor (keyof T), sortable (boolean), width (string), align (enum), render (function)
- **BlogPost (Manifest)**: id, title, excerpt, coverImage, author (object with name/avatar), publishedAt, readTime, tags[], category
- **TableMockData**: Current internal format - needs mapping layer to Manifest format
- **PostListMockData**: Current internal format - needs mapping layer to Manifest format

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All table views render identically to Manifest UI Table component documentation examples
- **SC-002**: All post-list views render identically to Manifest UI BlogPostList component documentation examples
- **SC-003**: Existing apps with table/post-list views continue working after migration (100% backward compatibility)
- **SC-004**: View editor preview matches published MCP server output visually
- **SC-005**: New AI-generated content renders without transformation errors
- **SC-006**: Mobile responsiveness works for both table (card view) and post-list layouts

## Assumptions

- Manifest UI components are available via npm package or CDN
- The registry at https://ui.manifest.build/r/registry.json is stable and accessible
- Current mock data structures can be mapped to Manifest schemas with minimal changes
- Dark mode is handled via Manifest component theming props
- Existing shadcn/ui dependencies (used by Manifest) are already compatible with the project
