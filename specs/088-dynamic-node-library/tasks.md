# Tasks: Dynamic Node Library

**Input**: Design documents from `/specs/088-dynamic-node-library/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested (POC phase)

**Organization**: This is a minimal feature - single code change with verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Implementation

**Purpose**: Single code change to recategorize CallFlow node

- [ ] T001 [US3] Change CallFlow category from 'action' to 'return' in packages/nodes/src/nodes/CallFlowNode.ts

---

## Phase 2: Build & Verification

**Purpose**: Rebuild packages and verify the change works

- [ ] T002 Rebuild nodes package: `pnpm --filter @chatgpt-app-builder/nodes build`
- [ ] T003 Rebuild backend package: `pnpm --filter @chatgpt-app-builder/backend build`
- [ ] T004 Start application with `.specify/scripts/bash/serve-app.sh`
- [ ] T005 [US1] Verify all nodes appear in node library (UserIntent, Interface, Return, CallFlow, ApiCall)
- [ ] T006 [US3] Verify CallFlow appears in "Return Values" category (not "Actions")
- [ ] T007 [US1] Verify API Call appears in "Actions" category

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies - single code change
- **Phase 2**: Depends on Phase 1 completion

### User Story Coverage

| User Story | Tasks | Status |
|------------|-------|--------|
| US1 - Browse Nodes by Category | T005, T007 | Already working (dynamic) |
| US2 - Search Across All Nodes | N/A | Already working (no changes needed) |
| US3 - Node Category Correctness | T001, T006 | Requires T001 change |

---

## Implementation Strategy

### MVP (Complete in ~5 minutes)

1. Complete T001: Single line change
2. Complete T002-T003: Rebuild
3. Complete T004-T007: Verify

### Summary

| Metric | Value |
|--------|-------|
| Total tasks | 7 |
| Code changes | 1 file, 1 line |
| Verification tasks | 4 |
| Estimated time | 5-10 minutes |

---

## Notes

- This is a minimal change - the node library is already dynamic
- FR-001 to FR-004, FR-006 to FR-008 are already satisfied by existing implementation
- Only FR-005 (CallFlow categorization) requires code change
- User Stories 1 and 2 pass verification with existing code
- User Story 3 requires the single change in T001
