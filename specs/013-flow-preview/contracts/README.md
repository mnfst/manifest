# API Contracts: Flow Preview with Tabbed Interface

**Feature Branch**: `013-flow-preview`
**Created**: 2025-12-28

## No API Changes Required

This feature is **frontend-only** and does not require any changes to backend API contracts.

### Existing APIs Used (No Modifications)

The preview feature reuses data already fetched by the FlowDetail page:

| Endpoint | Method | Usage |
|----------|--------|-------|
| `/apps/:appId` | GET | App data for theming (name, logo, themeVariables) |
| `/flows/:flowId` | GET | Flow data including name and views with mock data |

### Why No New APIs

1. **All data available**: Flow name, views, and mock data are already loaded by FlowDetail
2. **Frontend rendering**: Component view rendering happens entirely client-side
3. **No persistence**: Preview state (animation phase, tab selection) is ephemeral
4. **No user actions**: Preview is read-only, no mutations required

### Future Considerations

If Usage tab functionality is added later, new API endpoints may be required for:
- Generating usage documentation
- Fetching integration examples
- API key management

These will be defined in a separate feature specification.
