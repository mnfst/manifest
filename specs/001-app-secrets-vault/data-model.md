# Data Model: App Secrets Vault

**Feature**: 001-app-secrets-vault
**Date**: 2026-01-16

## Entities

### AppSecret (NEW)

A key-value pair storing a secret variable associated with an application.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `appId` | UUID | FK → App.id, NOT NULL, CASCADE DELETE | Parent application |
| `key` | VARCHAR(256) | NOT NULL | Secret variable name (e.g., `API_KEY`) |
| `value` | TEXT | NOT NULL | Secret value (plain text for POC) |
| `createdAt` | TIMESTAMP | Auto-set on create | Creation timestamp |
| `updatedAt` | TIMESTAMP | Auto-set on update | Last modification timestamp |

**Indexes**:
- Primary: `id`
- Unique composite: `(appId, key)` - Ensures unique keys per app

**Validation Rules**:
- `key`: Required, 1-256 characters, alphanumeric + underscore only (ENV var naming)
- `value`: Required, no length limit (TEXT column)
- `appId`: Must reference existing App

**State Transitions**: None (simple CRUD, no lifecycle states)

### App (EXISTING - No Changes)

Reference for relationship:

| Relevant Field | Type | Notes |
|----------------|------|-------|
| `id` | UUID | PK |
| `name` | VARCHAR(100) | For display in App Settings header |

**New Relationship**: `OneToMany → AppSecret[]` (optional, for eager loading if needed)

## Relationships

```
┌─────────┐         ┌────────────┐
│   App   │ 1 ───── * │ AppSecret  │
└─────────┘           └────────────┘
            CASCADE DELETE
```

- **App → AppSecret**: One app can have many secrets
- **Delete Behavior**: When an app is deleted, all its secrets are cascade deleted

## TypeORM Entity Definition

```typescript
// packages/backend/src/secret/secret.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { App } from '../app/app.entity';

@Entity('app_secrets')
@Unique(['appId', 'key'])
export class AppSecret {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  appId: string;

  @ManyToOne(() => App, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appId' })
  app: App;

  @Column({ type: 'varchar', length: 256 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## Shared Types

```typescript
// packages/shared/src/types/secret.ts

export interface AppSecret {
  id: string;
  appId: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSecretRequest {
  key: string;
  value: string;
}

export interface UpdateSecretRequest {
  key?: string;
  value?: string;
}

export interface SecretListResponse {
  secrets: AppSecret[];
}
```

## Migration Notes

- New table `app_secrets` will be auto-created by TypeORM synchronize (POC mode)
- No migration script needed for POC
- Post-POC: Create proper migration for production deployment

## Security Considerations (Post-POC)

When moving past POC phase:
1. Add encryption for `value` column (AES-256)
2. Consider audit logging for secret access
3. Implement rate limiting on secret endpoints
4. Add secret rotation capabilities
