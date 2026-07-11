import { betterAuth } from 'better-auth';
import type { Auth } from 'better-auth';
import { stripe as stripePlugin } from '@better-auth/stripe';
import { render } from '@react-email/render';
import { VerifyEmailEmail } from '../notifications/emails/verify-email';
import { ResetPasswordEmail } from '../notifications/emails/reset-password';
import { sendEmail } from '../notifications/services/email-providers/send-email';
import { isBillingEnabled, getStripeClient } from '../billing/billing.config';
import {
  previousPlanFromEvent,
  sendPlanChangedEmail,
  sendSubscriptionCanceledEmail,
  sendSubscriptionConfirmedEmail,
} from '../billing/subscription-webhook-emails';

const port = process.env['PORT'] ?? '3001';
const isDev = (process.env['NODE_ENV'] ?? '') !== 'production';
const hasEmailProvider = !!(
  (process.env['EMAIL_PROVIDER'] && process.env['EMAIL_API_KEY']) ||
  (process.env['MAILGUN_API_KEY'] && process.env['MAILGUN_DOMAIN'])
);

function createDatabaseConnection() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg');
  const databaseUrl =
    process.env['DATABASE_URL'] ?? 'postgresql://myuser:mypassword@localhost:5432/mydatabase';
  // Cap Better Auth's own pool (separate from the TypeORM pool) so the two
  // connection pools don't jointly exhaust Postgres's max_connections. Auth
  // traffic is light relative to ingest, hence a smaller default than the app
  // pool. Idle connections are reaped after 30s to free server-side slots.
  const max = Number(process.env['AUTH_DB_POOL_MAX'] ?? 10);
  return new Pool({ connectionString: databaseUrl, max, idleTimeoutMillis: 30000 });
}

const database = createDatabaseConnection();

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
  if (isDev) {
    origins.push(
      `http://localhost:3000`,
      `http://127.0.0.1:3000`,
      `http://localhost:${port}`,
      `http://127.0.0.1:${port}`,
    );
  }
  if (process.env['FRONTEND_PORT']) {
    origins.push(
      `http://localhost:${process.env['FRONTEND_PORT']}`,
      `http://127.0.0.1:${process.env['FRONTEND_PORT']}`,
    );
  }
  return origins;
}

function buildPlugins() {
  if (!isBillingEnabled()) return [];
  const plans = [{ name: 'pro', priceId: process.env['STRIPE_PRO_PRICE_ID']! }];
  const priceToPlan = new Map(plans.map((plan) => [plan.priceId, plan.name]));
  return [
    stripePlugin({
      stripeClient: getStripeClient(),
      stripeWebhookSecret: process.env['STRIPE_WEBHOOK_SECRET']!,
      subscription: {
        enabled: true,
        plans,
        onSubscriptionComplete: async ({ event, subscription }) => {
          await sendSubscriptionConfirmedEmail(database, event, subscription);
        },
        onSubscriptionCreated: async ({ event, subscription }) => {
          await sendSubscriptionConfirmedEmail(database, event, subscription);
        },
        onSubscriptionUpdate: async ({ event, subscription }) => {
          const previousPlan = previousPlanFromEvent(event, priceToPlan);
          await sendPlanChangedEmail(database, event, subscription, previousPlan);
        },
        onSubscriptionCancel: async ({ event, subscription }) => {
          if (event) await sendSubscriptionCanceledEmail(database, event, subscription);
        },
        onSubscriptionDeleted: async ({ event, subscription }) => {
          await sendSubscriptionCanceledEmail(database, event, subscription);
        },
      },
    }),
  ];
}

export const auth = betterAuth({
  database,
  baseURL: process.env['BETTER_AUTH_URL'] ?? `http://localhost:${port}`,
  basePath: '/api/auth',
  secret: betterAuthSecret,
  logger: { level: 'debug' },
  telemetry: { enabled: false },
  plugins: buildPlugins(),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'github', 'discord'],
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: !isDev && hasEmailProvider,
    sendResetPassword: async ({ user, url }) => {
      const element = ResetPasswordEmail({
        userName: user.name,
        resetUrl: url,
      });
      const html = await render(element);
      const text = await render(element, { plainText: true });
      void sendEmail({
        to: user.email,
        subject: 'Reset your password',
        html,
        text,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: hasEmailProvider,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const element = VerifyEmailEmail({
        userName: user.name,
        verificationUrl: url,
      });
      const html = await render(element);
      const text = await render(element, { plainText: true });
      void sendEmail({
        to: user.email,
        subject: 'Verify your email address',
        html,
        text,
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
}) as unknown as Auth;

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
