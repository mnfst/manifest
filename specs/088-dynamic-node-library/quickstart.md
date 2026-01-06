# Quickstart: Dynamic Node Library

**Feature**: 088-dynamic-node-library
**Date**: 2026-01-06

## Implementation Overview

This is a **minimal change** - a single line modification to recategorize the CallFlow node.

## Prerequisites

- Node.js >= 18.0.0
- pnpm installed
- Project dependencies installed (`pnpm install`)

## Implementation Steps

### Step 1: Modify CallFlowNode Category

Edit `packages/nodes/src/nodes/CallFlowNode.ts`:

```diff
export const CallFlowNode: NodeTypeDefinition = {
  name: 'CallFlow',
  displayName: 'Call Flow',
  icon: 'git-branch',
  group: ['flow', 'logic'],
-  category: 'action',
+  category: 'return',
  description: 'Invoke another flow and pass its result to connected nodes.',
  // ... rest unchanged
};
```

### Step 2: Rebuild Packages

```bash
# Rebuild the nodes package
pnpm --filter @chatgpt-app-builder/nodes build

# Rebuild backend (depends on nodes)
pnpm --filter @chatgpt-app-builder/backend build
```

### Step 3: Verify

```bash
# Start the application
.specify/scripts/bash/serve-app.sh
```

Then in the browser:
1. Open the flow editor
2. Click to open the Node Library sidedrawer
3. Verify:
   - "Actions" category shows: API Call
   - "Return Values" category shows: Return, Call Flow
   - All 5 nodes are visible (UserIntent, Interface, ApiCall, Return, CallFlow)

## Troubleshooting

### Node not appearing in library

1. **Clear build cache**: `pnpm clean && pnpm install && pnpm build`
2. **Hard refresh browser**: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
3. **Restart backend**: Kill and restart the backend server

### Type errors after change

The `category: 'return'` value is already valid per `NodeTypeCategory` type. If you see type errors:
1. Ensure you're using a string literal `'return'` not a variable
2. Check that `@chatgpt-app-builder/shared` is up to date

## Time Estimate

- Code change: 1 minute
- Build: 2-3 minutes
- Verification: 2-3 minutes
- **Total: ~5-10 minutes**
