# Feature Specification: MCP Flow Publication

**Feature Branch**: `004-4-mcp-flow-publication`
**Created**: 2025-12-26
**Status**: Draft
**Input**: User description: "Let's focus on the publication of MCP flows. A flow is basically an MCP tool that has an id, name and description. It is important that each tool can be active (visible on the MCP server) or not. Same for each application. When an application is published. The MCP server will be accessible at :slug/mcp. See exactly the specification at https://modelcontextprotocol.io/specification/2025-11-25 to make sure we are doing this correctly. Also when an app is published we should have a small landing page that is created and that explains quickly how to add the mcp server/app to chatgpt. You can resume this paragraph https://developers.openai.com/apps-sdk/quickstart#add-your-app-to-chatgpt"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Toggle Flow Active Status (Priority: P1) 🎯 MVP

As a user, I want to toggle whether a flow (MCP tool) is active or inactive, so that I can control which tools are visible on the MCP server without deleting them.

**Why this priority**: This is the core functionality needed to control tool visibility on the MCP server. Without this, users cannot selectively enable/disable individual tools.

**Independent Test**: Navigate to a flow detail page, toggle the active switch, verify the MCP server only exposes active flows when queried.

**Acceptance Scenarios**:

1. **Given** a flow with `isActive: true`, **When** I toggle the active switch off, **Then** the flow's `isActive` becomes `false` and it is not returned by the MCP server's `tools/list` method.
2. **Given** a flow with `isActive: false`, **When** I toggle the active switch on, **Then** the flow's `isActive` becomes `true` and it appears in the MCP server's `tools/list` method.
3. **Given** an app with 3 flows (2 active, 1 inactive), **When** the MCP server receives a `tools/list` request, **Then** only the 2 active flows are returned.

---

### User Story 2 - Publish/Unpublish App (Priority: P2)

As a user, I want to publish or unpublish my entire app, so that the MCP server becomes accessible or inaccessible at the app's slug endpoint.

**Why this priority**: Publishing controls whether the MCP server is reachable at all. This builds on the flow activation feature but controls the entire server visibility.

**Independent Test**: On app detail page, click "Publish" button, verify MCP server responds at `/servers/{slug}/mcp`. Click "Unpublish", verify endpoint returns 404.

**Acceptance Scenarios**:

1. **Given** an app with status `draft`, **When** I click "Publish", **Then** the app status becomes `published` and the MCP endpoint at `/servers/{slug}/mcp` becomes accessible.
2. **Given** an app with status `published`, **When** I click "Unpublish", **Then** the app status becomes `draft` and the MCP endpoint returns 404.
3. **Given** a published app with no active flows, **When** the MCP server receives `tools/list`, **Then** an empty tools array is returned (server still accessible, just no tools).

---

### User Story 3 - App Landing Page with ChatGPT Integration Instructions (Priority: P3)

As a user, I want a public landing page for my published app that explains how to add it to ChatGPT, so that I can share a link with others to easily connect to my MCP server.

**Why this priority**: This provides discoverability and user onboarding for the published MCP server. It's valuable but builds on the publication infrastructure.

**Independent Test**: Publish an app, navigate to `/servers/{slug}`, verify landing page displays app name, description, and ChatGPT integration instructions.

**Acceptance Scenarios**:

1. **Given** a published app, **When** I navigate to `/servers/{slug}`, **Then** I see a landing page with the app name, description, and MCP endpoint URL.
2. **Given** a published app landing page, **When** I view the "Add to ChatGPT" section, **Then** I see clear instructions: "Go to Settings → Apps & Connectors → Create → Enter URL: `https://domain.com/servers/{slug}/mcp`".
3. **Given** an unpublished (draft) app, **When** I navigate to `/servers/{slug}`, **Then** I see a 404 or "App not published" message.

---

### User Story 4 - MCP Server Protocol Compliance (Priority: P4)

As a user, I want my MCP server to be fully compliant with the MCP specification, so that it works correctly with ChatGPT and other MCP clients.

**Why this priority**: Protocol compliance is essential for the server to work, but the existing MCP implementation already handles most of this. This story focuses on ensuring the server correctly filters by active flows and published apps.

**Independent Test**: Use an MCP client to connect to a published app, verify `initialize`, `tools/list`, and `tools/call` methods work correctly per the MCP spec.

**Acceptance Scenarios**:

1. **Given** a published app, **When** an MCP client sends `initialize`, **Then** the server responds with protocol version, capabilities, and server info per MCP spec.
2. **Given** a published app with active flows, **When** an MCP client sends `tools/list`, **Then** the server returns all active flows as tools with name, description, and input schema.
3. **Given** a published app, **When** an MCP client calls an inactive flow's tool, **Then** the server returns an error indicating the tool is not available.

---

### Edge Cases

- What happens when a user tries to publish an app with no flows? → Allow publish, MCP server returns empty tools array.
- What happens when a user deactivates all flows on a published app? → App remains published, MCP server returns empty tools array.
- What happens when the slug already exists from another app? → Slug is already unique per app creation, no additional handling needed.
- What happens when the domain changes? → Landing page dynamically generates the URL based on request host.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow toggling a flow's `isActive` status between `true` and `false`.
- **FR-002**: System MUST only expose active flows (`isActive: true`) in the MCP server's `tools/list` response.
- **FR-003**: System MUST allow changing an app's status between `draft` and `published`.
- **FR-004**: System MUST only serve MCP endpoints for apps with status `published`.
- **FR-005**: System MUST return 404 for MCP endpoints of unpublished (draft) apps.
- **FR-006**: System MUST provide a landing page at `/servers/{slug}` for published apps.
- **FR-007**: Landing page MUST display app name, description, and MCP endpoint URL.
- **FR-008**: Landing page MUST include ChatGPT integration instructions following the official quickstart guide.
- **FR-009**: MCP server MUST comply with MCP specification 2025-11-25 for `initialize`, `tools/list`, and `tools/call` methods.
- **FR-010**: System MUST return an error when an MCP client attempts to call an inactive or non-existent tool.

### Key Entities

- **Flow**: Add `isActive: boolean` field (default: `true`) to control tool visibility on MCP server.
- **App**: Uses existing `status: 'draft' | 'published'` field to control MCP server accessibility.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can toggle flow active status with immediate effect on MCP server responses.
- **SC-002**: Users can publish/unpublish apps with immediate effect on MCP endpoint availability.
- **SC-003**: Landing page loads in under 1 second and displays correct integration instructions.
- **SC-004**: MCP server passes protocol compliance checks for initialize, tools/list, and tools/call.
- **SC-005**: 100% of published apps are accessible via their MCP endpoint; 100% of draft apps return 404.
