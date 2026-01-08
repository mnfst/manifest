# Quickstart: UI Node Edit Modal Consolidation

**Feature Branch**: `001-ui-edit-modal-merge`
**Date**: 2026-01-08

## Overview

This feature consolidates the UI node editing experience by:
1. Merging the separate "Edit" modal into the "Edit Code" interface (renamed to "Edit")
2. Removing the deprecated `layoutTemplate` field
3. Adding an "Appearance" tab for visual configuration
4. Preventing auto-open of editor when adding new UI nodes

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm 9.x
- Running backend and frontend dev servers

### Development Setup

```bash
# From repo root
cd /home/bruno-perez/Codebases/generator-worktrees/edit-ui

# Install dependencies (if needed)
pnpm install

# Start both services
pnpm dev
```

Backend runs on port 3847, frontend auto-selects available port (usually 5176).

## Key Files to Modify

### Shared Package (packages/shared)

1. **Create appearance types** - `src/types/appearance.ts`
   - Define `AppearanceOptionSchema` interface
   - Define `ComponentAppearanceSchema` interface
   - Create `COMPONENT_APPEARANCE_REGISTRY` constant

2. **Update node types** - `src/types/node.ts`
   - Rename `StatCardNodeParameters` to `UINodeParameters`
   - Remove `layoutTemplate` field
   - Add `appearanceConfig` field

3. **Update exports** - `src/index.ts`
   - Export new appearance types

### Frontend (packages/frontend)

1. **InterfaceEditor** - `src/components/editor/InterfaceEditor.tsx`
   - Add tab navigation (General, Appearance, Code, Preview)
   - Create GeneralTab component (name, schema)
   - Create AppearanceTab component (dynamic form from schema)
   - Preserve unsaved changes across tabs

2. **ViewNodeDropdown** - `src/components/flow/ViewNodeDropdown.tsx`
   - Rename "Edit Code" to "Edit"

3. **NodeEditModal** - `src/components/flow/NodeEditModal.tsx`
   - Remove StatCard-specific handling
   - Remove layoutTemplate dropdown

4. **FlowDetail** - `src/pages/FlowDetail.tsx`
   - Remove `setEditingCodeNodeId(newNode.id)` after StatCard creation
   - Let user manually trigger edit

### Backend (packages/backend)

1. **Node DTOs** - `src/node/dto/` (if layoutTemplate is explicitly typed)
   - Remove layoutTemplate from request/response DTOs

2. **Node Service** - `src/node/node.service.ts`
   - No changes needed (uses generic parameters)

## Component Architecture

### InterfaceEditor Tab Structure

```tsx
<Tabs defaultValue="general">
  <TabsList>
    <TabsTrigger value="general">General</TabsTrigger>
    <TabsTrigger value="appearance">Appearance</TabsTrigger>
    <TabsTrigger value="code">Code</TabsTrigger>
    <TabsTrigger value="preview">Preview</TabsTrigger>
  </TabsList>

  <TabsContent value="general">
    <GeneralTab name={name} onNameChange={setName} />
  </TabsContent>

  <TabsContent value="appearance">
    <AppearanceTab
      componentType={componentType}
      config={appearanceConfig}
      onChange={setAppearanceConfig}
    />
  </TabsContent>

  <TabsContent value="code">
    <CodeEditor code={code} onChange={setCode} />
  </TabsContent>

  <TabsContent value="preview">
    <ComponentPreview
      code={code}
      appearanceConfig={appearanceConfig}
    />
  </TabsContent>
</Tabs>
```

### AppearanceTab Form Generation

```tsx
function AppearanceTab({ componentType, config, onChange }) {
  const schema = COMPONENT_APPEARANCE_REGISTRY[componentType];

  if (!schema?.options.length) {
    return <EmptyState message="No appearance options available" />;
  }

  return (
    <form>
      {schema.options.map(option => (
        <FormField key={option.key} option={option} />
      ))}
    </form>
  );
}

function FormField({ option, value, onChange }) {
  switch (option.type) {
    case 'enum':
      return <Select options={option.enumValues} ... />;
    case 'boolean':
      return <Switch checked={value} ... />;
    case 'string':
      return <Input type="text" ... />;
    case 'number':
      return <Input type="number" ... />;
  }
}
```

## Testing Scenarios

### Manual Testing Checklist

1. **Add UI Node**
   - [ ] Click + to add StatCard node
   - [ ] Verify node appears on canvas
   - [ ] Verify NO editor/modal opens automatically

2. **Edit UI Node**
   - [ ] Right-click node → "Edit"
   - [ ] Verify unified editor opens with 4 tabs
   - [ ] Verify General tab shows name input
   - [ ] Verify Appearance tab shows form (or empty message for Stats)
   - [ ] Verify Code tab shows code editor
   - [ ] Verify Preview tab shows live preview

3. **Appearance Configuration**
   - [ ] Change dropdown value (e.g., variant)
   - [ ] Toggle boolean switch
   - [ ] Verify preview updates
   - [ ] Save and reopen - verify values persisted

4. **Backward Compatibility**
   - [ ] Load flow with existing StatCard node (has layoutTemplate)
   - [ ] Verify node displays correctly
   - [ ] Edit and save - verify works without errors

## Data Flow

```
User Action → InterfaceEditor State → Save Handler → Node Service → Flow Entity
                                                         ↓
                                    parameters: { appearanceConfig, customCode }
```

## Migration Notes

- No database migration required
- No API breaking changes (layoutTemplate silently ignored)
- Frontend changes are additive - new tabs, preserved existing functionality
