# Feature Specification: Preview LLM Chat

**Feature Branch**: `030-preview-llm-chat`
**Created**: 2026-01-06
**Status**: Draft
**Input**: User description: "The preview tab in a flow should be updated to be a chat with a real LLM that has the MCP tools of the flows. First we create a settings tab on the sidebar. The setting page will display few tabs using the same component as the one on app flow. The first tab should be called General and show Coming soon, and then the second tab should be API keys. For now we will allow only OpenAI API key but we will add other models soon. For the settings and preview page, take inspiration of MCPJam inspector for the API keys and chat interface. The preview will let us access an agent with model selection through popular OpenAI models by a dropdown. For the chat interface use assistant-ui for the elements and animations. The chat should be able to render UIs the same way ChatGPT renders ChatGPT apps."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure OpenAI API Key (Priority: P1)

A user wants to test their flow with a real LLM. Before they can use the preview chat, they need to configure their OpenAI API key in the application settings.

**Why this priority**: Without an API key configured, users cannot use the LLM preview feature at all. This is a prerequisite for all other functionality.

**Independent Test**: Can be fully tested by navigating to Settings > API Keys, entering an API key, saving it, and confirming the key persists after page refresh.

**Acceptance Scenarios**:

1. **Given** a user is on any page, **When** they click "Settings" in the sidebar, **Then** they see a settings page with tabbed navigation
2. **Given** a user is on the Settings page, **When** they click the "API Keys" tab, **Then** they see a form to enter their OpenAI API key
3. **Given** a user has entered an API key, **When** they click "Save", **Then** the key is stored securely and a success confirmation is shown
4. **Given** a user has previously saved an API key, **When** they return to the API Keys page, **Then** the key field shows a masked representation (e.g., `sk-...xxxx`) indicating a key is configured
5. **Given** a user wants to update their API key, **When** they enter a new key and save, **Then** the new key replaces the old one

---

### User Story 2 - Chat with LLM Using Flow's MCP Tools (Priority: P2)

A user wants to test their flow by chatting with an LLM that has access to the flow's MCP tools. They use the Preview tab to interact with the agent and see how it responds to various inputs.

**Why this priority**: This is the core functionality that enables users to test their flows with real LLM interactions. Depends on P1 (API key) being configured.

**Independent Test**: Can be fully tested by opening a flow's Preview tab, selecting a model, typing a message that would trigger a flow tool, and verifying the LLM responds using the MCP tool.

**Acceptance Scenarios**:

1. **Given** a user has configured an API key and opens a flow's Preview tab, **When** the tab loads, **Then** they see a chat interface with a model selection dropdown
2. **Given** a user is in the Preview tab, **When** they select a model from the dropdown, **Then** the selected model is used for subsequent conversations
3. **Given** a user types a message and sends it, **When** the LLM processes it, **Then** the user sees their message appear immediately and the LLM response streams in progressively
4. **Given** a flow has MCP tools configured, **When** the user asks something that triggers a tool, **Then** the LLM uses the tool and shows the result in the conversation
5. **Given** a conversation is in progress, **When** the user sends multiple messages, **Then** the conversation history is maintained within the session

---

### User Story 3 - Rich UI Rendering in Chat (Priority: P3)

A user's flow generates structured outputs (similar to ChatGPT apps/GPTs). The chat interface should render these outputs as rich UI components rather than plain text.

**Why this priority**: Enhances the testing experience by showing actual UI rendering, making it easier to validate how the flow will behave in production. Depends on P2 (chat functionality).

**Independent Test**: Can be tested by triggering a tool that returns structured UI data and verifying the chat renders it as a styled component.

**Acceptance Scenarios**:

1. **Given** a tool returns structured data (e.g., a card, list, or form), **When** the response is displayed, **Then** the chat renders it as a styled UI component
2. **Given** a tool returns markdown content, **When** the response is displayed, **Then** the chat renders it with proper formatting (headings, code blocks, lists, links)
3. **Given** a tool returns an error, **When** the response is displayed, **Then** the chat shows a clear error message with appropriate styling

---

### User Story 4 - Settings General Tab Placeholder (Priority: P4)

A user navigates to the Settings page and sees a "General" tab indicating future settings will be available.

**Why this priority**: Low priority as it's a placeholder. Included for completeness and to establish the settings page structure.

**Independent Test**: Can be tested by navigating to Settings and verifying the General tab shows "Coming soon" message.

