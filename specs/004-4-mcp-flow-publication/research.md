# Research: MCP Flow Publication

**Feature**: 004-4-mcp-flow-publication
**Date**: 2025-12-26
**Status**: Complete

## Research Tasks

### 1. MCP Protocol Compliance

**Decision**: Follow MCP specification 2025-11-25 for server implementation.

**Rationale**: The MCP specification defines the standard protocol for model-context-protocol servers. ChatGPT and other clients expect servers to implement `initialize`, `tools/list`, and `tools/call` methods correctly.

**Alternatives Considered**:
- Custom protocol: Rejected - would not work with ChatGPT or other MCP clients

**Key Findings**:
- MCP uses JSON-RPC 2.0 message format
- Servers expose Resources, Prompts, and Tools
- Tools require user consent before invocation
- `tools/list` returns array of available tools with name, description, and inputSchema

### 2. ChatGPT Integration Instructions

**Decision**: Follow OpenAI Apps SDK quickstart for connector registration.

**Rationale**: The official quickstart provides the exact steps users need to add an MCP app to ChatGPT.

**Key Findings**:
- Users go to Settings → Apps & Connectors → Create
- Enter HTTPS URL with `/mcp` path
- ChatGPT discovers available tools automatically

### 3. Flow Active Status Implementation

**Decision**: Add `isActive: boolean` column to flows table with default `true`.

**Rationale**:
- Simple boolean field is sufficient for show/hide functionality
- Default `true` ensures existing flows remain visible (backwards compatible)
- MCP server filters flows by `isActive` when building tools list

**Alternatives Considered**:
- String status field ('active', 'inactive', 'archived'): Rejected - over-engineered for POC
- Soft delete pattern: Rejected - users want to temporarily hide, not archive

### 4. App Publication Status

**Decision**: Use existing `status: 'draft' | 'published'` field on App entity.

**Rationale**: The app entity already has this field implemented. We just need to ensure the MCP endpoints properly check it.

**Key Implementation Points**:
- MCP endpoint at `/servers/{slug}/mcp` must return 404 for draft apps
- Landing page at `/servers/{slug}` must return 404 for draft apps
- UI components visible at `/servers/{slug}/ui/*` must return 404 for draft apps

### 5. Landing Page Design

**Decision**: Server-rendered HTML page with static content and dynamic URL injection.

**Rationale**:
- Simple approach using existing NestJS template pattern
- No need for React rendering - static content is sufficient
- URL is dynamically generated based on request host

**Page Contents**:
- App name and description
- MCP endpoint URL (copyable)
- Step-by-step ChatGPT integration instructions
- List of available tools (active flows only)

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| NestJS | 10.x | Backend framework (existing) |
| TypeORM | 0.3.x | Database ORM (existing) |
| React | 18.x | Frontend framework (existing) |
| Tailwind CSS | 3.x | UI styling (existing) |

No new dependencies required.

## Technical Decisions Summary

1. **isActive field**: Boolean column on flows table, default true
2. **MCP filtering**: Only expose flows where `isActive: true` AND app `status: 'published'`
3. **Landing page**: Server-rendered HTML at `/servers/{slug}`
4. **404 handling**: Draft apps return 404 for all MCP-related endpoints
5. **Backwards compatibility**: Existing flows default to active
