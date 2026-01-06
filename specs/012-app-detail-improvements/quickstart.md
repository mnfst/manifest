# Quickstart: App Detail Page Improvements

**Feature**: 012-app-detail-improvements
**Date**: 2025-12-28

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 9.0.0
- Running backend and frontend dev servers

## Implementation Order

### Phase 1: UI Simplification (No Backend Changes)

1. **Remove flow card icons** (FlowCard.tsx)
   - Delete the icon div (`w-12 h-12 rounded-lg bg-gradient-to-br...`)
   - Adjust layout spacing

2. **Single-column flow layout** (FlowList.tsx)
   - Change grid from `grid-cols-2` to `grid-cols-1`

3. **Share modal** (New: ShareModal.tsx, modify AppDetail.tsx)
   - Create modal component with share URLs
   - Add share icon button in header
   - Move URL display logic from inline to modal

### Phase 2: App Icons (Backend + Frontend)

4. **Create default icons** (public/icons/)
   - Create 8 pixel art PNG files (128x128)
   - Store in `packages/frontend/public/icons/`

5. **Backend: Random icon on create** (app.service.ts)
   - Add `DEFAULT_ICONS` constant
   - Modify `create()` to assign random icon to `logoUrl`

6. **Backend: Icon upload endpoint** (app.controller.ts, app.service.ts)
   - Add `POST /api/apps/:id/icon` endpoint
   - Configure multer for file uploads
   - Validate file type and dimensions
   - Serve uploaded files from `/uploads/icons/`

7. **Frontend: Display app icon** (AppDetail.tsx)
   - Add icon display in header area
   - Show 128x128 icon from `logoUrl`

8. **Frontend: Icon upload component** (New: AppIconUpload.tsx)
   - Hover overlay with upload prompt
   - Client-side dimension validation
   - Upload to backend endpoint
   - Update display on success

## Quick Commands

```bash
# Start development servers
cd packages/backend && pnpm dev
cd packages/frontend && pnpm dev

# Check for TypeScript errors
pnpm type-check

# Lint code
pnpm lint
```

## Key Files to Modify

| File | Changes |
|------|---------|
| `packages/frontend/src/components/flow/FlowCard.tsx` | Remove icon section |
| `packages/frontend/src/components/flow/FlowList.tsx` | Single column layout |
| `packages/frontend/src/pages/AppDetail.tsx` | Add share modal, app icon display |
| `packages/frontend/src/components/app/ShareModal.tsx` | New component |
| `packages/frontend/src/components/app/AppIconUpload.tsx` | New component |
| `packages/backend/src/app/app.service.ts` | Random icon on create |
| `packages/backend/src/app/app.controller.ts` | Icon upload endpoint |
| `packages/shared/src/types/app.ts` | Add IconUploadResponse type |

## Testing Checklist

- [ ] Create new app → Random icon assigned
- [ ] View app detail → Icon displayed (128x128)
- [ ] Hover over icon → Upload overlay appears
- [ ] Upload valid icon → Updates display
- [ ] Upload invalid icon → Shows error message
- [ ] Click share icon (published app) → Modal opens with URLs
- [ ] Copy buttons → URLs copied to clipboard
- [ ] Flow list → Single column layout
- [ ] Flow cards → No icons displayed

## Rollback

No database migration needed. To rollback:
1. Revert code changes
2. Delete `packages/frontend/public/icons/` directory
3. Delete `packages/backend/uploads/` directory (if created)
