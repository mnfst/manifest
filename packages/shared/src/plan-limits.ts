export const PLANS = ['free', 'pro'] as const;
export type Plan = (typeof PLANS)[number];

export interface PlanLimits {
  /** Max non-deleted agents; null = unlimited */
  agents: number | null;
  /** Max routed requests per calendar month (UTC); null = unlimited. Enforced on the /v1/* proxy. */
  requestsPerMonth: number | null;
}

export const PLAN_LIMITS: Readonly<Record<Plan, PlanLimits>> = {
  free: { agents: 1, requestsPerMonth: 10_000 },
  // Pro is unlimited on both axes (see pricing: "Unlimited agents / Unlimited
  // routed requests"). null = unlimited, enforced the same way as the
  // self-hosted UNLIMITED_PLAN_LIMITS.
  pro: { agents: null, requestsPerMonth: null },
};

export const UNLIMITED_PLAN_LIMITS: PlanLimits = { agents: null, requestsPerMonth: null };

export interface BillingStatus {
  enabled: boolean;
  plan: Plan;
  priceMonthlyUsd: number | null;
  agents: { used: number; limit: number | null };
  requests: { used: number | null; limit: number | null; periodEnd: string | null };
}
