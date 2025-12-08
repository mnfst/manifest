<!--
Sync Impact Report
==================
Version change: 0.0.0 → 1.0.0
Added sections: All (initial constitution)
Modified principles: N/A (initial version)
Removed sections: N/A
Templates requiring updates: ⚠ pending review after initial setup
Follow-up TODOs: None
-->

# Agentic UI Toolkit Constitution

## Core Principles

### I. Conversational-First Design

All components MUST be designed for embedding within conversational interfaces (ChatGPT, Claude, etc.). Components run in sandboxed iframes with limited capabilities. Every design decision prioritizes the chat context over traditional web UI patterns.

**Non-negotiables:**

- Components MUST support inline display (300-500px width)
- Components MUST avoid scroll when possible, staying compact
- Components MUST be mobile-first and touch-friendly
- Components MUST NOT use modals (use inline expansions or fullscreen mode instead)
- Components MUST NOT use native dropdowns (use radio cards or lists instead)

### II. Theme Adaptability

Components MUST seamlessly adapt to host application themes. The conversational interface provides theme context, and components must respect it without custom overrides.

**Non-negotiables:**

- Components MUST support both `light` and `dark` themes
- Components MUST use CSS variables for theming
- Selection states MUST use `border-foreground ring-1 ring-foreground` (not grey backgrounds which appear disabled)
- Components MUST NOT cause layout jumps (use `ring-1` instead of `border-2`)
- All text MUST be in English

### III. Lightweight & Performant

Components are delivered via the shadcn registry and rendered in iframes. Bundle size directly impacts user experience in chat interfaces where multiple components may load simultaneously.

**Non-negotiables:**

- Components MUST minimize JS/CSS bundle size
- Components MUST NOT include heavy animations
- Components MUST provide immediate visual feedback (loading, success, error states)
- Components MUST be self-contained with explicit dependencies declared in `registry.json`

### IV. Host Integration Protocol

Components communicate with the host (ChatGPT, Claude) through a defined API. Direct DOM manipulation or custom navigation patterns break the conversational flow.

**Available host interactions:**

**MCP Apps (SEP-1865) - Host Interactions:** Guest UI → Host (what the app can do):

- `tools/call`: Call an MCP tool (e.g., validate a payment, fetch data)
- `ui/message`: Send a message in the conversation
- `ui/open-link`: Open an external link in the host's browser
- `resources/read`: Read an MCP resource
- `ui/initialize`: Initialize the Guest ↔ Host connection
- `ui/notifications/size-change`: Notify the Host of a size change
- `notifications/message`: Send a notification/log to the Host

**Available notifications:** Host → Guest UI (what the app receives)

- `ui/notifications/tool-input`: Receive the Tool request parameters
- `ui/notifications/tool-input-partial`: Receive streamed Tool parameters (for large inputs)
- `ui/notifications/tool-result`: Receive the Tool response (includes \_meta field)
- `ui/tool-cancelled`: Notified when tool execution was cancelled
- `ui/resource-teardown`: Warned that the iframe will be immediately destroyed
- `ui/size-change`: Notified of theme, display mode, orientation or window changes
- `ui/host-context-change`: Notified of host context changes (dark/light theme, etc.)

**Non-negotiables:**

- Components MUST use host interactions rather than custom behaviors
- Network requests MUST go through the MCP server

### V. Registry-First Distribution

The shadcn registry is the single source of truth for component distribution. Components are installed via `shadcn add <name>` and must follow registry conventions.

**Non-negotiables:**

- Every component MUST be declared in `registry.json`
- Component files MUST reside in `registry/` directories
- Dependencies MUST be explicitly listed (npm + registryDependencies)
- Components MUST be independently installable

## Website Structure

### Homepage

The homepage demonstrates components in realistic conversational contexts. It features:

- Tabs to switch between different use case scenarios (product selection, payment workflow, booking, etc.)
- A ChatGPT-clone section showing interactive or static use case for each tab.
- A Claude-clone section showing interactive or static use case for each tab.

### Blocks Page

The Blocks page provides a component catalog with:

- Sidebar navigation organized by categories (Payment, Products, Selection, Status & Progress, Lists & Tables, Miscellaneous)
- Individual component preview with isolated rendering and install documentation
- Category expansion/collapse for easy navigation

## Development Workflow

### Adding New Components

1. Create component files in appropriate `registry/` subdirectory
2. Add entry to `registry.json` with proper metadata
3. Run `pnpm registry:build` to generate distributable JSON
4. Add component to Blocks page categories
5. Create use case demo for Homepage if applicable

### Component States

Every component SHOULD support these states where applicable:

- Loading: Skeleton or spinner feedback
- Empty: Clear empty state messaging
- Error: Error state with recovery options
- Success: Confirmation feedback

### Display Mode Variants

Components SHOULD provide variants when relevant:

- `inline`: Default compact mode for chat flow
- `fullscreen`: Full viewport for complex interactions. It take the full chat section. Not the sidebar, neither the bottom of the page that shows the prompt field.

## Governance

This constitution governs all development decisions for the Agentic UI Toolkit. Amendments require:

1. Clear documentation of the proposed change
2. Impact assessment on existing components
3. Migration plan for breaking changes
4. Version increment following semantic versioning:
   - MAJOR: Breaking changes to component APIs or principles
   - MINOR: New components or expanded capabilities
   - PATCH: Bug fixes, documentation updates

All pull requests MUST verify compliance with these principles. Complexity beyond the minimum required MUST be justified.

**Version**: 1.0.0 | **Ratified**: 2025-12-05 | **Last Amended**: 2025-12-05
