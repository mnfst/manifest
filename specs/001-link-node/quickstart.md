# Quickstart: Link Output Node Implementation

**Feature**: 001-link-node
**Date**: 2026-01-08

## Overview

This guide provides step-by-step instructions for implementing the Link output node, which opens external URLs using ChatGPT's `window.openai.openExternal()` API.

## Prerequisites

- Node.js 18+ and pnpm installed
- Repository cloned and on `001-link-node` branch
- Understanding of existing node patterns (ReturnNode, ApiCallNode)

## Implementation Steps

### Step 1: Add Shared Types

File: `packages/shared/src/types/node.ts`

1. Add `'Link'` to the `NodeType` union:
```typescript
export type NodeType =
  | 'StatCard'
  | 'Return'
  | 'CallFlow'
  | 'UserIntent'
  | 'ApiCall'
  | 'JavaScriptCodeTransform'
  | 'Link';
```

2. Add `LinkNodeParameters` interface:
```typescript
export interface LinkNodeParameters {
  href: string;
}
```

3. Add type guard function:
```typescript
export function isLinkNode(
  node: NodeInstance
): node is NodeInstance & { parameters: LinkNodeParameters } {
  return node.type === 'Link';
}
```

---

### Step 2: Create Link Node Definition

File: `packages/nodes/src/nodes/return/LinkNode.ts`

```typescript
import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../../types.js';
import type { JSONSchema, LinkNodeParameters } from '@chatgpt-app-builder/shared';

/**
 * Normalizes a URL by ensuring it has a protocol.
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('URL is required');
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Validates that a URL is well-formed.
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves template variables in a string.
 * Template syntax: {{nodeSlug.path}}
 */
async function resolveTemplate(
  template: string,
  getNodeValue: (nodeId: string) => Promise<unknown>
): Promise<string> {
  const templatePattern = /\{\{([^}]+)\}\}/g;
  const matches = [...template.matchAll(templatePattern)];

  if (matches.length === 0) {
    return template;
  }

  let result = template;
  for (const match of matches) {
    const fullMatch = match[0];
    const path = match[1].trim();
    const [nodeId, ...pathParts] = path.split('.');

    try {
      let value = await getNodeValue(nodeId);
      for (const part of pathParts) {
        if (value && typeof value === 'object' && part in value) {
          value = (value as Record<string, unknown>)[part];
        } else {
          value = undefined;
          break;
        }
      }
      result = result.replace(fullMatch, String(value ?? ''));
    } catch {
      result = result.replace(fullMatch, '');
    }
  }

  return result;
}

/**
 * Link Node
 *
 * Opens an external URL in the user's browser using ChatGPT's openExternal API.
 * This is a terminal node - it terminates the flow successfully.
 *
 * CONSTRAINT: Can only be placed after UI/interface category nodes.
 */
export const LinkNode: NodeTypeDefinition = {
  name: 'Link',
  displayName: 'Open Link',
  icon: 'external-link',
  group: ['flow', 'output'],
  category: 'return',
  description: "Open an external URL in the user's browser. Terminates the flow.",

  inputs: ['main'],
  outputs: [], // Terminal node - no downstream connections

  defaultParameters: {
    href: '',
  } satisfies LinkNodeParameters,

  inputSchema: {
    type: 'object',
    additionalProperties: true,
    description: 'Data available for template variable resolution in URL',
  } as JSONSchema,

  outputSchema: null, // Terminal nodes have no output schema

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { parameters, getNodeValue } = context;
    const rawHref = (parameters.href as string) || '';

    // Validate href is provided
    if (!rawHref.trim()) {
      return {
        success: false,
        error: 'URL is required for Link node',
        output: {
          type: 'link',
          href: '',
          error: 'URL is required',
        },
      };
    }

    try {
      // Resolve template variables
      const resolvedHref = await resolveTemplate(rawHref, getNodeValue);

      // Normalize URL (add https:// if missing)
      const normalizedHref = normalizeUrl(resolvedHref);

      // Validate URL format
      if (!isValidUrl(normalizedHref)) {
        return {
          success: false,
          error: `Invalid URL: ${normalizedHref}`,
          output: {
            type: 'link',
            href: normalizedHref,
            error: 'Invalid URL format',
          },
        };
      }

      // Return link action for frontend/MCP to execute
      return {
        success: true,
        output: {
          type: 'link',
          href: normalizedHref,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        error: `Link node failed: ${message}`,
        output: {
          type: 'link',
          href: rawHref,
          error: message,
        },
      };
    }
  },
};
```

