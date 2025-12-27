# Quickstart: App & Flow Management

**Feature**: 005-app-flow-management
**Date**: 2025-12-26

## Prerequisites

- Node.js 18+
- npm 10+
- Running backend and frontend from the generator monorepo

## Development Setup

```bash
# From repository root
npm install
npm run dev
```

This starts both backend (port 3000) and frontend (port 5173).

## Implementation Order

### Phase 1: Backend Changes

1. **Add flowCount to App list response**
   - File: `packages/backend/src/app/app.service.ts`
   - Modify `findAll()` to include relation count

2. **Add delete endpoint for apps**
   - File: `packages/backend/src/app/app.controller.ts`
   - Add `DELETE /api/apps/:appId` endpoint
   - File: `packages/backend/src/app/app.service.ts`
   - Add `delete(id)` method

3. **Add flow deletion check endpoint**
   - File: `packages/backend/src/flow/flow.controller.ts`
   - Add `GET /api/flows/:flowId/deletion-check`
   - File: `packages/backend/src/flow/flow.service.ts`
   - Add `checkDeletion(id)` method

### Phase 2: Shared Types

4. **Add new interfaces**
   - File: `packages/shared/src/types/app.ts`
   - Add `AppWithFlowCount`, `DeleteAppResponse`
   - File: `packages/shared/src/types/flow.ts`
   - Add `FlowDeletionCheck`, `DeleteFlowResponse`

### Phase 3: Frontend - Shared Components

5. **Create DeleteConfirmDialog**
   - File: `packages/frontend/src/components/common/DeleteConfirmDialog.tsx`
   - Reusable confirmation modal with customizable message

6. **Create EditAppModal**
   - File: `packages/frontend/src/components/app/EditAppModal.tsx`
   - Based on CreateAppModal pattern

7. **Create EditFlowForm**
   - File: `packages/frontend/src/components/flow/EditFlowForm.tsx`
   - Inline form for flow detail page

### Phase 4: Frontend - Page Integration

8. **Update AppCard**
   - File: `packages/frontend/src/components/app/AppCard.tsx`
   - Add flow count display
   - Add edit/delete action buttons

9. **Update Home page**
   - File: `packages/frontend/src/pages/Home.tsx`
   - Add edit/delete handlers
   - Integrate EditAppModal
   - Integrate DeleteConfirmDialog

10. **Update AppDetail page**
    - File: `packages/frontend/src/pages/AppDetail.tsx`
    - Disable publish button when flowCount=0
    - Show tooltip explaining requirement

11. **Update FlowDetail page**
    - File: `packages/frontend/src/pages/FlowDetail.tsx`
    - Add EditFlowForm
    - Add delete button with last-flow warning

## Testing Checklist

### App Edit
- [ ] Edit button visible on app cards
- [ ] Modal opens with pre-filled data
- [ ] Save updates app name/description
- [ ] Cancel closes without changes
- [ ] Validation prevents empty name

### App Delete
- [ ] Delete button visible on app cards
- [ ] Confirmation shows cascade warning
- [ ] Confirm deletes app and all flows
- [ ] Cancel closes without deleting
- [ ] Published apps become unavailable after delete

### Flow Edit
- [ ] Edit form visible on flow detail page
- [ ] Fields pre-filled with current values
- [ ] Save updates all editable fields
- [ ] Cancel reverts unsaved changes
- [ ] Validation prevents empty required fields

### Flow Delete
- [ ] Delete button visible on flow detail page
- [ ] Confirmation dialog appears
- [ ] Last flow warning shown for published apps
- [ ] Confirm deletes flow and views
- [ ] Redirects to app detail after delete

### Flow Count
- [ ] Count visible on all app cards
- [ ] Singular "flow" for count=1
- [ ] Plural "flows" for count!=1
- [ ] Count updates after creating/deleting flows

### Publish Guard
- [ ] Publish button disabled when flowCount=0
- [ ] Tooltip explains requirement
- [ ] Button enabled when flowCount>0

## API Examples

### Update App
```bash
curl -X PATCH http://localhost:3000/api/apps/{appId} \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name", "description": "New description"}'
```

### Delete App
```bash
curl -X DELETE http://localhost:3000/api/apps/{appId}
```

### Update Flow
```bash
curl -X PATCH http://localhost:3000/api/flows/{flowId} \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Flow", "toolName": "new_tool_name"}'
```

### Check Flow Deletion
```bash
curl http://localhost:3000/api/flows/{flowId}/deletion-check
```

### Delete Flow
```bash
curl -X DELETE http://localhost:3000/api/flows/{flowId}
```

## Common Issues

### "Cannot read properties of undefined (reading 'flowCount')"
- Ensure backend returns flowCount in list response
- Check that AppWithFlowCount type is used correctly

### "Publish button not disabling"
- Verify flowCount is passed to PublishButton component
- Check conditional rendering logic

### "Delete not working"
- Confirm DELETE endpoint is registered in controller
- Check CORS settings if frontend/backend on different ports

### "Last flow warning not showing"
- Verify deletion-check endpoint is called before showing dialog
- Check that FlowDeletionCheck response is parsed correctly
