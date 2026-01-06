# API Contracts: Trigger Node Refactor

**Feature**: 001-trigger-node-refactor
**Date**: 2026-01-06

## Overview

This document describes API changes for the trigger node refactor. Most endpoints remain unchanged as nodes are already managed through existing node CRUD endpoints. The primary changes are:

1. New node type `UserIntent` accepted in node creation
2. Flow entity no longer returns `whenToUse` and `whenNotToUse`
3. Node type metadata endpoint to expose categories

## Existing Endpoints (Behavior Changes)

### POST /api/flows/:flowId/nodes

Create a new node in a flow.

**Request Body Changes**:

```json
{
  "type": "UserIntent",  // NEW: Added to accepted types
  "name": "User Intent",
  "position": { "x": 50, "y": 200 },
  "parameters": {
    "whenToUse": "When user wants to search for products",
    "whenNotToUse": "When user is browsing categories"
  }
}
```

**Accepted Node Types**:
- `Interface` (existing)
- `Return` (existing)
- `CallFlow` (existing)
- `UserIntent` (NEW)

**Response**: Same as existing (201 Created with node object)

**Validation**:
- `parameters.whenToUse`: Optional, max 500 characters
- `parameters.whenNotToUse`: Optional, max 500 characters

### GET /api/flows/:flowId

Get flow details including nodes.

**Response Changes**:

```json
{
  "id": "uuid",
  "appId": "uuid",
  "name": "Search Products",
  "toolName": "search_products",
  "toolDescription": "Search for products in the catalog",
  // REMOVED: "whenToUse": "..."
  // REMOVED: "whenNotToUse": "..."
  "isActive": true,
  "nodes": [
    {
      "id": "uuid",
      "type": "UserIntent",
      "name": "User Intent",
      "position": { "x": 50, "y": 200 },
      "parameters": {
        "whenToUse": "When user wants to search for products",
        "whenNotToUse": "When user is browsing categories"
      }
    },
    // ... other nodes
  ],
  "connections": []
}
```

### PATCH /api/flows/:flowId

Update flow properties.

**Request Body Changes**:

```json
{
  "name": "Updated Name",
  "toolDescription": "Updated description"
  // REMOVED: Cannot update "whenToUse" or "whenNotToUse" at flow level
}
```

### PATCH /api/flows/:flowId/nodes/:nodeId

Update a node (including UserIntentNode).

**Request Body for UserIntent**:

```json
{
  "name": "Custom Intent Name",
  "parameters": {
    "whenToUse": "Updated conditions",
    "whenNotToUse": "Updated exclusions"
  }
}
```

### POST /api/flows/:flowId/connections

Create a connection between nodes.

**Validation Changes**:
- Server-side validation: Target node cannot be of type `UserIntent` (trigger nodes don't accept inputs)
- Returns 400 Bad Request if attempting to target a trigger node

**Error Response (New)**:

```json
{
  "statusCode": 400,
  "message": "Cannot create connection to trigger node. Trigger nodes do not accept incoming connections.",
  "error": "Bad Request"
}
```

## New Endpoints

### GET /api/node-types

Get available node types with metadata including categories.

**Response**:

```json
{
  "nodeTypes": [
    {
      "name": "UserIntent",
      "displayName": "User Intent",
      "description": "Defines when the AI should trigger this flow based on user intent",
      "icon": "zap",
      "category": "trigger",
      "inputs": [],
      "outputs": ["main"]
    },
    {
      "name": "Interface",
      "displayName": "Agentic Interface",
      "description": "Display a UI interface with data in a layout template. Supports user actions.",
      "icon": "layout-template",
      "category": "interface",
      "inputs": ["main"],
      "outputs": ["action:submit", "action:click", "action:select"]
    },
    {
      "name": "CallFlow",
      "displayName": "Call Flow",
      "description": "Invoke another flow and pass its result to connected nodes.",
      "icon": "git-branch",
      "category": "action",
      "inputs": ["main"],
      "outputs": ["main"]
    },
    {
      "name": "Return",
      "displayName": "Return Value",
      "description": "Return a text value as the flow output. Terminates the current flow execution.",
      "icon": "corner-down-left",
      "category": "return",
      "inputs": ["main"],
      "outputs": []
    }
  ],
  "categories": [
    { "id": "trigger", "displayName": "Triggers", "order": 1 },
    { "id": "interface", "displayName": "Agentic Interfaces", "order": 2 },
    { "id": "action", "displayName": "Actions", "order": 3 },
    { "id": "return", "displayName": "Return Values", "order": 4 }
  ]
}
```

## TypeScript Types

### NodeTypeCategory

```typescript
type NodeTypeCategory = 'trigger' | 'interface' | 'action' | 'return';
```

### NodeType (Updated)

```typescript
type NodeType = 'Interface' | 'Return' | 'CallFlow' | 'UserIntent';
```

### UserIntentNodeParameters

```typescript
interface UserIntentNodeParameters {
  whenToUse?: string;      // Max 500 chars
  whenNotToUse?: string;   // Max 500 chars
}
```

### Flow (Updated)

```typescript
interface Flow {
  id: string;
  appId: string;
  name: string;
  description?: string;
  toolName: string;
  toolDescription: string;
  // REMOVED: whenToUse?: string;
  // REMOVED: whenNotToUse?: string;
  isActive: boolean;
  parameters?: FlowParameter[];
  nodes: NodeInstance[];
  connections: Connection[];
  createdAt: string;
  updatedAt: string;
}
```

### NodeTypeInfo (New - for GET /api/node-types)

```typescript
interface NodeTypeInfo {
  name: NodeType;
  displayName: string;
  description: string;
  icon: string;
  category: NodeTypeCategory;
  inputs: string[];
  outputs: string[];
}

interface CategoryInfo {
  id: NodeTypeCategory;
  displayName: string;
  order: number;
}

interface NodeTypesResponse {
  nodeTypes: NodeTypeInfo[];
  categories: CategoryInfo[];
}
```

## Migration Endpoint (Optional)

### POST /api/admin/migrate-user-intents

Trigger migration of flow-level user intent data to UserIntentNodes.

**Authorization**: Admin only (if auth exists) or open for POC

**Response**:

```json
{
  "migratedFlows": 5,
  "createdNodes": 5,
  "errors": []
}
```

**Note**: This can also be run as a database script instead of an endpoint.