---

### Step 3: Register the Node

File: `packages/nodes/src/nodes/index.ts`

Add imports and registration:
```typescript
import { LinkNode } from './return/LinkNode.js';

export const builtInNodeList: NodeTypeDefinition[] = [
  UserIntentNode,
  StatCardNode,
  ReturnNode,
  CallFlowNode,
  ApiCallNode,
  JavaScriptCodeTransform,
  LinkNode,  // ADD
];

export const builtInNodes: Record<string, NodeTypeDefinition> = {
  UserIntent: UserIntentNode,
  StatCard: StatCardNode,
  Return: ReturnNode,
  CallFlow: CallFlowNode,
  ApiCall: ApiCallNode,
  JavaScriptCodeTransform: JavaScriptCodeTransform,
  Link: LinkNode,  // ADD
};
```

---

### Step 4: Add Connection Validation

File: `packages/backend/src/node/schema/schema.service.ts`

In the `validateFlowConnections` method, add Link node constraint check after the existing validation loop:

```typescript
// Inside validateFlowConnections(), after the connection loop:

// Check Link node source constraints
for (const connection of connections) {
  const targetNode = nodeMap.get(connection.targetNodeId);
  if (!targetNode) continue;

  const targetNodeDef = this.nodeTypeMap.get(targetNode.type);
  if (targetNodeDef?.name === 'Link') {
    const sourceNode = nodeMap.get(connection.sourceNodeId);
    if (!sourceNode) continue;

    const sourceNodeDef = this.nodeTypeMap.get(sourceNode.type);
    if (sourceNodeDef?.category !== 'interface') {
      // Find existing result and update to error
      const existingResult = results.find(r => r.connectionId === connection.id);
      if (existingResult) {
        existingResult.status = 'error';
        existingResult.issues.push({
          type: 'constraint-violation',
          message: 'Link nodes can only be connected after UI nodes',
          severity: 'error',
        });
        errorsCount++;
        if (existingResult.status === 'compatible') compatibleCount--;
      }
    }
  }
}
```

---

### Step 5: Create Frontend Component

File: `packages/frontend/src/components/flow/LinkNode.tsx`

```typescript
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { NodeInstance, LinkNodeParameters } from '@chatgpt-app-builder/shared';
import { ExternalLink, Pencil, Trash2, MoreHorizontal, AlertCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export interface LinkNodeData extends Record<string, unknown> {
  node: NodeInstance;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function LinkNode({ data }: NodeProps) {
  const { node, canDelete, onEdit, onDelete } = data as LinkNodeData;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const params = node.parameters as unknown as LinkNodeParameters;
  const href = params?.href || '';
  const isEmpty = !href.trim();

  // Truncate URL for display
  const displayUrl = href.length > 35 ? href.slice(0, 35) + '...' : href;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  return (
    <div className="bg-white rounded-lg border-2 border-blue-200 hover:border-blue-400 shadow-sm hover:shadow-md transition-all w-[200px] nopan">
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!bg-blue-400 !w-3 !h-3 !border-2 !border-blue-200"
      />

      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isEmpty ? 'bg-amber-50' : 'bg-blue-100'
          }`}>
            {isEmpty ? (
              <AlertCircle className="w-6 h-6 text-amber-500" />
            ) : (
              <ExternalLink className="w-6 h-6 text-blue-600" />
            )}
          </div>

          <div className="text-center w-full">
            <h3 className="font-medium text-gray-900 text-sm">
              {node.name || 'Open Link'}
            </h3>
            {isEmpty ? (
              <p className="text-xs text-amber-600 mt-1">Not configured</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1 truncate" title={href}>
                {displayUrl}
              </p>
            )}
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700 nodrag"
              aria-label="Actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-32 bg-white border rounded-md shadow-lg z-10">
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(false);
                    onEdit();
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 nodrag"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
                {canDelete && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropdownOpen(false);
                      onDelete();
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 nodrag"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NO right handle - terminal node */}
    </div>
  );
}
```

---

### Step 6: Register Frontend Component

File: `packages/frontend/src/components/flow/FlowCanvas.tsx` (or wherever node types are mapped)

Add the LinkNode component to the nodeTypes mapping:
```typescript
import { LinkNode } from './LinkNode';

