# API Contracts: MCP Flow Publication

**Feature**: 004-4-mcp-flow-publication
**Date**: 2025-12-26

## Modified Endpoints

### PATCH /api/flows/:flowId

Update flow properties including active status.

**Request Body** (UpdateFlowRequest):
```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "toolName": "string (optional)",
  "toolDescription": "string (optional)",
  "isActive": "boolean (optional)"
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "appId": "uuid",
  "name": "string",
  "description": "string | null",
  "toolName": "string",
  "toolDescription": "string",
  "isActive": true,
  "views": [...],
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Errors**:
- 404: Flow not found

---

### PATCH /api/apps/:appId

Update app properties including publication status.

**Request Body** (UpdateAppRequest):
```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "themeVariables": "object (optional)",
  "status": "'draft' | 'published' (optional)"
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string | null",
  "slug": "string",
  "themeVariables": {...},
  "status": "draft | published",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Errors**:
- 404: App not found

---

## New Endpoints

### GET /servers/:slug

Landing page for published apps with ChatGPT integration instructions.

**Response** (200 OK):
- Content-Type: text/html
- Server-rendered HTML page containing:
  - App name and description
  - MCP endpoint URL
  - ChatGPT integration steps
  - List of active tools

**Errors**:
- 404: App not found or not published

---

### GET /servers/:slug/mcp (Modified)

MCP server discovery endpoint. Now properly filters by app status.

**Response** (200 OK):
```json
{
  "name": "chatgpt-app-builder",
  "version": "1.0.0",
  "description": "MCP server for {appName}",
  "tools": [
    {
      "name": "string",
      "description": "string",
      "inputSchema": {
        "type": "object",
        "properties": {
          "message": {
            "type": "string",
            "description": "User query or request"
          }
        },
        "required": ["message"]
      }
    }
  ]
}
```

**Behavior Changes**:
- Returns 404 if app status is 'draft'
- Only includes flows where `isActive: true` in tools array

**Errors**:
- 404: App not found or not published

---

### GET /servers/:slug/ui/:toolName/:layout.html (Modified)

UI component serving. Now properly filters by app status.

**Behavior Changes**:
- Returns 404 if app status is 'draft'

---

## MCP Protocol Methods

### tools/list

**Response**:
```json
{
  "tools": [
    {
      "name": "string",
      "description": "string",
      "inputSchema": {...}
    }
  ]
}
```

**Behavior**:
- Only returns flows where `isActive: true`
- Returns empty array if no active flows (not an error)

### tools/call

**Request**:
```json
{
  "name": "string",
  "arguments": {
    "message": "string"
  }
}
```

**Behavior Changes**:
- Returns error if tool's flow has `isActive: false`

**Error Response**:
```json
{
  "error": {
    "code": -32602,
    "message": "Tool not available: {toolName}"
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| 404 | 404 | Resource not found (app, flow, or draft app) |
| -32602 | 400 | MCP: Invalid params (inactive tool) |
