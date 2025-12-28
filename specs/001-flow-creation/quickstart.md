# Quickstart: Simplified Flow Creation

**Feature**: 001-flow-creation
**Date**: 2025-12-28

## Overview

This feature replaces the prompt-based flow creation with a simplified modal workflow. Users enter only a name and optional description, and the system auto-generates the tool name. Users are then guided through adding their first user intent and view.

## Key Changes Summary

| Component | Change Type | Description |
|-----------|-------------|-------------|
| `CreateFlowModal.tsx` | MODIFY | Replace prompt input with name/description fields |
| `PromptInput.tsx` | DELETE | Remove entirely |
| `FlowDiagram.tsx` | MODIFY | Add placeholder nodes for empty states |
| `AddUserIntentNode.tsx` | NEW | Centered "Add user intent" placeholder |
| `AddViewNode.tsx` | NEW | Guidance to add first view |
| `flow.controller.ts` | MODIFY | Simplified creation logic |
| `agent.service.ts` | MODIFY | Remove generateFlow method |
| `flow.ts` (shared) | MODIFY | Update CreateFlowRequest type |

## Implementation Order

### Phase 1: Backend Changes

1. **Update shared types** (`packages/shared/src/types/flow.ts`)
   - Change `CreateFlowRequest` from `{ prompt: string }` to `{ name: string; description?: string }`

2. **Modify flow controller** (`packages/backend/src/flow/flow.controller.ts`)
   - Remove prompt validation
   - Add name validation
   - Implement `toSnakeCase()` for tool name generation
   - Create flow without calling `agentService.generateFlow()`
   - Don't create initial view

3. **Clean up agent service** (`packages/backend/src/agent/agent.service.ts`)
   - Remove or mark as deprecated the `generateFlow()` method

### Phase 2: Frontend Modal Changes

4. **Delete PromptInput** (`packages/frontend/src/components/flow/PromptInput.tsx`)
   - Remove the file entirely

5. **Update CreateFlowModal** (`packages/frontend/src/components/flow/CreateFlowModal.tsx`)
   - Replace PromptInput with name/description form fields
   - Add `toSnakeCase()` helper for tool name preview
   - Add validation for valid tool name generation
   - Update onSubmit to pass `{ name, description }` instead of prompt

6. **Update AppDetail page** (`packages/frontend/src/pages/AppDetail.tsx`)
   - Update modal props to match new CreateFlowModal interface

### Phase 3: Flow Diagram Empty States

7. **Create AddUserIntentNode** (`packages/frontend/src/components/flow/AddUserIntentNode.tsx`)
   - Custom React Flow node with "+" icon and "Add user intent" text
   - Centered positioning
   - Click handler to open UserIntentModal

8. **Create AddViewNode** (`packages/frontend/src/components/flow/AddViewNode.tsx`)
   - Custom React Flow node with "+" icon and "Add first view" text
   - Positioned to the right of UserIntentNode
   - Click handler to open view creation modal

9. **Update FlowDiagram** (`packages/frontend/src/components/flow/FlowDiagram.tsx`)
   - Register new node types
   - Add logic to detect flow state (hasUserIntent, hasViews)
   - Conditionally render placeholder nodes based on state

10. **Update FlowDetail page** (`packages/frontend/src/pages/FlowDetail.tsx`)
    - Handle empty flow states
    - Pass appropriate callbacks to FlowDiagram for opening modals

## Utility Functions

### Snake Case Conversion (Used in both frontend and backend)

```typescript
/**
 * Converts a display name to a valid snake_case tool name.
 * - Converts to lowercase
 * - Removes special characters (keeps alphanumeric only)
 * - Replaces spaces with underscores
 * - Collapses multiple underscores
 * - Trims leading/trailing underscores
 */
function toSnakeCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Validates that a tool name is valid.
 * Must start with a letter, contain only lowercase letters, numbers, and underscores.
 */
function isValidToolName(toolName: string): boolean {
  return toolName.length > 0 && /^[a-z][a-z0-9_]*$/.test(toolName);
}
```

## Flow State Detection

```typescript
interface FlowState {
  hasUserIntent: boolean;
  hasViews: boolean;
}

function getFlowState(flow: Flow): FlowState {
  return {
    hasUserIntent: Boolean(flow.toolDescription?.trim()),
    hasViews: Boolean(flow.views?.length),
  };
}
```

## User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User clicks "Create New Flow" on App Detail page             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Modal appears with Name (required) and Description fields   │
│    - Tool name preview shows snake_case version                 │
│    - User enters "My Product Catalog"                           │
│    - Preview shows "my_product_catalog"                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. User clicks "Create Flow"                                    │
│    - Backend creates flow with empty toolDescription            │
│    - No views created                                           │
│    - Redirects to Flow Detail page                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Flow Detail shows empty canvas with centered placeholder     │
│    - "+" icon with "Add user intent" text                       │
│    - User clicks the placeholder                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. User Intent Modal opens (existing modal)                     │
│    - User fills in tool description, when to use, etc.          │
│    - Saves via PATCH /api/flows/:flowId                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Canvas now shows User Intent node + "Add first view" prompt  │
│    - User clicks "Add first view"                               │
│    - View creation modal opens                                  │
│    - After saving, flow is complete                             │
└─────────────────────────────────────────────────────────────────┘
```

## Testing Checklist (Manual - POC)

- [ ] Create flow with valid name → succeeds, redirects to flow detail
- [ ] Create flow with empty name → validation error
- [ ] Create flow with special-chars-only name → validation error
- [ ] Tool name preview updates as user types
- [ ] Flow detail shows "Add user intent" placeholder for new flow
- [ ] Clicking placeholder opens User Intent modal
- [ ] After saving user intent, "Add first view" appears
- [ ] Clicking "Add first view" opens view creation
- [ ] After adding view, normal flow diagram is shown
