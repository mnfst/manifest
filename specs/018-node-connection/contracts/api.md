# API Contracts: Manual Node Connection Workflow

**Feature Branch**: `018-node-connection`
**Date**: 2025-12-29

## Existing API Endpoints (No Changes Required)

The existing API endpoints support the new workflow without modification.

### Node Endpoints

#### POST /api/flows/:flowId/nodes

Create a new node. Node is created without any connections.

**Request**:
```json
{
  "type": "Interface" | "Return" | "CallFlow",
  "name": "Node Name",
  "position": { "x": 330, "y": 80 },
  "parameters": { ... }  // optional
}
```

**Response**: `201 Created`
```json
{
  "id": "uuid",
  "type": "Interface",
  "name": "Node Name",
  "position": { "x": 330, "y": 80 },
  "parameters": { ... }
}
```

#### DELETE /api/flows/:flowId/nodes/:nodeId

Delete a node. Automatically cascades to delete all connections referencing this node.

**Response**: `204 No Content`

### Connection Endpoints

#### POST /api/flows/:flowId/connections

Create a new connection between two nodes.

**Request**:
```json
{
  "sourceNodeId": "uuid-of-source-node",
  "sourceHandle": "output",
  "targetNodeId": "uuid-of-target-node",
  "targetHandle": "input"
}
```

**Response**: `201 Created`
```json
{
  "id": "uuid",
  "sourceNodeId": "uuid-of-source-node",
  "sourceHandle": "output",
  "targetNodeId": "uuid-of-target-node",
  "targetHandle": "input"
}
```

**Error Responses**:
- `400 Bad Request`: Source or target node not found
- `400 Bad Request`: Duplicate connection
- `400 Bad Request`: Would create circular reference (NEW validation)

#### DELETE /api/flows/:flowId/connections/:connectionId

Delete a connection.

**Response**: `204 No Content`

**Error Responses**:
- `404 Not Found`: Connection not found

## Backend Enhancement (Circular Detection)

Add circular connection detection to the `addConnection` service method:

```typescript
// node.service.ts - addConnection method
// After existing validations, before creating connection:

// Check for circular reference
if (this.wouldCreateCycle(request.sourceNodeId, request.targetNodeId, connections)) {
  throw new BadRequestException('This connection would create a circular reference');
}

// Also prevent self-connections
if (request.sourceNodeId === request.targetNodeId) {
  throw new BadRequestException('Cannot connect a node to itself');
}
```

## Frontend API Client

The existing API client methods support the workflow:

```typescript
// api.ts
createConnection(flowId: string, request: CreateConnectionRequest): Promise<Connection>
deleteConnection(flowId: string, connectionId: string): Promise<void>
```

No new API client methods required.
