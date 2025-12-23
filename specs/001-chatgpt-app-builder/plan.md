# Implementation Plan: ChatGPT App Builder

**Branch**: `001-chatgpt-app-builder` | **Date**: 2025-12-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-chatgpt-app-builder/spec.md`

## Summary

Build a POC application that enables users to create ChatGPT-powered apps through a natural language prompt interface. Users are redirected to a hybrid view combining a visual component editor with a live chat testing panel, where they can customize UI components and rendering settings. Completed apps are published to an MCP (Model Context Protocol) server for integration with AI assistants.

**Technical Approach**: Turborepo monorepo with 3 packages (frontend, backend, shared). The agent is a well-separated module inside the backend package (`backend/src/agent/`) using LangChain with configurable LLM providers and modular tools. Backend serves as MCP server host using MCP-Nest. Frontend provides the hybrid editor experience using React + Vite with Manifest Agentic UI toolkit (shadcn registry) and assistant-ui for the chat panel.

## Technical Context

**Language/Version**: TypeScript 5.x (all packages)
**Primary Dependencies**:
- Frontend: React 18+, Vite, Manifest Agentic UI (ui.manifest.build), assistant-ui
- Backend: NestJS, TypeORM, MCP-Nest
- Agent: LangChain.js
- Build: Turborepo, npm workspaces

**Storage**: SQLite (TypeORM) - designed for easy migration to PostgreSQL
**Testing**: N/A (POC scope - testing explicitly excluded)
**Target Platform**: Web (Node.js backend, browser frontend)
**Project Type**: Monorepo web application
**Performance Goals**:
- App generation from prompt: < 30 seconds
- Editor sync latency: < 2 seconds
- MCP response time: < 5 seconds

**Constraints**: POC scope - no authentication, no production security, single-user operation
**Scale/Scope**: Single user, local development, proof of concept validation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & SOLID | **PASS** | Will follow SOLID principles in all packages |
| II. Testing Standards | **WAIVED** | POC scope explicitly excludes testing per user request |
| III. User Experience Consistency | **PASS** | Using Manifest Agentic UI (shadcn registry) ensures consistent components; assistant-ui for chat |
| IV. Performance Requirements | **PARTIAL** | POC targets defined; load testing waived |
| V. Documentation & Readability | **PASS** | Public functions will be documented; README per package |

**POC Waivers Documented**:
- Testing Standards (Principle II): Waived per explicit user request for POC
- Load Testing (Principle IV): Waived for POC; basic performance targets remain
- Security Scanning (Development Workflow): Waived for POC

## Project Structure

### Documentation (this feature)

```text
specs/001-chatgpt-app-builder/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── frontend/                    # React + Vite application
│   ├── src/
│   │   ├── pages/               # Page components
│   │   │   ├── Home.tsx         # Home/prompt entry page
│   │   │   └── Editor.tsx       # Hybrid editor view
│   │   ├── components/
│   │   │   ├── ui/              # Manifest Agentic UI components (shadcn registry)
│   │   │   ├── editor/          # Visual component display (read-only)
│   │   │   └── chat/            # Chat panel (assistant-ui integration)
│   │   ├── lib/                 # Utilities, API clients
│   │   ├── hooks/               # Custom React hooks
│   │   ├── App.tsx              # Root component with router
│   │   └── main.tsx             # Vite entry point
│   ├── index.html               # Vite HTML template
│   ├── vite.config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                     # NestJS application
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.module.ts    # Main app module
│   │   │   ├── app.controller.ts # 4-endpoint API
│   │   │   └── app.service.ts   # App business logic
│   │   ├── mcp/                 # MCP server module (MCP-Nest)
│   │   │   ├── mcp.module.ts
│   │   │   └── mcp.tool.ts      # Dynamic tool handler
│   │   ├── agent/               # LangChain agent module (well-separated)
│   │   │   ├── agent.module.ts
│   │   │   ├── agent.service.ts # Main agent orchestrator
│   │   │   ├── llm/
│   │   │   │   └── index.ts     # LLM factory (variable provider)
│   │   │   └── tools/
│   │   │       ├── index.ts     # Tool registry
│   │   │       ├── layout-selector.ts
│   │   │       ├── tool-generator.ts
│   │   │       ├── theme-generator.ts
│   │   │       └── mock-data-generator.ts
│   │   ├── entities/            # TypeORM entities
│   │   │   └── app.entity.ts
│   │   └── main.ts
│   ├── package.json
│   └── tsconfig.json
│
└── shared/                      # Shared types and utilities
    ├── src/
    │   ├── types/
    │   │   ├── app.ts           # App, LayoutTemplate types
    │   │   ├── theme.ts         # ThemeVariables type
    │   │   ├── mock-data.ts     # MockData types
    │   │   └── mcp.ts           # MCP response types
    │   └── schemas/             # Zod schemas for validation
    ├── package.json
    └── tsconfig.json

# Root configuration
├── turbo.json                   # Turborepo configuration
├── package.json                 # Workspace root
└── tsconfig.base.json           # Shared TypeScript config
```

**Structure Decision**: Monorepo with 3 packages for POC simplicity:
- `frontend`: User interface and hybrid editor experience
- `backend`: API, persistence, MCP serving, and agent module
- `shared`: Types ensure consistency across packages

The agent is a NestJS module inside backend (`backend/src/agent/`) rather than a separate package. This simplifies the build process and dependency management for POC while maintaining clean separation via module boundaries.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Agent as module (not separate package) | POC simplicity - reduces build complexity and package management overhead | Separate package would add unnecessary complexity for single-team POC |
| Testing waived | POC scope - user explicitly requested no tests/security | Standard testing would delay POC validation |
