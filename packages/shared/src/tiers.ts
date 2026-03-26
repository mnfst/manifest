export const TIERS = ['simple', 'standard', 'complex', 'reasoning'] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Readonly<Record<Tier, string>> = {
  simple: 'Simple',
  standard: 'Standard',
  complex: 'Complex',
  reasoning: 'Reasoning',
};

export const TIER_DESCRIPTIONS: Readonly<Record<Tier, string>> = {
  simple: 'Heartbeats, greetings, and low-cost tasks that any model can handle.',
  standard: 'General-purpose requests that need a good balance of quality and cost.',
  complex: 'Tasks requiring high quality, nuance, or multi-step reasoning.',
  reasoning: 'Advanced reasoning, planning, and critical decision-making.',
};
