# API Contracts

**Feature**: Backend Test Suite - App Module

## Not Applicable

This feature implements **tests for existing APIs**, not new API endpoints. Therefore, no new API contracts are defined.

The tests validate the existing contracts defined in:
- `packages/shared/src/types.ts` - TypeScript interfaces for App, CreateAppRequest, etc.
- `packages/backend/src/app/app.controller.ts` - Existing endpoint definitions

## Tested Endpoints

The test suite covers the following existing endpoints:

| Method | Path | Request Type | Response Type |
|--------|------|--------------|---------------|
| GET | `/api/apps` | - | `AppWithFlowCount[]` |
| POST | `/api/apps` | `CreateAppRequest` | `App` |
| GET | `/api/apps/:appId` | - | `App` |
| PATCH | `/api/apps/:appId` | `UpdateAppRequest` | `App` |
| DELETE | `/api/apps/:appId` | - | `DeleteAppResponse` |
| POST | `/api/apps/:appId/publish` | - | `PublishResult` |
| POST | `/api/apps/:appId/icon` | `multipart/form-data` | `IconUploadResponse` |

See `data-model.md` for test coverage matrix.
