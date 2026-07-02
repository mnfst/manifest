export const PLANS = ['free', 'pro'] as const;
export type Plan = (typeof PLANS)[number];

export interface PlanLimits {
  /** Max non-deleted agents; null = unlimited */
  agents: number | null;
  /** Max routed requests per billing period; null = unlimited (enforced in a later PR) */
  requestsPerMonth: number | null;
}

export const PLAN_LIMITS: Readonly<Record<Plan, PlanLimits>> = {
  free: { agents: 1, requestsPerMonth: 10_000 },
  pro: { agents: 10, requestsPerMonth: 500_000 },
};

export const UNLIMITED_PLAN_LIMITS: PlanLimits = { agents: null, requestsPerMonth: null };

export interface BillingStatus {
  enabled: boolean;
  plan: Plan;
  priceMonthlyUsd: number | null;
  agents: { used: number; limit: number | null };
  requests: { used: number | null; limit: number | null; periodEnd: string | null };
}
