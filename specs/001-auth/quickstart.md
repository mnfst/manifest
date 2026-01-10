# Quickstart: User Authentication & Authorization

**Feature**: 001-auth
**Date**: 2026-01-10

## Prerequisites

- Node.js >= 18.0.0
- pnpm installed
- Existing project cloned and dependencies installed

## Installation

### Backend Dependencies

```bash
cd packages/backend
pnpm add better-auth @thallesp/nestjs-better-auth
```

### Frontend Dependencies

```bash
cd packages/frontend
pnpm add better-auth
```

## Configuration

### 1. Environment Variables

Add to `packages/backend/.env`:

```env
# Authentication
BETTER_AUTH_SECRET=your-secret-key-here-min-32-chars
BETTER_AUTH_URL=http://localhost:3847
```

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Backend Main.ts Update

Update `packages/backend/src/main.ts` to disable body parsing:

```typescript
const app = await NestFactory.create(AppModule, {
  bodyParser: false, // Required for better-auth
});
```

### 3. Auth Module Setup

Create `packages/backend/src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAppRoleEntity } from './user-app-role.entity';

@Module({
  imports: [
    BetterAuthModule.forRoot({
      database: {
        provider: 'sqlite',
        url: './data/app.db',
      },
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 4,
      },
      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24,      // 1 day
      },
    }),
    TypeOrmModule.forFeature([UserAppRoleEntity]),
  ],
  exports: [BetterAuthModule],
})
export class AuthModule {}
```

### 4. Frontend Auth Client

Create `packages/frontend/src/lib/auth-client.ts`:

```typescript
import { createAuthClient } from 'better-auth/react';

const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3847';

export const authClient = createAuthClient({
  baseURL: BACKEND_URL,
});
```

## Verification Steps

### 1. Start the Backend

```bash
cd packages/backend
pnpm dev
```

Check logs for:
- Auth module initialized
- Database tables created (user, session, account, verification)

### 2. Test Registration

```bash
curl -X POST http://localhost:3847/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'
```

Expected: 200 OK with user object

### 3. Test Login

```bash
curl -X POST http://localhost:3847/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@manifest.build","password":"admin"}'
```

Expected: 200 OK with session cookie

### 4. Verify Seeded User

After starting the backend with a fresh database:
- User `admin@manifest.build` should exist
- User should be owner of "Test App"

## Key Files

| File | Purpose |
|------|---------|
| `packages/backend/src/auth/auth.module.ts` | Auth configuration |
| `packages/backend/src/auth/user-app-role.entity.ts` | User-App role entity |
| `packages/backend/src/seed/seed.service.ts` | Seeds admin user |
| `packages/frontend/src/lib/auth-client.ts` | Frontend auth client |
| `packages/frontend/src/hooks/useAuth.ts` | Auth hook wrapper |
| `packages/frontend/src/pages/AuthPage.tsx` | Login/Signup page |

## Default Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@manifest.build | admin | Owner of Test App |

## Troubleshooting

### "Body already parsed" Error
Ensure `bodyParser: false` is set in `main.ts`.

### Session Not Persisting
Check that cookies are enabled and CORS is configured properly.

### User Not Found After Registration
Verify the database file exists at `./data/app.db`.

### Cannot Access Protected Routes
Check the global auth guard is applied in `app.module.ts`.
