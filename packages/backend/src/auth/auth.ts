import { betterAuth } from 'better-auth';
import Database from 'better-sqlite3';

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
    minPasswordLength: 4, // POC: relaxed for testing, strengthen in production
    requireEmailVerification: false,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },

  // trustedOrigins handled by NestJS CORS in main.ts
  // Using '*' here allows any origin since NestJS CORS does the actual filtering
  trustedOrigins: ['*'],

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
