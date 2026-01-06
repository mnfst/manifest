# Data Model: Remove Mock Data and Add Default Test Fixtures

**Date**: 2026-01-06
**Feature**: 020-remove-mock-data

## Overview

This feature primarily involves **removal** of data structures rather than addition. The only new data is the default test fixtures seeded on startup.

---

## 1. Types to Remove

### From `packages/shared/src/types/node.ts`

```typescript
// REMOVE: TableColumn interface
export interface TableColumn {
  key: string;
  header: string;
  type: 'text' | 'number' | 'date' | 'badge' | 'action';
}

// REMOVE: TableMockData interface
export interface TableMockData {
  type: 'table';
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
}

// REMOVE: PostItem interface
export interface PostItem {
  id: string;
  title: string;
  excerpt: string;
  author?: string;
  date?: string;
  image?: string;
  category?: string;
  tags?: string[];
}

// REMOVE: PostListMockData interface
export interface PostListMockData {
  type: 'post-list';
  posts: PostItem[];
}

// REMOVE: MockData union type
export type MockData = TableMockData | PostListMockData;

// REMOVE: Type guards
export function isTableMockData(data: MockData): data is TableMockData;
export function isPostListMockData(data: MockData): data is PostListMockData;

// REMOVE: Default constants
export const DEFAULT_TABLE_MOCK_DATA: TableMockData;
export const DEFAULT_POST_LIST_MOCK_DATA: PostListMockData;
```

---

## 2. Types to Modify

### InterfaceNodeParameters

**Before**:
```typescript
export interface InterfaceNodeParameters {
  layoutTemplate: LayoutTemplate;
  mockData: MockData;
}
```

**After**:
```typescript
export interface InterfaceNodeParameters {
  layoutTemplate: LayoutTemplate;
}
```

### GenerateAppResult (in agent.service.ts)

**Before**:
```typescript
export interface GenerateAppResult {
  name: string;
  description: string;
  layoutTemplate: LayoutTemplate;
  themeVariables: ThemeVariables;
  mockData: MockData;
  toolName: string;
  toolDescription: string;
}
```

**After**:
```typescript
export interface GenerateAppResult {
  name: string;
  description: string;
  layoutTemplate: LayoutTemplate;
  themeVariables: ThemeVariables;
  toolName: string;
  toolDescription: string;
}
```

### GenerateFlowResult (in agent.service.ts)

**Before**:
```typescript
export interface GenerateFlowResult {
  name: string;
  description: string;
  toolName: string;
  toolDescription: string;
  whenToUse: string;
  whenNotToUse: string;
  layoutTemplate: LayoutTemplate;
  mockData: MockData;
}
```

**After**:
```typescript
export interface GenerateFlowResult {
  name: string;
  description: string;
  toolName: string;
  toolDescription: string;
  whenToUse: string;
  whenNotToUse: string;
  layoutTemplate: LayoutTemplate;
}
```

---

## 3. Interfaces to Remove Entirely

### ProcessMockDataChatResult (in agent.service.ts)

```typescript
// REMOVE: Entire interface
export interface ProcessMockDataChatResult {
  response: string;
  mockData: MockData;
}
```

---

## 4. Default Test Fixtures

### Default App Entity

| Field | Value |
|-------|-------|
| name | "Test App" |
| description | "Default test application for development and PR testing" |
| slug | "test-app" (auto-generated) |
| status | "draft" |
| themeVariables | DEFAULT_THEME_VARIABLES |
| logoUrl | Random from DEFAULT_ICONS |

### Default Flow Entity

| Field | Value |
|-------|-------|
| appId | (reference to Test App) |
| name | "Test Flow" |
| description | "Default test flow for development purposes" |
| toolName | "test_flow" |
| toolDescription | "A default test flow for development and testing purposes" |
| whenToUse | "Use this flow for testing" |
| whenNotToUse | "Do not use in production" |
| parameters | [] |
| nodes | [] |
| connections | [] |
| isActive | true |

---

## 5. Entity Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                        AppEntity                             │
│─────────────────────────────────────────────────────────────│
│  id: string (UUID)                                          │
│  name: string = "Test App"                                  │
│  description: string                                        │
│  slug: string = "test-app"                                  │
│  themeVariables: JSON                                       │
│  status: 'draft' | 'published'                              │
│  logoUrl: string                                            │
│  createdAt: Date                                            │
│  updatedAt: Date                                            │
│                                                             │
│  ┌─ flows: FlowEntity[] (one-to-many)                      │
│  │                                                          │
│  │  ┌─────────────────────────────────────────────────────┐│
│  │  │                    FlowEntity                        ││
│  │  │─────────────────────────────────────────────────────││
│  │  │  id: string (UUID)                                  ││
│  │  │  appId: string (FK → App.id)                        ││
│  │  │  name: string = "Test Flow"                         ││
│  │  │  toolName: string = "test_flow"                     ││
│  │  │  toolDescription: string                            ││
│  │  │  nodes: NodeInstance[] (JSON)                       ││
│  │  │    └─ InterfaceNodeParameters: { layoutTemplate }   ││
│  │  │       (NO MORE mockData field)                      ││
│  │  │  connections: Connection[] (JSON)                   ││
│  │  │  isActive: boolean                                  ││
│  │  └─────────────────────────────────────────────────────┘│
│  └──────────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Validation Rules

### Seeding Validation

| Rule | Condition | Action |
|------|-----------|--------|
| Idempotency check | `apps.length === 0` | Only seed if no apps exist |
| App creation | Always succeeds | Use AppService.create() method |
| Flow creation | Requires valid appId | Create after app is saved |

### InterfaceNodeParameters Validation

| Field | Required | Default |
|-------|----------|---------|
| layoutTemplate | Yes | 'table' |

---

## 7. State Transitions

### Application Startup

```
┌─────────────────┐
│  App Bootstrap  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Check if any   │──────Yes──────┐
│  apps exist     │               │
└────────┬────────┘               │
         │ No                     │
         ▼                        │
┌─────────────────┐               │
│  Create default │               │
│  "Test App"     │               │
└────────┬────────┘               │
         │                        │
         ▼                        │
┌─────────────────┐               │
│  Create default │               │
│  "Test Flow"    │               │
└────────┬────────┘               │
         │                        │
         ▼                        ▼
┌─────────────────────────────────────┐
│         App Ready for Requests       │
└─────────────────────────────────────┘
```

---

## Summary

| Category | Count |
|----------|-------|
| Types to remove | 6 (TableColumn, TableMockData, PostItem, PostListMockData, MockData, ProcessMockDataChatResult) |
| Functions to remove | 2 (isTableMockData, isPostListMockData) |
| Constants to remove | 2 (DEFAULT_TABLE_MOCK_DATA, DEFAULT_POST_LIST_MOCK_DATA) |
| Types to modify | 3 (InterfaceNodeParameters, GenerateAppResult, GenerateFlowResult) |
| New fixtures | 2 (1 App, 1 Flow) |
