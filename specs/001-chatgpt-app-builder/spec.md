# Feature Specification: ChatGPT App Builder

**Feature Branch**: `001-chatgpt-app-builder`
**Created**: 2025-12-22
**Status**: Draft
**Scope**: Proof of Concept (POC) - No authentication, testing, or production security features
**Input**: User description: "Build an application that helps users create their ChatGPT app. From a prompt, they will be redirected to a hybrid view 'visual editor + chat' where they will be able to customize the workflow and rendering and publish it to serve on an MCP server"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create App from Prompt (Priority: P1)

A user wants to quickly create a new ChatGPT-powered application by describing what they need in natural language. They enter a prompt describing their desired app, and the agent performs a multi-step generation process:

1. **Layout Selection**: Agent analyzes the prompt and selects the most appropriate layout template (POC: table or post list)
2. **Tool Configuration**: Agent generates an LLM-friendly name and description for the MCP tool and server
3. **Theme Generation**: Agent defines shadcn CSS variables to customize the theme based on the prompt
4. **Mock Data Generation**: Agent generates sample data matching the layout template's expected format (inferred from prompt or using sensible defaults)
5. **Visual Display**: The selected Manifest UI block is rendered in the visual editor with mock data

**Why this priority**: This is the core entry point to the application. Without the ability to generate an initial app from a prompt, users cannot begin the creation process. This delivers immediate value by reducing the barrier to entry.

**Independent Test**: Can be fully tested by entering a prompt and verifying the system generates an initial app configuration with correct layout, tool metadata, theme, and mock data that can be viewed in the editor.

**Acceptance Scenarios**:

1. **Given** a user is on the home screen, **When** they enter a prompt describing their desired app (e.g., "A customer support chatbot that answers questions about product returns"), **Then** the agent selects an appropriate layout template, generates tool name/description, defines theme variables, generates mock data, and redirects the user to the hybrid editor view with the configured component displayed with sample data.

2. **Given** a user enters a prompt suitable for tabular data (e.g., "Show order history in a table"), **When** they submit it, **Then** the agent selects the table layout template.

3. **Given** a user enters a prompt suitable for content listing (e.g., "Display blog posts"), **When** they submit it, **Then** the agent selects the post list layout template.

4. **Given** a user enters a prompt with specific data context (e.g., "Show a list of electronics products"), **When** they submit it, **Then** the agent generates mock data that matches the context (e.g., sample electronics products with relevant names, prices, descriptions).

5. **Given** a user enters an ambiguous prompt without data context, **When** they submit it, **Then** the agent generates sensible default mock data appropriate for the selected layout template.

6. **Given** a user enters an ambiguous prompt, **When** they submit it, **Then** the agent selects the most reasonable layout and allows the user to switch templates via chat.

7. **Given** a user is in the hybrid editor view, **When** they want to start over, **Then** they can return to the prompt screen to create a new app.

---

### User Story 2 - Customize App via Chat (Priority: P2)

A user has generated an initial app and wants to customize how the ChatGPT app displays information to end users. They use the chat panel to request changes to components, layout, and styling through natural language - the agent interprets requests and updates the app configuration.

**Why this priority**: Chat-based customization leverages the agent's capabilities and provides a natural, conversational interface for making changes. The visual editor displays current state while the chat panel enables modifications.

**Independent Test**: Can be fully tested by sending customization requests in the chat and verifying the visual editor reflects those changes.

**Acceptance Scenarios**:

1. **Given** a user is in the hybrid editor view with a generated app, **When** they send a message requesting a change (e.g., "change the primary color to blue"), **Then** the agent updates the theme variables and the visual editor reflects the new styling.

2. **Given** a user wants to modify component properties, **When** they describe the change in chat (e.g., "add a badge that says 'New' to the product cards"), **Then** the agent updates the component configuration accordingly.

3. **Given** a user requests an invalid configuration, **When** they send the request, **Then** the agent explains why the change cannot be made and suggests alternatives.

4. **Given** a user wants to switch layout templates, **When** they request it in chat (e.g., "switch to a table layout"), **Then** the agent updates the layout template and the visual editor displays the new layout.

5. **Given** a user wants to preview changes, **When** they send a test message after making modifications, **Then** the chat panel displays responses using the updated configuration.

---

### User Story 3 - Publish App to MCP Server (Priority: P3)

A user has created and customized their ChatGPT app and wants to make it available for use. They publish the app to an MCP (Model Context Protocol) server, which makes the app accessible as a tool that can be invoked by AI assistants.

**Why this priority**: Publishing is the final step that delivers actual value to end users. However, the app can be developed and tested without publishing, making earlier stories independently valuable.

**Independent Test**: Can be fully tested by clicking publish and verifying the app is accessible via the MCP server.

**Acceptance Scenarios**:

1. **Given** a user has a valid app configuration, **When** they click the publish button, **Then** the system validates the configuration and deploys the app to the MCP server.

2. **Given** a user publishes their app, **When** the deployment completes, **Then** the system displays the MCP server endpoint URL (`/servers/{mcpSlug}/mcp`) and connection details.

3. **Given** a user has previously published an app, **When** they make changes and republish, **Then** the existing deployment is updated with the new configuration (same endpoint maintained).

4. **Given** a user attempts to publish an invalid configuration, **When** they click publish, **Then** the system displays specific validation errors that must be resolved before publishing.

---

### Edge Cases

