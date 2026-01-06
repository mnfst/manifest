# Quickstart: API Call Action Node

**Feature**: 018-api-call-action
**Date**: 2026-01-06

## Overview

This guide helps developers get started with implementing the API Call action node.

---

## Prerequisites

- Node.js 18+ (for native fetch support)
- pnpm 9.15+ (workspace manager)
- Existing codebase checked out and dependencies installed

```bash
pnpm install
```

---

## Implementation Checklist

### Phase 1: Shared Types (packages/shared)

1. **Update NodeType union** in `packages/shared/src/types/node.ts`:
   ```typescript
   export type NodeType = 'Interface' | 'Return' | 'CallFlow' | 'ApiCall';
   ```

2. **Add ApiCallNodeParameters interface**:
   ```typescript
   export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

   export interface HeaderEntry {
     key: string;
     value: string;
   }

   export interface ApiCallNodeParameters {
     method: HttpMethod;
     url: string;
     headers: HeaderEntry[];
     timeout: number;
   }
   ```

3. **Add type guard**:
   ```typescript
   export function isApiCallNode(
     node: NodeInstance
   ): node is NodeInstance & { parameters: ApiCallNodeParameters } {
     return node.type === 'ApiCall';
   }
   ```

### Phase 2: Node Definition (packages/nodes)

1. **Create ApiCallNode.ts** in `packages/nodes/src/nodes/`:
   ```typescript
   import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../types.js';

   export const ApiCallNode: NodeTypeDefinition = {
     name: 'ApiCall',
     displayName: 'API Call',
     icon: 'globe',
     group: ['action', 'integration'],
     description: 'Make HTTP requests to external APIs',
     inputs: ['main'],
     outputs: ['main'],
     defaultParameters: {
       method: 'GET',
       url: '',
       headers: [],
       timeout: 30000,
     },
     async execute(context: ExecutionContext): Promise<ExecutionResult> {
       // Implementation here
     },
   };
   ```

2. **Export from index.ts**:
   ```typescript
   export { ApiCallNode } from './ApiCallNode.js';
   // Add to builtInNodes and builtInNodeList
   ```

### Phase 3: Frontend Components (packages/frontend)

1. **Update AddStepModal.tsx**:
   - Add 'ApiCall' to type union
   - Add option to stepOptions array with orange theme

2. **Update NodeEditModal.tsx**:
   - Add ApiCall case for form fields
   - Implement URL input, method dropdown, headers editor

3. **Create ApiCallNode.tsx** component:
   - Follow ViewNode.tsx pattern
   - One input handle (left), one output handle (right)
   - Orange color theme

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `packages/shared/src/types/node.ts` | Type definitions |
| `packages/nodes/src/nodes/ApiCallNode.ts` | Node execution logic |
| `packages/nodes/src/nodes/index.ts` | Node registry |
| `packages/frontend/src/components/flow/AddStepModal.tsx` | Node picker |
| `packages/frontend/src/components/flow/NodeEditModal.tsx` | Configuration form |
| `packages/frontend/src/components/flow/ApiCallNode.tsx` | Visual component |

---

## Testing (Manual - POC Phase)

1. Start the development server:
   ```bash
   pnpm dev
   ```

2. Create a new flow or open an existing one

3. Click the "+" button to add a node

4. Verify "API Call" appears in the modal

5. Select "API Call" and configure:
   - Name: "Test API Call"
   - Method: GET
   - URL: https://jsonplaceholder.typicode.com/posts/1

6. Connect the node and execute the flow

7. Verify the output contains the API response

---

## Common Issues

### "fetch is not defined"
- Ensure Node.js version is 18 or higher
- Check with `node --version`

### "Type 'ApiCall' is not assignable..."
- Rebuild shared package: `pnpm --filter @chatgpt-app-builder/shared build`
- Restart TypeScript server in IDE

### Node not appearing in modal
- Check AddStepModal.tsx includes 'ApiCall' in both type union and stepOptions
- Verify the type string matches exactly

---

## Next Steps

After implementation:
1. Run `/speckit.tasks` to generate detailed implementation tasks
2. Follow tasks in dependency order
3. Test manually per constitution (POC phase)
