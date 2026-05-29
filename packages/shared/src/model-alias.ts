import { SPECIFICITY_CATEGORIES } from './specificity';
import type { SpecificityCategory } from './specificity';
import { TIER_SLOTS } from './tiers';
import type { TierSlot } from './tiers';

export type ModelAliasClassification =
  | { kind: 'auto' }
  | { kind: 'tier'; tier: TierSlot }
  | { kind: 'specificity'; category: SpecificityCategory }
  | { kind: 'header_tier'; id: string };

const TIER_SLOT_SET = new Set<string>(TIER_SLOTS);
const SPECIFICITY_SET = new Set<string>(SPECIFICITY_CATEGORIES);

/** API-facing alias for a specificity category (kebab-case). */
export function specificityCategoryToAlias(category: SpecificityCategory): string {
  return category.replace(/_/g, '-');
}

/** Map a request alias to an internal specificity category id, if recognized. */
export function aliasToSpecificityCategory(alias: string): SpecificityCategory | null {
  if (SPECIFICITY_SET.has(alias)) return alias as SpecificityCategory;
  const underscored = alias.replace(/-/g, '_');
  if (SPECIFICITY_SET.has(underscored)) return underscored as SpecificityCategory;
  return null;
}

/** Ordered list of every valid `model` alias accepted by the proxy and resolve APIs. */
export function getValidAliases(): readonly string[] {
  return ['auto', ...TIER_SLOTS, ...SPECIFICITY_CATEGORIES.map(specificityCategoryToAlias)];
}

/**
 * Classify a request `model` field as auto-routing, a tier slot, or a
 * specificity category. Returns null for unrecognized values (case-sensitive).
 * Specificity aliases use kebab-case in listings; snake_case inputs still parse.
 */
export function classifyModelAlias(
  input: string | null | undefined,
): ModelAliasClassification | null {
  if (typeof input !== 'string' || input.length === 0) return null;
  if (input === 'auto') return { kind: 'auto' };
  if (TIER_SLOT_SET.has(input)) return { kind: 'tier', tier: input as TierSlot };
  const category = aliasToSpecificityCategory(input);
  if (category) return { kind: 'specificity', category };
  return null;
}
