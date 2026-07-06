import type Stripe from 'stripe';
import type { Subscription } from '@better-auth/stripe';
import { v4 as uuid } from 'uuid';
import {
  formatPlanName,
  getBillingAppUrl,
  getBillingEmailFrom,
  sendSubscriptionPlanEmail,
} from './billing-email-sender';

type QueryResult<T> = T[] | { rows: T[] };
type Queryable = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
};

interface BillingUserRecipient {
  email: string | null;
  name: string | null;
}

interface BillingEmailLogParams {
  dedupeKey: string;
  kind: string;
  userId?: string | null;
  stripeSubscriptionId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  metadata?: Record<string, unknown> | null;
}

function rowsFrom<T>(result: QueryResult<T>): T[] {
  return Array.isArray(result) ? result : result.rows;
}

async function queryRows<T>(db: Queryable, sql: string, params: unknown[] = []): Promise<T[]> {
  return rowsFrom(await db.query<T>(sql, params));
}

async function tryInsertBillingEmailLog(
  db: Queryable,
  params: BillingEmailLogParams,
): Promise<boolean> {
  const rows = await queryRows<{ id: string }>(
    db,
    `INSERT INTO billing_email_logs
       (id, dedupe_key, kind, user_id, stripe_subscription_id, period_start, period_end, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id`,
    [
      uuid(),
      params.dedupeKey,
      params.kind,
      params.userId ?? null,
      params.stripeSubscriptionId ?? null,
      params.periodStart ?? null,
      params.periodEnd ?? null,
      params.metadata ?? null,
    ],
  );
  return rows.length > 0;
}

async function resolveBillingUser(
  db: Queryable,
  userId: string,
): Promise<BillingUserRecipient | null> {
  const rows = await queryRows<BillingUserRecipient>(
    db,
    `SELECT email, NULLIF(name, '') AS name FROM "user" WHERE id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

async function sendLifecycleEmail(
  db: Queryable,
  params: {
    kind: 'subscription_confirmed' | 'plan_changed' | 'cancellation_confirmed';
    eventId: string;
    subscription: Subscription;
    previousPlanName?: string | null;
    periodEnd?: string | null;
  },
): Promise<boolean> {
  try {
    const userId = params.subscription.referenceId;
    const recipient = await resolveBillingUser(db, userId);
    const subscriptionId = params.subscription.stripeSubscriptionId ?? params.subscription.id;
    const dedupeAction =
      params.kind === 'subscription_confirmed'
        ? 'confirm'
        : params.kind === 'cancellation_confirmed'
          ? 'cancel'
          : params.eventId;
    const inserted = await tryInsertBillingEmailLog(db, {
      dedupeKey: `billing:${params.kind}:${subscriptionId}:${dedupeAction}`,
      kind: params.kind,
      userId,
      stripeSubscriptionId: subscriptionId,
      periodEnd: params.periodEnd ?? null,
      metadata: {
        eventId: params.eventId,
        plan: params.subscription.plan,
        previousPlan: params.previousPlanName ?? null,
      },
    });
    if (!inserted || !recipient?.email) return inserted;

    await sendSubscriptionPlanEmail(
      recipient.email,
      {
        kind: params.kind,
        userName: recipient.name,
        planName: formatPlanName(params.subscription.plan),
        previousPlanName: params.previousPlanName,
        periodEnd: params.periodEnd ?? null,
        appUrl: getBillingAppUrl(),
        manageBillingUrl: `${getBillingAppUrl()}/account`,
      },
      getBillingEmailFrom(),
    );
    return true;
  } catch (err) {
    console.warn(`[BillingEmail] Failed to send ${params.kind}:`, err);
    return false;
  }
}

export function planFromPriceId(
  priceId: string | null | undefined,
  priceToPlan: ReadonlyMap<string, string>,
): string | null {
  if (!priceId) return null;
  return priceToPlan.get(priceId) ?? null;
}

export function previousPlanFromEvent(
  event: Stripe.Event,
  priceToPlan: ReadonlyMap<string, string>,
): string | null {
  const previous = event.data.previous_attributes as
    | { items?: { data?: Array<{ price?: { id?: string } }> } }
    | undefined;
  const previousPrice = previous?.items?.data?.find((item) => item.price?.id)?.price?.id;
  return planFromPriceId(previousPrice, priceToPlan);
}

export async function sendSubscriptionConfirmedEmail(
  db: Queryable,
  event: Stripe.Event,
  subscription: Subscription,
): Promise<boolean> {
  return sendLifecycleEmail(db, {
    kind: 'subscription_confirmed',
    eventId: event.id,
    subscription,
    periodEnd: subscription.periodEnd?.toISOString(),
  });
}

export async function sendPlanChangedEmail(
  db: Queryable,
  event: Stripe.Event,
  subscription: Subscription,
  previousPlan: string | null,
): Promise<boolean> {
  if (!previousPlan || previousPlan === subscription.plan) return false;
  return sendLifecycleEmail(db, {
    kind: 'plan_changed',
    eventId: event.id,
    subscription,
    previousPlanName: formatPlanName(previousPlan),
    periodEnd: subscription.periodEnd?.toISOString(),
  });
}

export async function sendSubscriptionCanceledEmail(
  db: Queryable,
  event: Stripe.Event,
  subscription: Subscription,
): Promise<boolean> {
  return sendLifecycleEmail(db, {
    kind: 'cancellation_confirmed',
    eventId: event.id,
    subscription,
    periodEnd:
      subscription.cancelAt?.toISOString() ??
      subscription.periodEnd?.toISOString() ??
      subscription.endedAt?.toISOString(),
  });
}
