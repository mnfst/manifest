# Quality Checklist: MCP Flow Publication

**Purpose**: Verify implementation quality for MCP flow publication feature
**Created**: 2025-12-26
**Feature**: [spec.md](../spec.md)

## Data Model

- [ ] CHK001 Flow entity has `isActive: boolean` field with default `true`
- [ ] CHK002 Flow entity persists `isActive` to database correctly
- [ ] CHK003 App entity uses existing `status` field ('draft' | 'published')

## API Endpoints

- [ ] CHK004 PATCH /api/flows/:flowId supports `isActive` field updates
- [ ] CHK005 PATCH /api/apps/:appId supports `status` field updates (publish/unpublish)
- [ ] CHK006 GET /servers/:slug returns landing page for published apps
- [ ] CHK007 GET /servers/:slug returns 404 for draft apps
- [ ] CHK008 GET /servers/:slug/mcp returns MCP endpoint for published apps only

## MCP Server Compliance

- [ ] CHK009 MCP server only exposes flows where `isActive: true`
- [ ] CHK010 MCP server returns 404 for unpublished (draft) apps
- [ ] CHK011 MCP `tools/list` returns only active flows
- [ ] CHK012 MCP `tools/call` rejects calls to inactive tools with error
- [ ] CHK013 MCP `initialize` returns correct protocol version and capabilities

## Frontend UI

- [ ] CHK014 Flow detail page has active/inactive toggle switch
- [ ] CHK015 Toggle switch updates immediately on click
- [ ] CHK016 App detail page has Publish/Unpublish button
- [ ] CHK017 Publish button shows appropriate state (Published vs Draft)
- [ ] CHK018 Landing page displays app name, description, MCP URL
- [ ] CHK019 Landing page shows ChatGPT integration instructions

## User Experience

- [ ] CHK020 Active status toggle provides visual feedback
- [ ] CHK021 Publish/Unpublish action provides confirmation or instant feedback
- [ ] CHK022 Landing page loads in under 1 second
- [ ] CHK023 Error states are handled gracefully (network errors, etc.)

## Notes

- Check items off as completed: `[x]`
- Add comments or findings inline
- Link to relevant resources or documentation
- Items are numbered sequentially for easy reference
