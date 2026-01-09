# Data Model: Backend Test Suite - App Module

**Feature Branch**: `001-backend-test-suite`
**Date**: 2026-01-08

## Overview

This document defines the test infrastructure models, mock patterns, and entity factories for the App module test suite.

## Test Infrastructure Components

### 1. Mock Repository Interface

Represents the mocked TypeORM repository for AppEntity.

| Property | Type | Description |
|----------|------|-------------|
| `create` | `jest.Mock` | Creates entity instance from plain object |
| `save` | `jest.Mock` | Persists entity to database |
| `findOne` | `jest.Mock` | Finds single entity by criteria |
| `find` | `jest.Mock` | Finds multiple entities |
| `remove` | `jest.Mock` | Removes entity from database |
| `createQueryBuilder` | `jest.Mock` | Creates query builder for complex queries |

**Mock Query Builder Chain**:
| Method | Returns | Purpose |
|--------|---------|---------|
| `loadRelationCountAndMap` | `this` | Loads relation counts (flowCount) |
| `orderBy` | `this` | Sets ordering |
| `getMany` | `Promise<Entity[]>` | Executes query |

### 2. Mock Service Interfaces

#### MockAppService

| Method | Return Type | Mocked Behavior |
|--------|-------------|-----------------|
| `create` | `Promise<App>` | Returns mock App object |
| `findAll` | `Promise<AppWithFlowCount[]>` | Returns array of mock Apps |
| `findById` | `Promise<App \| null>` | Returns mock App or null |
| `findBySlug` | `Promise<App \| null>` | Returns mock App or null |
| `getCurrentApp` | `Promise<App \| null>` | Returns mock App or null |
| `update` | `Promise<App>` | Returns updated mock App |
| `delete` | `Promise<DeleteAppResponse>` | Returns deletion result |
| `publish` | `Promise<PublishResult>` | Returns publish result |
| `updateIcon` | `Promise<App>` | Returns updated mock App |

#### MockAgentService

| Method | Return Type | Mocked Behavior |
|--------|-------------|-----------------|
| `generateApp` | `Promise<GenerateAppResult>` | Returns mock generation result |
| `processChat` | `Promise<ProcessChatResult>` | Returns mock chat result |

### 3. Test Fixture Factories

#### createMockApp()

Creates a mock App object for testing.

| Field | Type | Default Value |
|-------|------|---------------|
| `id` | `string` | `'test-app-id'` |
| `name` | `string` | `'Test App'` |
| `description` | `string` | `'Test description'` |
| `slug` | `string` | `'test-app'` |
| `themeVariables` | `ThemeVariables` | `DEFAULT_THEME_VARIABLES` |
| `status` | `AppStatus` | `'draft'` |
| `logoUrl` | `string` | `'/icons/icon-blue.png'` |
| `createdAt` | `string` | ISO date string |
| `updatedAt` | `string` | ISO date string |

#### createMockAppEntity()

Creates a mock AppEntity for repository tests.

| Field | Type | Default Value |
|-------|------|---------------|
| `id` | `string` | `'test-entity-id'` |
| `name` | `string` | `'Test Entity'` |
| `description` | `string` | `'Entity description'` |
| `slug` | `string` | `'test-entity'` |
| `themeVariables` | `ThemeVariables` | `DEFAULT_THEME_VARIABLES` |
| `status` | `AppStatus` | `'draft'` |
| `logoUrl` | `string` | `'/icons/icon-blue.png'` |
| `createdAt` | `Date` | `new Date()` |
| `updatedAt` | `Date` | `new Date()` |
| `flows` | `FlowEntity[]` | `[]` |

#### createMockCreateAppRequest()

Creates a mock request body for app creation.

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `name` | `string` | Yes | `'New Test App'` |
| `description` | `string` | No | `undefined` |
| `themeVariables` | `Partial<ThemeVariables>` | No | `undefined` |

## Entity Relationships (for mocking)

```
AppEntity (mocked)
├── id: UUID
├── name: string
├── slug: string (unique)
├── status: 'draft' | 'published'
├── themeVariables: JSON
├── logoUrl: string
└── flows: FlowEntity[] (mocked as empty array or with mock flows)
```

## State Transitions Under Test

### App Status Transitions

| Current State | Action | New State | Validation |
|---------------|--------|-----------|------------|
| `draft` | `publish()` | `published` | Must have flows |
| `published` | `update()` | `published` | Allowed |
| `draft` | `update()` | `draft` | Allowed |
| `draft` | `delete()` | (removed) | Always allowed |
| `published` | `delete()` | (removed) | Always allowed |

### Error States to Test

| Scenario | Expected Exception | HTTP Status |
|----------|-------------------|-------------|
| App not found by ID | `NotFoundException` | 404 |
| Create app with empty name | `BadRequestException` | 400 |
| Create app with name > 100 chars | `BadRequestException` | 400 |
| Publish app with no flows | `BadRequestException` | 400 |
| Update non-existent app | `NotFoundException` | 404 |
| Delete non-existent app | `NotFoundException` | 404 |

## Test Coverage Matrix

### AppService Methods

| Method | Success Path | Error Path | Edge Cases |
|--------|-------------|------------|------------|
| `create` | ✓ | N/A | Slug collision |
| `findAll` | ✓ | N/A | Empty list |
| `findById` | ✓ | Not found | N/A |
| `findBySlug` | ✓ | Not found | N/A |
| `getCurrentApp` | ✓ | No current | N/A |
| `update` | ✓ | Not found | Partial update |
| `delete` | ✓ | Not found | With flows |
| `publish` | ✓ | Not found, no flows | N/A |
| `generateUniqueSlug` | ✓ | N/A | Existing slugs |
| `updateIcon` | ✓ | Not found | N/A |

### AppController Endpoints

| Endpoint | Success Path | Error Path | Validation |
|----------|-------------|------------|------------|
| `GET /api/apps` | ✓ | N/A | N/A |
| `POST /api/apps` | ✓ | N/A | Empty name, long name |
| `GET /api/apps/:appId` | ✓ | Not found | N/A |
| `PATCH /api/apps/:appId` | ✓ | Not found | N/A |
| `DELETE /api/apps/:appId` | ✓ | Not found | N/A |
| `POST /api/apps/:appId/publish` | ✓ | Not found | N/A |
| `POST /api/apps/:appId/icon` | ✓ | Not found | File validation |

### Legacy Endpoints (Lower Priority)

| Endpoint | Tested |
|----------|--------|
| `POST /api/generate` | Optional |
| `GET /api/current` | Optional |
| `POST /api/chat` | Optional |
| `POST /api/publish` | Optional |
