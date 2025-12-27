# Quickstart: MCP Flow Publication

**Feature**: 004-4-mcp-flow-publication
**Date**: 2025-12-26

## Test Scenarios

### Scenario 1: Toggle Flow Active Status

**Goal**: User can toggle a flow's active status and see it reflected in MCP server.

**Steps**:

1. Navigate to an app with at least one flow
2. Go to the flow detail page
3. Locate the "Active" toggle switch
4. Toggle it OFF
5. Verify the toggle shows inactive state
6. Query the MCP endpoint: `GET /servers/{slug}/mcp`
7. Verify the inactive flow is NOT in the tools array
8. Toggle it back ON
9. Verify the flow reappears in the MCP tools array

**Expected Results**:
- Toggle reflects current state immediately
- MCP endpoint only shows active flows
- No page refresh required

---

### Scenario 2: Publish/Unpublish App

**Goal**: User can publish an app to make MCP server accessible.

**Steps**:

1. Navigate to an app in draft status
2. Click the "Publish" button
3. Verify the button changes to "Unpublish"
4. Navigate to `GET /servers/{slug}/mcp`
5. Verify the MCP endpoint returns server info
6. Navigate to `GET /servers/{slug}`
7. Verify the landing page displays
8. Click "Unpublish"
9. Verify both endpoints now return 404

**Expected Results**:
- Published apps have accessible MCP endpoints
- Draft apps return 404 for all MCP endpoints
- Status change is immediate

---

### Scenario 3: Landing Page Display

**Goal**: Published apps have a landing page with ChatGPT instructions.

**Steps**:

1. Publish an app with at least one active flow
2. Navigate to `/servers/{slug}`
3. Verify the page shows:
   - App name
   - App description
   - MCP endpoint URL (copyable)
   - "Add to ChatGPT" instructions
   - List of available tools

**Expected Results**:
- Landing page loads quickly
- URL is correctly formed based on current host
- Instructions match official OpenAI quickstart
- Only active tools are listed

---

### Scenario 4: MCP Protocol Compliance

**Goal**: MCP server correctly implements protocol methods.

**Steps**:

1. Publish an app with 3 flows (2 active, 1 inactive)
2. Send `tools/list` request to MCP endpoint
3. Verify response contains only 2 tools
4. Send `tools/call` for an active tool
5. Verify successful response
6. Send `tools/call` for the inactive tool
7. Verify error response

**Expected Results**:
- `tools/list` returns only active flows
- `tools/call` works for active flows
- `tools/call` returns error for inactive flows

---

### Scenario 5: End-to-End Flow

**Goal**: Complete user journey from app creation to ChatGPT integration.

**Steps**:

1. Create a new app
2. Create a flow with a view
3. Toggle flow active status (verify it works)
4. Publish the app
5. Visit the landing page
6. Copy the MCP endpoint URL
7. Verify the instructions are clear
8. Unpublish the app
9. Verify landing page returns 404

**Expected Results**:
- Smooth flow from creation to publication
- Clear instructions for ChatGPT integration
- Immediate effect when unpublishing

---

## API Test Commands

### Check MCP Endpoint (Published App)
```bash
curl http://localhost:3001/servers/{slug}/mcp
# Should return server info with tools
```

### Check MCP Endpoint (Draft App)
```bash
curl http://localhost:3001/servers/{slug}/mcp
# Should return 404
```

### Toggle Flow Active Status
```bash
curl -X PATCH http://localhost:3001/api/flows/{flowId} \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

### Publish App
```bash
curl -X PATCH http://localhost:3001/api/apps/{appId} \
  -H "Content-Type: application/json" \
  -d '{"status": "published"}'
```

### Check Landing Page
```bash
curl http://localhost:3001/servers/{slug}
# Should return HTML landing page
```
