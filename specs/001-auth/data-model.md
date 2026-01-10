# Data Model: User Authentication & Authorization

**Feature**: 001-auth
**Date**: 2026-01-10

## Entity Overview

```
┌─────────────────────┐
│       user          │  (managed by better-auth)
│─────────────────────│
│ id: string (PK)     │
│ email: string       │
│ name: string        │
│ emailVerified: bool │
│ image: string?      │
│ createdAt: Date     │
│ updatedAt: Date     │
└─────────┬───────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐       ┌─────────────────────┐
│   user_app_role     │       │       apps          │
│─────────────────────│       │─────────────────────│
│ id: string (PK)     │  N:1  │ id: string (PK)     │
│ userId: string (FK) │◄──────│ name: string        │
│ appId: string (FK)  │───────►│ slug: string        │
│ role: 'owner'|      │       │ ...                 │
│       'admin'       │       └─────────────────────┘
│ createdAt: Date     │
└─────────────────────┘
```

## Entities

### User (better-auth managed)

The user entity is created and managed by better-auth. We reference it but don't define it ourselves.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string | PK, UUID | Unique user identifier |
| email | string | unique, not null | User's email address |
| name | string | nullable | Display name |
| emailVerified | boolean | default: false | Email verification status |
| image | string | nullable | Profile image URL |
| createdAt | Date | auto | Creation timestamp |
| updatedAt | Date | auto | Last update timestamp |

**Notes**:
- better-auth also creates `session`, `account`, and `verification` tables
- We only interact with `user` table directly for our business logic

---

### UserAppRole (custom entity)

Join table for many-to-many relationship between users and apps with role assignment.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string | PK, UUID | Unique role assignment ID |
| userId | string | FK -> user.id, not null | Reference to user |
| appId | string | FK -> apps.id, not null | Reference to app |
| role | enum | 'owner' \| 'admin' | User's role for this app |
| createdAt | Date | auto | When access was granted |

**Unique Constraint**: (userId, appId) - A user can only have one role per app.

**Validation Rules**:
- Role must be exactly 'owner' or 'admin'
- Each app must have exactly one owner
- Owner role cannot be removed or changed
- User must exist in system before being added to an app

**Cascade Behavior**:
- On user delete: Delete all UserAppRole entries for that user
- On app delete: Delete all UserAppRole entries for that app

---

### App (existing entity - modified)

Existing entity gains relationship to users via UserAppRole.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| ... | ... | ... | (existing fields unchanged) |
| userRoles | relation | OneToMany -> UserAppRole | Users with access to this app |

**TypeORM Relation**:
```typescript
@OneToMany(() => UserAppRole, (userRole) => userRole.app)
userRoles?: UserAppRole[];
```

---

## TypeORM Entity Definitions

### UserAppRole Entity

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { AppEntity } from '../app/app.entity';

export type AppRole = 'owner' | 'admin';

@Entity('user_app_roles')
@Unique(['userId', 'appId'])
export class UserAppRoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  appId!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: AppRole;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => AppEntity, (app) => app.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appId' })
  app!: AppEntity;
}
```

---

## State Transitions

### User Lifecycle

```
[Not Registered] --signup--> [Registered] --login--> [Authenticated]
                                   │
                                   └──────────────────> [Session Expired]
                                                              │
                                                              └──login──> [Authenticated]
```

### UserAppRole Lifecycle

```
[No Access] --add by owner/admin--> [Has Access (owner|admin)]
     ▲                                       │
     │                                       │ (if not owner)
     └─────────remove by owner/admin─────────┘
```

**Business Rules**:
1. Owner role is assigned at app creation and cannot be changed
2. Admins can add/remove other admins but not the owner
3. Owners can add/remove anyone except themselves (as owner)
4. A user loses all app access when their account is deleted

---

## Seed Data

### Default Admin User

| Field | Value |
|-------|-------|
| email | admin@manifest.build |
| password | admin (hashed) |
| name | Admin |

### Default UserAppRole

| userId | appId | role |
|--------|-------|------|
| (admin user) | (Test App) | owner |

---

## Query Patterns

### Get apps for user

```sql
SELECT a.* FROM apps a
INNER JOIN user_app_roles uar ON a.id = uar.appId
WHERE uar.userId = :userId
```

### Get users for app

```sql
SELECT u.*, uar.role FROM user u
INNER JOIN user_app_roles uar ON u.id = uar.userId
WHERE uar.appId = :appId
ORDER BY uar.role, u.email
```

### Check user access to app

```sql
SELECT role FROM user_app_roles
WHERE userId = :userId AND appId = :appId
```

---

## Migration Notes

For existing databases with apps but no users:
1. Create admin user during seed
2. Assign admin as owner of all existing apps
3. This ensures no "orphan" apps without owners
