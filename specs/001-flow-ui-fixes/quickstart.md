# Quickstart: Testing Flow UI Fixes

**Feature**: 001-flow-ui-fixes
**Date**: 2026-01-08

## Prerequisites

1. Start the development servers:
   ```bash
   pnpm dev
   ```
   Or use the serve script:
   ```bash
   .specify/scripts/bash/serve-app.sh
   ```

2. Open the application in a browser (typically http://localhost:5176)

## Test Scenarios

### Test #1: Preview Without UI Nodes

**Steps**:
1. Create a new app or use an existing one
2. Create a new flow
3. Add only a UserIntent node and a Return node (no StatCard or PostList)
4. Connect the nodes
5. Click the "Preview" tab

**Expected Result**: Preview tab should be enabled and clickable. You should see the chat interface.

**Before Fix**: Preview tab is disabled/grayed out when no StatCard or PostList nodes exist.

---

### Test #2: Transformer Node Visual Update

**Steps**:
1. Open a flow with at least two connected nodes (e.g., UserIntent → Return)
2. Click on the connection line between the nodes
3. In the compatibility modal, click "Add a Transformer"
4. Select a transformer type (e.g., JavaScriptCodeTransform)
5. Observe the canvas

**Expected Result**: Transformer node should appear immediately on the canvas between the two nodes, with connections visible to both upstream and downstream nodes.

**Before Fix**: Canvas doesn't update; page reload required to see the transformer.

---

### Test #3: Share Modal URLs

**Steps**:
1. Create and publish an app (or use an already published app)
2. Click the "Share" button to open the share modal
3. Examine the Landing Page URL and MCP Endpoint URL

**Expected Result**: Both URLs should be complete absolute URLs starting with the domain (e.g., `https://yourdomain.com/servers/...` or `http://localhost:3847/servers/...` in dev).

**Before Fix**: URLs might show only relative paths like `/servers/my-app` without the domain.

**Additional Test**: Copy the URL and paste it in a new browser tab - it should load correctly.

---

### Test #4: PostList Node Creation

**Steps**:
1. Open a flow
2. Open the Node Library panel
3. Click on "Post List" in the Interface category
4. Observe the canvas

**Expected Result**: A PostList node should appear on the canvas. The code editor should open for the new node.

**Before Fix**: Nothing happens when clicking Post List.

---

### Test #5: API Key Settings Link

**Steps**:
1. Remove your OpenAI API key (if set): Go to Settings > API Keys and clear the key
2. Navigate to a flow
3. Click the "Preview" tab
4. Observe the "API Key Required" message

**Expected Result**: The message should include a clickable link to the Settings page. Clicking the link should navigate to Settings.

**Before Fix**: Message only mentions "Settings > API Keys" as plain text without a link.

---

## Verification Checklist

| Test | Status | Notes |
|------|--------|-------|
| #1 Preview without UI nodes | ☐ | |
| #2 Transformer visual update | ☐ | |
| #3 Share modal URLs | ☐ | |
| #4 PostList node creation | ☐ | |
| #5 API key settings link | ☐ | |

## Troubleshooting

### Common Issues

1. **Preview tab still disabled**: Check browser console for errors; ensure flow has at least one node.

2. **Transformer not appearing**: Check network tab for API response; verify the insertTransformer API returns successfully.

3. **URLs still relative**: Check `VITE_API_URL` environment variable; in production it should be empty string, in dev it should be undefined or explicit URL.

4. **PostList creation fails**: Check browser console for error messages; verify API endpoint is responding.

5. **Settings link not working**: Ensure React Router is set up correctly; verify the `/settings` route exists.
