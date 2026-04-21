export const TIER_COLORS = ['slate', 'indigo', 'teal', 'amber', 'rose', 'violet'] as const;
export type TierColor = (typeof TIER_COLORS)[number];

export const DEFAULT_TIER_COLOR: TierColor = 'indigo';