const nodeTypes = {
  // ... existing types
  Link: LinkNode,
};
```

---

### Step 7: Add Link Node to NodeEditModal

File: `packages/frontend/src/components/flow/NodeEditModal.tsx`

Add a new section for editing Link nodes with the "Use Previous Outputs" component:

```typescript
// Add import at the top
import { UsePreviousOutputs } from '../common/UsePreviousOutputs';
import { TemplateReferencesDisplay } from '../common/TemplateReferencesDisplay';

// Inside the modal content, add a case for Link nodes (similar to Return node pattern):

{/* Link Node Editor */}
{node?.type === 'Link' && (
  <div className="space-y-4">
    {/* Use Previous Outputs - allows selecting dynamic values */}
    {isEditMode && node && (
      <UsePreviousOutputs
        upstreamNodes={upstreamNodes}
        isLoading={upstreamLoading}
        error={upstreamError}
        onRefresh={refreshUpstream}
      />
    )}

    {/* URL Input */}
    <div>
      <label htmlFor="link-href" className="block text-sm font-medium text-gray-700 mb-1">
        URL
      </label>
      <input
        type="text"
        id="link-href"
        value={linkHref}
        onChange={(e) => setLinkHref(e.target.value)}
        placeholder="https://example.com or {{ nodeSlug.field }}"
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      />
      <p className="mt-1 text-xs text-gray-500">
        Enter a static URL or use template variables to reference upstream data
      </p>
    </div>

    {/* Template Reference Validation */}
    {isEditMode && (
      <TemplateReferencesDisplay
        values={[linkHref]}
        upstreamNodes={upstreamNodes}
        isConnected={upstreamNodes.length > 0}
      />
    )}
  </div>
)}
```

Add the state variable for Link node parameters:
```typescript
// Add with other state variables
const [linkHref, setLinkHref] = useState('');

// Initialize from node parameters when modal opens
useEffect(() => {
  if (node?.type === 'Link') {
    const params = node.parameters as LinkNodeParameters;
    setLinkHref(params?.href || '');
  }
}, [node]);

// Save handler should include Link node case
const handleSave = async () => {
  if (node?.type === 'Link') {
    await updateNode({
      ...node,
      parameters: { href: linkHref },
    });
  }
  // ... other node types
};
```

---

### Step 8: Build and Test

```bash
# From repository root
pnpm install
pnpm build

# Start development servers
pnpm dev

# Test manually:
# 1. Open flow editor
# 2. Add UserIntent -> StatCard -> Link flow
# 3. Configure Link node with a URL
# 4. Verify validation passes
# 5. Try connecting ApiCall -> Link (should show error)
# 6. Test "Use Previous Outputs" dropdown in Link node edit modal
# 7. Copy a reference like {{ stat_card_1.someField }} and paste into URL field
```

---

## Verification Checklist

- [x] `packages/shared/src/types/node.ts` - NodeType includes 'Link'
- [x] `packages/shared/src/types/node.ts` - LinkNodeParameters interface added
- [x] `packages/nodes/src/nodes/return/LinkNode.ts` - Node definition created
- [x] `packages/nodes/src/nodes/index.ts` - LinkNode registered
- [x] `packages/backend/src/node/schema/schema.service.ts` - Constraint validation added
- [x] `packages/frontend/src/components/flow/LinkNode.tsx` - Component created
- [x] `packages/frontend/src/components/flow/NodeEditModal.tsx` - Link node editor with UsePreviousOutputs added
- [x] Frontend node type mapping updated
- [x] Build passes without errors
- [x] Link node appears in node library
- [x] Connection from StatCard to Link allowed
- [x] Connection from ApiCall to Link rejected with error message
- [x] "Use Previous Outputs" dropdown shows upstream nodes in Link edit modal
- [x] Template references like `{{ nodeSlug.field }}` work in URL field
- [x] TemplateReferencesDisplay validates references correctly
