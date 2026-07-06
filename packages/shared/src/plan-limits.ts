export const PLANS = ['free', 'pro'] as const;
export type Plan = (typeof PLANS)[number];

export interface PlanLimits {
  /** Max routed requests per calendar month (UTC); null = unlimited. Enforced on the /v1/* proxy. */
  requestsPerMonth: number | null;
}

export const PLAN_LIMITS: Readonly<Record<Plan, PlanLimits>> = {
  free: { requestsPerMonth: 10_000 },
  // Pro is unlimited. null = unlimited, enforced the same way as the self-hosted
  // UNLIMITED_PLAN_LIMITS.
  pro: { requestsPerMonth: null },
};

export const UNLIMITED_PLAN_LIMITS: PlanLimits = { requestsPerMonth: null };

export interface BillingEmailPreferences {
  usageAlerts: boolean;
}

export interface BillingStatus {
  enabled: boolean;
  plan: Plan;
  priceMonthlyUsd: number | null;
  emailPreferences: BillingEmailPreferences;
  requests: { used: number | null; limit: number | null; periodEnd: string | null };
}
