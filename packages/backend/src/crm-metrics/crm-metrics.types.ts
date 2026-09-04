/** Shapes returned by the internal CRM metrics feed. */

/** One Manifest user whose failing requests Autofix repaired. */
export interface CrmHealedUser {
  /** Lowercased primary address. The CRM dedupes people on this. */
  email: string;
  /** Display name from the auth record, or null when never set. */
  name: string | null;
  /** Heals inside the requested window — the number worth quoting to them. */
  healed_recent: number;
  /** Heals since Autofix shipped, across every tenant this user owns. */
  healed_all: number;
  first_heal_at: string;
  last_heal_at: string;
  /** Providers Autofix repaired against in the window, most-repaired first. */
  providers: string[];
  /** Convenience alias for `providers[0]`; null when no attempts were found. */
  top_provider: string | null;
}

/** One pivot waiting-list claim: the conversion signal for the campaign. */
export interface CrmWaitlistClaim {
  email: string;
  source: string;
  claimed_at: string;
}

/** Raw cohort row, one per (user, tenant) pair, before merging. */
export interface CohortRow {
  email: string;
  user_name: string | null;
  tenant_id: string;
  healed_recent: string | number;
  healed_all: string | number;
  first_heal_at: Date | string;
  last_heal_at: Date | string;
}

/** Raw provider-breakdown row, one per (tenant, provider) pair. */
export interface ProviderRow {
  tenant_id: string;
  provider: string | null;
  n: string | number;
}