**Acceptance Scenarios**:

1. **Given** a user opens the Settings page, **When** they view the tabs, **Then** they see "General" as the first tab and "API Keys" as the second
2. **Given** a user clicks the "General" tab, **When** the tab content loads, **Then** they see a "Coming soon" message

---

### Edge Cases

- What happens when the user hasn't configured an API key and tries to use Preview? System displays a message directing them to configure an API key in Settings.
- What happens when the API key is invalid or expired? System displays a clear error message indicating the API key issue and suggests checking Settings.
- What happens when the network connection is lost during a chat? System displays a connection error message and allows retry.
- What happens when the LLM rate limit is exceeded? System displays an appropriate error message indicating rate limiting.
- What happens when a tool execution takes too long? System shows a loading indicator and handles timeout gracefully with an error message.
- What happens when the user clears the chat? Conversation history is reset and user can start fresh.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a "Settings" navigation item in the sidebar that navigates to a settings page
- **FR-002**: Settings page MUST use the existing tabbed interface component (same as flow detail tabs)
- **FR-003**: Settings page MUST display a "General" tab with a "Coming soon" placeholder message
- **FR-004**: Settings page MUST display an "API Keys" tab for managing API keys
- **FR-005**: System MUST allow users to enter and save an OpenAI API key
- **FR-006**: System MUST securely store the API key (client-side localStorage for initial implementation, with masked display)
- **FR-007**: System MUST mask saved API keys when displaying them (showing only last 4 characters)
- **FR-008**: System MUST allow users to update or delete their stored API key
- **FR-009**: Preview tab MUST transform from placeholder to a functional chat interface
- **FR-010**: Preview tab MUST display a model selection dropdown with popular OpenAI models (gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo)
- **FR-011**: System MUST initialize the LLM with access to the current flow's MCP tools
- **FR-021**: Backend MUST provide a chat endpoint that proxies requests to OpenAI (receives API key from frontend per request)
- **FR-012**: Chat interface MUST display user messages and LLM responses in a conversation format
- **FR-013**: Chat interface MUST support streaming responses (progressive display as LLM generates)
- **FR-014**: Chat interface MUST show loading/typing indicators while waiting for responses
- **FR-015**: Chat interface MUST render markdown content (headings, code blocks, lists, links)
- **FR-016**: Chat interface MUST render structured UI outputs from tools as styled components
- **FR-017**: Chat interface MUST maintain conversation history within a session
- **FR-018**: System MUST display clear error messages for API key issues, network errors, and rate limiting
- **FR-019**: Preview tab MUST be disabled when no API key is configured (with tooltip explaining why)
- **FR-020**: System MUST allow users to clear the conversation and start fresh

### Key Entities *(include if feature involves data)*

- **APIKeyConfiguration**: Represents a stored API key with provider type (OpenAI), masked value for display, and timestamp
- **ChatMessage**: Represents a message in the conversation with role (user/assistant/system), content, timestamp, and optional tool call information
- **ChatSession**: Represents an active chat session with selected model, conversation history, and associated flow
- **ModelOption**: Represents an available LLM model with id, display name, and provider

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure an API key in under 1 minute from accessing settings
- **SC-002**: Users can send a message and receive a response within expected LLM response times (varies by model and prompt)
- **SC-003**: 95% of tool invocations from the LLM successfully execute and return results to the chat
- **SC-004**: Users can understand tool execution results through clear UI rendering
- **SC-005**: Users can identify and resolve API key issues through clear error messaging
- **SC-006**: Chat interface responsiveness matches modern chat application standards (immediate feedback on send, smooth scrolling, visible typing indicators)

## Clarifications

### Session 2026-01-06

- Q: Where should OpenAI API calls originate (frontend direct vs backend proxy)? → A: Backend proxies API calls; frontend sends key per request; no authentication layer (POC phase)

## Assumptions

- OpenAI API is the initial and only provider; architecture should accommodate future providers but implementation focuses on OpenAI
- API keys are stored client-side in localStorage; frontend sends key to backend per chat request; backend proxies calls to OpenAI
- No authentication or authorization layer for this POC implementation
- The existing MCP tool infrastructure from the flow can be connected to the LLM chat
- assistant-ui library will be used for chat UI components and animations
- The chat session is ephemeral (not persisted between page loads); persistence may be added later
- Model selection defaults to a reasonable choice (e.g., gpt-4o-mini) if no preference is set
