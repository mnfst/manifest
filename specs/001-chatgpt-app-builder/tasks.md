# Tasks: ChatGPT App Builder

**Input**: Design documents from `/specs/001-chatgpt-app-builder/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: EXCLUDED (POC scope - explicitly excluded per spec)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Includes exact file paths

## Path Conventions

- **packages/frontend/**: React + Vite application
- **packages/backend/**: NestJS application with agent module
- **packages/shared/**: Shared TypeScript types

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo initialization and basic structure

- [x] T001 Initialize Turborepo monorepo with npm workspaces in package.json and turbo.json
- [x] T002 [P] Create packages/shared package structure with package.json and tsconfig.json
- [x] T003 [P] Create packages/backend package structure with NestJS scaffolding in packages/backend/
- [x] T004 [P] Create packages/frontend package structure with Vite + React scaffolding in packages/frontend/
- [x] T005 Create tsconfig.base.json at repository root with shared TypeScript configuration
- [x] T006 [P] Configure ESLint and Prettier at repository root
- [x] T007 Create root package.json scripts (dev, build, lint, type-check)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Shared Types (packages/shared)

- [x] T008 [P] Create App type and AppStatus enum in packages/shared/src/types/app.ts
- [x] T009 [P] Create LayoutTemplate type and LAYOUT_REGISTRY constant in packages/shared/src/types/app.ts
- [x] T010 [P] Create ThemeVariables interface in packages/shared/src/types/theme.ts
- [x] T011 [P] Create MockData types (TableMockData, PostListMockData) in packages/shared/src/types/mock-data.ts
- [x] T012 [P] Create McpToolResponse and PublishResult types in packages/shared/src/types/mcp.ts
- [x] T013 Create shared package index.ts with all exports in packages/shared/src/index.ts

### Backend Database Setup

- [x] T014 Configure TypeORM with SQLite datasource in packages/backend/src/app/app.module.ts
- [x] T015 Create App entity with all fields in packages/backend/src/entities/app.entity.ts

### Backend Core Module

- [x] T016 Create AppModule with TypeORM configuration in packages/backend/src/app/app.module.ts
- [x] T017 Create AppService with basic CRUD operations in packages/backend/src/app/app.service.ts
- [x] T018 Create AppController skeleton with 4 endpoints in packages/backend/src/app/app.controller.ts
- [x] T019 Configure main.ts with CORS and API prefix in packages/backend/src/main.ts

### Agent Module Structure

- [x] T020 Create AgentModule in packages/backend/src/agent/agent.module.ts
- [x] T021 Create LLM factory with configurable providers in packages/backend/src/agent/llm/index.ts
- [x] T022 Create AgentService skeleton in packages/backend/src/agent/agent.service.ts
- [x] T023 Create tools index with exports in packages/backend/src/agent/tools/index.ts

### Frontend Foundation

- [x] T024 Install Manifest Agentic UI dependencies (shadcn registry) in packages/frontend/
- [x] T025 [P] Install assistant-ui for chat panel in packages/frontend/
- [x] T026 Configure Vite with environment variables in packages/frontend/vite.config.ts
- [x] T027 Create API client utility in packages/frontend/src/lib/api.ts
- [x] T028 Setup React Router with Home and Editor routes in packages/frontend/src/App.tsx
- [x] T029 Create basic page component files in packages/frontend/src/pages/Home.tsx and packages/frontend/src/pages/Editor.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Create App from Prompt (Priority: P1) MVP

**Goal**: Users can enter a prompt and generate an initial app with layout, tool config, theme, and mock data

**Independent Test**: Enter a prompt, verify system generates app with correct layout, tool metadata, theme, and mock data displayed in editor

### Agent Tools for US1

- [x] T030 [P] [US1] Create layout-selector tool in packages/backend/src/agent/tools/layout-selector.ts
- [x] T031 [P] [US1] Create tool-generator tool in packages/backend/src/agent/tools/tool-generator.ts
- [x] T032 [P] [US1] Create theme-generator tool in packages/backend/src/agent/tools/theme-generator.ts
- [x] T033 [P] [US1] Create mock-data-generator tool in packages/backend/src/agent/tools/mock-data-generator.ts

### Agent Service for US1

- [x] T034 [US1] Implement generateApp method in AgentService in packages/backend/src/agent/agent.service.ts

### Backend API for US1

- [x] T035 [US1] Implement POST /generate endpoint in packages/backend/src/app/app.controller.ts
- [x] T036 [US1] Implement createAppFromPrompt method in AppService in packages/backend/src/app/app.service.ts
- [x] T037 [US1] Implement GET /current endpoint in packages/backend/src/app/app.controller.ts
- [x] T038 [US1] Implement getCurrentApp method (session-based) in packages/backend/src/app/app.service.ts

### Frontend Home Page for US1

- [x] T039 [US1] Create prompt input form component in packages/frontend/src/components/prompt/PromptForm.tsx
- [x] T040 [US1] Implement Home page with prompt submission in packages/frontend/src/pages/Home.tsx
- [x] T041 [US1] Add loading state and error handling to Home page in packages/frontend/src/pages/Home.tsx
- [x] T042 [US1] Implement navigation to Editor after generation in packages/frontend/src/pages/Home.tsx

### Frontend Editor Visual Display for US1

- [x] T043 [US1] Install @manifest/table component via shadcn registry in packages/frontend/
- [x] T044 [US1] Install @manifest/blog-post-list component via shadcn registry in packages/frontend/
- [x] T045 [US1] Create LayoutRenderer component for table/post-list in packages/frontend/src/components/editor/LayoutRenderer.tsx
- [x] T046 [US1] Create ThemeProvider for CSS variable injection in packages/frontend/src/components/editor/ThemeProvider.tsx
- [x] T047 [US1] Implement visual display panel in Editor page in packages/frontend/src/components/editor/VisualDisplay.tsx

### Frontend Editor Page Structure for US1

- [x] T048 [US1] Implement Editor page with split layout in packages/frontend/src/pages/Editor.tsx
- [x] T049 [US1] Fetch and display current app on Editor mount in packages/frontend/src/pages/Editor.tsx
- [x] T050 [US1] Add "Start Over" button to return to Home in packages/frontend/src/pages/Editor.tsx

**Checkpoint**: User Story 1 complete - users can generate apps from prompts and see them in the editor

---

## Phase 4: User Story 2 - Customize App via Chat (Priority: P2)

**Goal**: Users can customize their app through natural language chat in the editor

**Independent Test**: Send customization messages in chat, verify visual editor reflects changes

### Agent Tools for US2

- [x] T051 [P] [US2] Create config-updater tool for app modifications in packages/backend/src/agent/tools/config-updater.ts

### Agent Service for US2

- [x] T052 [US2] Implement processChat method in AgentService in packages/backend/src/agent/agent.service.ts

### Backend API for US2

- [x] T053 [US2] Implement POST /chat endpoint in packages/backend/src/app/app.controller.ts
- [x] T054 [US2] Implement chatWithAgent method in AppService in packages/backend/src/app/app.service.ts
- [x] T055 [US2] Return updated app and change list from chat endpoint in packages/backend/src/app/app.controller.ts

### Frontend Chat Panel for US2

- [x] T056 [US2] Configure assistant-ui chat runtime in packages/frontend/src/components/chat/ChatRuntime.tsx
- [x] T057 [US2] Create ChatPanel component with assistant-ui in packages/frontend/src/components/chat/ChatPanel.tsx
- [x] T058 [US2] Implement message submission to /chat endpoint in packages/frontend/src/components/chat/ChatPanel.tsx
- [x] T059 [US2] Display agent responses in chat panel in packages/frontend/src/components/chat/ChatPanel.tsx

### Frontend Real-time Updates for US2

- [x] T060 [US2] Update visual display when app changes from chat in packages/frontend/src/pages/Editor.tsx
- [x] T061 [US2] Display change notifications to user in packages/frontend/src/pages/Editor.tsx
- [x] T062 [US2] Handle invalid customization requests with error display in packages/frontend/src/components/chat/ChatPanel.tsx

**Checkpoint**: User Story 2 complete - users can customize apps via chat

---

## Phase 5: User Story 3 - Publish App to MCP Server (Priority: P3)

**Goal**: Users can publish their app to an MCP server and get connection details

**Independent Test**: Click publish, verify app is accessible via MCP endpoint

### Backend MCP Module for US3

- [x] T063 [P] [US3] Install and configure MCP-Nest in packages/backend/
- [x] T064 [US3] Create McpModule with MCP-Nest configuration in packages/backend/src/mcp/mcp.module.ts
- [x] T065 [US3] Create dynamic tool handler for published apps in packages/backend/src/mcp/mcp.tool.ts
- [x] T066 [US3] Implement ChatGPT Apps SDK response format in packages/backend/src/mcp/mcp.tool.ts

### Backend UI Serving for US3

- [x] T067 [US3] Create UI HTML template for table layout in packages/backend/src/mcp/templates/table.html
- [x] T068 [US3] Create UI HTML template for post-list layout in packages/backend/src/mcp/templates/post-list.html
- [x] T069 [US3] Create UI serving controller for /servers/:slug/ui/:layout.html in packages/backend/src/mcp/ui.controller.ts
- [x] T070 [US3] Inject theme variables into UI templates in packages/backend/src/mcp/ui.controller.ts

### Backend Publish API for US3

- [x] T071 [US3] Implement POST /publish endpoint in packages/backend/src/app/app.controller.ts
- [x] T072 [US3] Implement publishApp method with validation in packages/backend/src/app/app.service.ts
- [x] T073 [US3] Generate mcpSlug from app name in packages/backend/src/app/app.service.ts
- [x] T074 [US3] Update app status to published in packages/backend/src/app/app.service.ts

### Frontend Publish UI for US3

- [x] T075 [US3] Create PublishButton component in packages/frontend/src/components/editor/PublishButton.tsx
- [x] T076 [US3] Implement publish confirmation dialog in packages/frontend/src/components/editor/PublishDialog.tsx
- [x] T077 [US3] Display MCP endpoint URL after publish in packages/frontend/src/components/editor/PublishDialog.tsx
- [x] T078 [US3] Display validation errors if publish fails in packages/frontend/src/components/editor/PublishDialog.tsx
- [x] T079 [US3] Add PublishButton to Editor page in packages/frontend/src/pages/Editor.tsx

**Checkpoint**: User Story 3 complete - users can publish apps to MCP server

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T080 [P] Add environment configuration validation on startup in packages/backend/src/main.ts
- [x] T081 [P] Add error boundaries to React app in packages/frontend/src/components/ErrorBoundary.tsx
- [x] T082 [P] Implement consistent error response format in packages/backend/src/app/
- [x] T083 Add logging for key operations in packages/backend/src/app/app.service.ts
- [x] T084 Create README.md for each package with setup instructions
- [x] T085 Run quickstart.md validation to verify full flow works

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) - MVP
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) - Can run parallel with US1
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) - Can run parallel with US1/US2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories - MVP deliverable
- **User Story 2 (P2)**: Can leverage US1 visual components but independently testable
- **User Story 3 (P3)**: Requires app to exist but independently testable

### Within Each User Story

- Agent tools before agent service
- Agent service before API endpoints
- API endpoints before frontend components
- Backend components can run parallel with frontend when no dependencies

### Parallel Opportunities

**Phase 1 (Setup)**:
```bash
# Run in parallel:
T002: packages/shared structure
T003: packages/backend structure
T004: packages/frontend structure
```

**Phase 2 (Foundational)**:
```bash
# Run in parallel:
T008-T012: All shared types
T024-T025: Frontend UI dependencies
```

**Phase 3 (US1) - Agent Tools**:
```bash
# Run in parallel:
T030: layout-selector tool
T031: tool-generator tool
T032: theme-generator tool
T033: mock-data-generator tool
```

**Phase 3 (US1) - Frontend Components**:
```bash
# Run in parallel (after manifest UI install):
T043: @manifest/table install
T044: @manifest/blog-post-list install
```

**Phase 4 (US2) and Phase 5 (US3)**:
```bash
# User stories can run in parallel if team capacity allows
# US2: T051-T062
# US3: T063-T079
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T007)
2. Complete Phase 2: Foundational (T008-T029)
3. Complete Phase 3: User Story 1 (T030-T050)
4. **STOP and VALIDATE**: Test prompt → generation → editor flow
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Demo (MVP!)
3. Add User Story 2 → Test chat customization → Demo
4. Add User Story 3 → Test MCP publishing → Demo
5. Each story adds value without breaking previous stories

### Suggested MVP Scope

**MVP = User Story 1 only** (Tasks T001-T050)

This delivers:
- Prompt-based app generation
- Layout selection (table/post-list)
- Theme generation
- Mock data generation
- Visual display in editor

Users can create and view apps, providing immediate value for POC validation.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- POC scope: No authentication, no tests, no production security
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies
