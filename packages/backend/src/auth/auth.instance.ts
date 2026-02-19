import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { render } from '@react-email/render';
import { VerifyEmailEmail } from '../notifications/emails/verify-email';
import { ResetPasswordEmail } from '../notifications/emails/reset-password';
import { sendMailgunEmail } from '../notifications/services/mailgun';

const databaseUrl = process.env['DATABASE_URL'] ?? 'postgresql://myuser:mypassword@localhost:5432/mydatabase';
const pool = new Pool({ connectionString: databaseUrl });
const port = process.env['PORT'] ?? '3001';
const isDev = (process.env['NODE_ENV'] ?? '') !== 'production';

const betterAuthSecret = process.env['BETTER_AUTH_SECRET'] ?? '';
const nodeEnv = process.env['NODE_ENV'] ?? '';
if (nodeEnv !== 'test' && (!betterAuthSecret || betterAuthSecret.length < 32)) {
  throw new Error('BETTER_AUTH_SECRET must be set to a value of at least 32 characters');
}

function buildTrustedOrigins(): string[] {
  const origins: string[] = [];
  if (process.env['BETTER_AUTH_URL']) {
    origins.push(process.env['BETTER_AUTH_URL']);
  }
  if (process.env['CORS_ORIGIN']) {
    origins.push(process.env['CORS_ORIGIN']);
  }
  origins.push(`http://localhost:3000`, `http://localhost:${port}`);
  if (process.env['FRONTEND_PORT']) {
    origins.push(`http://localhost:${process.env['FRONTEND_PORT']}`);
  }
  return origins;
}

export const auth = betterAuth({
  database: pool,
  baseURL: process.env['BETTER_AUTH_URL'] ?? `http://localhost:${port}`,
  basePath: '/api/auth',
  secret: betterAuthSecret || 'test-only-fallback-secret-not-for-production',
  logger: {
    level: 'debug',
  },
  telemetry: { enabled: false },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'github', 'discord'],
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: !isDev,
    sendResetPassword: async ({ user, url }) => {
      const html = await render(ResetPasswordEmail({
        userName: user.name,
        resetUrl: url,
      }));
      void sendMailgunEmail({
        to: user.email,
        subject: 'Reset your password',
        html,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const html = await render(VerifyEmailEmail({
        userName: user.name,
        verificationUrl: url,
      }));
      void sendMailgunEmail({
        to: user.email,
        subject: 'Verify your email address',
        html,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
      enabled: !!(process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET']),
    },
    github: {
      clientId: process.env['GITHUB_CLIENT_ID'] ?? '',
      clientSecret: process.env['GITHUB_CLIENT_SECRET'] ?? '',
      enabled: !!(process.env['GITHUB_CLIENT_ID'] && process.env['GITHUB_CLIENT_SECRET']),
      scope: ['user:email'],
    },
    discord: {
      clientId: process.env['DISCORD_CLIENT_ID'] ?? '',
      clientSecret: process.env['DISCORD_CLIENT_SECRET'] ?? '',
      enabled: !!(process.env['DISCORD_CLIENT_ID'] && process.env['DISCORD_CLIENT_SECRET']),
      scope: ['identify', 'email'],
    },
  },
  trustedOrigins: buildTrustedOrigins(),
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
