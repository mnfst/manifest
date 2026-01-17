import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db';
import Database from 'better-sqlite3';

/**
 * Build trusted origins list for better-auth
 * SECURITY: Explicit allowlist instead of wildcards
 */
function getTrustedOrigins(): string[] {
  const origins: string[] = [];

  // Add origins from ALLOWED_ORIGINS env var
  if (process.env.ALLOWED_ORIGINS) {
    origins.push(...process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()));
  }

  // In development, allow localhost
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3847', 'http://localhost:5173', 'http://localhost:5174');
  }

  return origins;
}

/**
 * Better Auth instance configuration
 * This handles user authentication, sessions, and account management
 */
export const auth = betterAuth({
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3847}`,

  database: new Database('./data/app.db'),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12, // SECURITY: Strong password requirement
    requireEmailVerification: false, // Enable in production with email provider
    // Note: better-auth doesn't support complexity rules natively
    // Consider adding custom validation in signup flow if needed
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },

  // SECURITY: Explicit origin allowlist (no wildcards)
  trustedOrigins: getTrustedOrigins(),

  // Custom user fields for first and last name
  user: {
    additionalFields: {
      firstName: {
        type: 'string',
        required: true,
      },
      lastName: {
        type: 'string',
        required: true,
      },
    },
  },

  hooks: {}, // Required for decorator-based hooks
});

export type Auth = typeof auth;

/**
 * Run Better Auth database migrations
 * Creates user, session, account, and verification tables if they don't exist
 */
export async function runAuthMigrations(): Promise<void> {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}