- What happens when the MCP server is unavailable during publish? The system displays an error message.
- How does the system handle very long or complex prompts? The system processes prompts up to 10,000 characters and provides feedback for prompts exceeding this limit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept natural language prompts and generate initial ChatGPT app configurations using a multi-step agent process (layout selection → tool generation → theme generation → mock data generation → display).
- **FR-002**: Agent MUST select from available layout templates based on prompt analysis (POC: table or post list).
- **FR-003**: Agent MUST generate an LLM-friendly tool name and description for the MCP server based on the prompt.
- **FR-004**: Agent MUST generate shadcn CSS variable overrides to customize the theme based on the prompt.
- **FR-005**: Agent MUST generate mock data matching the selected layout template's expected format, inferring content from the prompt or using sensible defaults.
- **FR-006**: System MUST persist mock data in the database as part of the app configuration.
- **FR-007**: System MUST provide a hybrid view combining a visual component display (with mock data) and a chat panel.
- **FR-008**: System MUST synchronize the visual display with app configuration changes in real-time.
- **FR-009**: Agent MUST interpret chat messages as customization requests and update app configuration accordingly (layout, theme, mock data).
- **FR-010**: Agent MUST validate customization requests and explain when changes cannot be made.
- **FR-011**: System MUST deploy apps to an MCP server and provide connection details upon successful publish.
- **FR-012**: System MUST support updating previously published apps without creating new endpoints.
- **FR-013**: MCP tools MUST return responses in ChatGPT Apps SDK format, including `structuredContent` (mock data) and `_meta.openai/outputTemplate` (UI component URL).
- **FR-014**: Published apps MUST serve their UI component via an HTML endpoint that ChatGPT can render in an iframe.

### Layout Templates (POC)

| Template | Manifest UI Block | Install Command | Use Case |
|----------|-------------------|-----------------|----------|
| Table | @manifest/table | `npx shadcn@latest add @manifest/table` | Tabular data, lists, order history |
| Post List | @manifest/blog-post-list | `npx shadcn@latest add @manifest/blog-post-list` | Content feeds, articles, blog posts |

### Key Entities

- **App**: Represents a user-created ChatGPT application and its MCP server (merged entity). Contains layout template, theme variables, tool configuration (name, description), MCP slug, and publication status. When published, the app is served at `/servers/{mcpSlug}/mcp` (fixed endpoint pattern).
- **Layout Template**: One of the hardcoded Manifest UI blocks (POC: table or post list). Selected by agent based on prompt analysis.
- **Theme Configuration**: shadcn CSS variable overrides generated by agent. Includes primary colors, background, text colors, and other styling variables.
- **Tool Configuration**: MCP tool metadata generated by agent. Contains LLM-friendly name and description that convey intent to AI assistants. Stored directly on the App entity.

## Assumptions

- This is a Proof of Concept (POC) - no authentication, automated testing, or production security features.
- Users have basic familiarity with chatbot concepts and UI customization.
- The MCP server infrastructure is available and managed separately from this application.
- The visual component editor uses the Manifest Agentic UI toolkit (shadcn registry at ui.manifest.build).
- **Single-session operation**: Each browser session works with one app at a time. No persistence between sessions - users start fresh each time. No app listing or history.
- Layout templates are hardcoded for POC (table, post list); dynamic template registry deferred to future versions.
- Agent uses LangChain with configurable LLM provider to perform layout selection, tool generation, and theme generation.
- Monorepo has 3 packages: frontend, backend (includes agent module), and shared. Agent code lives in `backend/src/agent/` as a well-separated module.
- **Minimal API**: Only 4 endpoints (generate, current, chat, publish) - designed for speed of implementation, not scalability.

## Clarifications

### Session 2025-12-22

- Q: What layout options are available for POC? → A: Two hardcoded templates: table (@manifest/table) and post list (@manifest/blog-post-list)
- Q: What is the agent's generation flow? → A: Layout selection → Tool name/description generation → Theme variable generation → Visual editor display
- Q: How are themes customized? → A: Agent generates shadcn CSS variable overrides based on the initial prompt
- Q: How do users customize apps after initial generation? → A: All customizations are made through the chat panel via the agent. There is no direct UI editing in the POC - the visual editor is display-only, showing current configuration state.
- Q: Are App and McpServer separate entities? → A: No, they are merged. The App entity contains all MCP configuration (mcpSlug, toolName, toolDescription) directly.
- Q: How is mock data handled? → A: The agent generates mock data during app creation, matching the layout template's expected format (e.g., table rows for table layout, blog posts for post-list). Mock data is inferred from the user's prompt or uses sensible defaults. It is stored in the database and can be customized via chat.
- Q: Where does the agent code live? → A: The agent is inside the backend package for simplicity (3 packages total: frontend, backend, shared). Agent code is well-separated from other business logic via a dedicated `agent/` module within the backend.
- Q: What do MCP tools return? → A: MCP tools return UI using the ChatGPT Apps SDK format (https://developers.openai.com/apps-sdk/quickstart). The response includes `structuredContent` with the mock data and `_meta.openai/outputTemplate` pointing to the user's customized UI component (rendered via iframe).
- Q: How is the API structured for POC? → A: Minimal 4-endpoint API for single-session operation: POST /generate (create app from prompt), GET /current (get session app), POST /chat (customize via agent), POST /publish (deploy to MCP). No app listing, no persistence between sessions - each session starts fresh.

## Success Criteria *(mandatory)*

### Measurable Outcomes

> **POC Note**: Performance metrics are goals, not hard requirements. See constitution for POC scope.

- **SC-001**: A user can complete the full flow (prompt → customize via chat → publish) in a single session without errors.
- **SC-002**: The visual editor correctly displays the generated layout with mock data.
- **SC-003**: Chat-based customizations (theme, layout, mock data) are reflected in the visual display.
- **SC-004**: Published apps are accessible at `/servers/{mcpSlug}/mcp` and respond to MCP tool calls.
- **SC-005**: The agent generates appropriate mock data based on the selected layout template.
- **SC-006**: MCP tool responses include ChatGPT Apps SDK format with `structuredContent` and `_meta.openai/outputTemplate`.
