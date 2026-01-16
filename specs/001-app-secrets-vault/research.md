# Research: App Secrets Vault

**Feature**: 001-app-secrets-vault
**Date**: 2026-01-16

## Overview

This document captures research findings and decisions for implementing the app secrets vault feature. Since this feature follows established patterns in the codebase, research focuses on confirming best practices rather than exploring unknowns.

## Decisions

### 1. Secret Storage Strategy

**Decision**: Store secrets as a separate entity with a foreign key to App

**Rationale**:
- Follows existing pattern (Flow entity has ManyToOne to App)
- Enables efficient queries (get all secrets for an app)
- Supports cascade delete when app is deleted
- Clean separation of concerns

**Alternatives Considered**:
- JSON column on App entity: Rejected - harder to query, update, and enforce constraints
- Separate secrets table without TypeORM entity: Rejected - loses type safety and ORM benefits

### 2. Secret Value Security

**Decision**: Store secret values as plain text in the database (POC phase)

**Rationale**:
- POC constitution explicitly defers security features
- Encryption at rest can be added post-POC
- SQLite file is already server-side only
- Spec notes "encrypted at rest is recommended but implementation detail"

**Alternatives Considered**:
- AES encryption in service layer: Deferred to post-POC (adds key management complexity)
- Column-level encryption: Deferred (requires additional dependencies)

**Future Recommendation**: Implement AES-256 encryption with server-managed key when moving past POC.

### 3. API Authorization Model

**Decision**: Use existing `AppAccessGuard` - all collaborators have equal access

**Rationale**:
- Spec clarification: "All collaborators (same access as other app settings)"
- Matches existing pattern for app resources (flows, theme, etc.)
- No new authorization logic needed

**Alternatives Considered**:
- Role-based access (owner-only for secrets): Rejected per spec clarification

### 4. Frontend Navigation Pattern

**Decision**: Reuse existing tabbed interface pattern from AppDetail

**Rationale**:
- Spec requirement: App Settings at `/app/:appId/settings` with Secrets tab
- AppDetail already implements tabs for Flows, Analytics, Collaborators, Theme
- Consistent UX per constitution principle III

**Alternatives Considered**:
- New navigation pattern: Rejected - violates UX consistency principle

### 5. Secrets UI Component Structure

**Decision**: Railway-style inline editing with row-based layout

**Rationale**:
- Spec requirement: Follow Railway reference screenshot
- Key visible, value masked with toggle
- Add row at top, actions via three-dot menu
- Matches existing UI patterns in codebase

**Implementation Approach**:
- `SecretsTab.tsx` - Container with add form + list
- `SecretRow.tsx` - Individual row with reveal/copy/menu
- Use existing shadcn/ui components (Button, Input, DropdownMenu)

### 6. User Settings Restructure

**Decision**: Keep `/settings` route, remove General tab, rename dropdown item

**Rationale**:
- Spec: "User Settings" dropdown navigates to `/settings` (full page)
- Spec: Remove empty "General" tab
- Minimal changes to existing SettingsPage

**Changes Required**:
- UserAvatar.tsx: "Edit Account" → "User Settings"
- SettingsPage.tsx: Remove General tab from tabs array
- Sidebar.tsx: Settings link goes to `/app/:appId/settings` when app selected

## Technical Patterns Confirmed

### Backend Module Structure
```typescript
// Follows existing pattern from app.module.ts, flow.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([AppSecret, App])],
  controllers: [SecretController],
  providers: [SecretService],
  exports: [SecretService],
})
export class SecretModule {}
```

### Entity Relationship
```typescript
// AppSecret.entity.ts - follows Flow entity pattern
@ManyToOne(() => App, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'appId' })
app: App;
```

### API Endpoint Pattern
```
POST   /api/apps/:appId/secrets     - Create secret
GET    /api/apps/:appId/secrets     - List app secrets
PATCH  /api/secrets/:secretId       - Update secret
DELETE /api/secrets/:secretId       - Delete secret
```

### Frontend API Client Pattern
```typescript
// Follows existing api.ts methods
secrets: {
  list: (appId: string) => Promise<AppSecret[]>,
  create: (appId: string, data: CreateSecretRequest) => Promise<AppSecret>,
  update: (secretId: string, data: UpdateSecretRequest) => Promise<AppSecret>,
  delete: (secretId: string) => Promise<void>,
}
```

## No Clarifications Needed

All technical context is resolved:
- Storage: SQLite/TypeORM (existing)
- Framework: NestJS + React (existing)
- Patterns: Confirmed from codebase exploration
- Security: Deferred per POC constitution
- Testing: Deferred per POC constitution

## Summary

This feature is a straightforward CRUD implementation following established codebase patterns. No significant technical research was required. All decisions align with existing architecture and POC constitution constraints.
