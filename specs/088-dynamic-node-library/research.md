# Research: Dynamic Node Library

**Feature**: 088-dynamic-node-library
**Date**: 2026-01-06

## Research Questions

### Q1: Why is the API Call node not appearing in the node library?

**Finding**: The API Call node IS correctly registered.

**Evidence**:
- `packages/nodes/src/nodes/index.ts:40` includes `ApiCallNode` in `builtInNodeList`
- `packages/nodes/src/nodes/ApiCallNode.ts` defines the node with `category: 'action'`
- The backend `node.service.ts:54` maps `builtInNodeList` to API response

**Decision**: No code change needed for API Call visibility.

**Rationale**: The node is properly registered. If it's not appearing, the issue is likely:
1. Build cache - nodes package needs rebuild
2. Browser cache - hard refresh needed
3. Backend not restarted after nodes package build

**Alternatives Considered**: None - this is a verification, not a design decision.

---

### Q2: Is the node library already dynamic?

**Finding**: Yes, the node library already fetches nodes dynamically from the API.

**Evidence**:
- `NodeLibrary.tsx:68-83` fetches node types via `api.getNodeTypes()` when drawer opens
- `node.service.ts:53-64` returns all nodes from `builtInNodeList` with categories
- Nodes are grouped by `category` field in the frontend

**Decision**: No infrastructure changes needed.

**Rationale**: The existing implementation satisfies FR-001, FR-002, FR-003 (dynamic fetch, group by category, auto-display new nodes).

**Alternatives Considered**:
- Server-side rendering of node list - Rejected: Adds complexity, current approach is simpler
- GraphQL subscription for live updates - Rejected: Over-engineering for POC

---

### Q3: What is the correct category for CallFlow node?

**Finding**: CallFlow should be `'return'` category, not `'action'`.

**Evidence**:
- User explicitly stated: "Tool call is a return value, not an action" (referring to CallFlow)
- CallFlow semantics: Calls another flow and **returns** its result to downstream nodes
- Return node is also `'return'` category - same conceptual grouping

**Decision**: Change `CallFlowNode.ts` line 14 from `category: 'action'` to `category: 'return'`

**Rationale**:
- CallFlow's primary purpose is to get a return value from another flow
- Users expect to find "things that return values" together
- API Call (which performs an action) remains correctly in `'action'`

**Alternatives Considered**:
- Keep as `'action'` - Rejected: User explicitly requested change; semantically incorrect
- Create new category `'subflow'` - Rejected: Over-engineering; `'return'` fits semantically

---

### Q4: Impact of category change on existing flows

**Finding**: Category is display-only metadata; no execution impact.

**Evidence**:
- `category` field is only used in `NodeTypesResponse` for UI grouping
- Flow execution uses `node.type` (e.g., `'CallFlow'`), not `category`
- No database migration needed - category is defined in code, not stored

**Decision**: Safe to change category without migration.

**Rationale**: The category field affects only how nodes appear in the node library picker. Existing flows reference nodes by type name, which remains unchanged.

**Alternatives Considered**: None - this is a risk assessment.

---

## Summary

| Research Item | Resolution |
|---------------|------------|
| API Call not appearing | Build/cache issue, not code issue |
| Dynamic node library | Already implemented |
| CallFlow categorization | Change to `'return'` |
| Breaking change risk | None - display metadata only |

**All NEEDS CLARIFICATION items resolved.** Ready for Phase 1 design.
